import { describe, it, expect } from 'vitest';
import { DefaultScenarioScope } from '@casehubio/yaml-core/orchestration';
import { bindScenario } from './yaml-binder.js';

describe('YamlBinder', () => {
  it('creates a single queue for flat sequential steps', () => {
    const scenario = {
      scenario: 'test',
      steps: [
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } },
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'B' } },
      ],
    };
    const scope = new DefaultScenarioScope();
    const result = bindScenario(scenario as any, scope);
    expect(result.queues).toHaveLength(1);
    expect(result.queues[0].steps).toHaveLength(2);
    expect(result.queues[0].id).toBe('main');
  });

  it('creates child queues for concurrent block', () => {
    const scenario = {
      scenario: 'test',
      steps: [
        {
          delivery: 'orchestration', construct: 'concurrent',
          branches: {
            'branch-a': [{ delivery: 'aria', action: 'click' }],
            'branch-b': [{ delivery: 'aria', action: 'click' }],
          },
        },
      ],
    };
    const scope = new DefaultScenarioScope();
    const result = bindScenario(scenario as any, scope);
    expect(result.queues).toHaveLength(3);
    const mainQueue = result.queues[0];
    expect(mainQueue.children).toHaveLength(2);
    expect(mainQueue.children[0].id).toBe('branch-a');
    expect(mainQueue.children[1].id).toBe('branch-b');
  });

  it('creates named primitives from orchestration block', () => {
    const scenario = {
      scenario: 'test',
      orchestration: {
        barriers: { 'all-ready': { count: 3 } },
        channels: { trades: { capacity: 10 } },
        signals: ['go'],
      },
      steps: [],
    };
    const scope = new DefaultScenarioScope();
    bindScenario(scenario as any, scope);
    expect(scope.latch('all-ready', 3).getCount()).toBe(3);
    expect(scope.channel('trades').isEmpty()).toBe(true);
    expect(scope.signal('go').isSignalled()).toBe(false);
  });

  it('creates anonymous semaphore for inline mutex', () => {
    const scenario = {
      scenario: 'test',
      steps: [
        { delivery: 'aria', action: 'click', decorators: { mutex: 'db-write' } },
      ],
    };
    const scope = new DefaultScenarioScope();
    bindScenario(scenario as any, scope);
    expect(scope.semaphore('__anon_mutex_db-write', 1).availablePermits()).toBe(1);
  });

  it('creates suspended queue for triggered steps', () => {
    const scenario = {
      scenario: 'test',
      steps: [
        {
          delivery: 'orchestration', construct: 'trigger',
          trigger: { type: 'data', channel: 'trades' },
          steps: [{ delivery: 'aria', action: 'click' }],
        },
      ],
    };
    const scope = new DefaultScenarioScope();
    const result = bindScenario(scenario as any, scope);
    const triggerQueue = result.queues.find(q => q.state === 'suspended');
    expect(triggerQueue).toBeDefined();
    expect(triggerQueue!.trigger).toEqual({ type: 'data', channel: 'trades' });
  });

  it('rejects __anon_ prefix in top-level orchestration names', () => {
    const scenario = {
      scenario: 'test',
      orchestration: { signals: ['__anon_bad'] },
      steps: [],
    };
    const scope = new DefaultScenarioScope();
    expect(() => bindScenario(scenario as any, scope)).toThrow('__anon_');
  });

  it('handles sectioned scenarios', () => {
    const scenario = {
      scenario: 'test',
      sections: [
        { title: 'Intro', steps: [{ delivery: 'aria', action: 'click' }] },
        { title: 'Body', steps: [{ delivery: 'aria', action: 'fill' }] },
      ],
    };
    const scope = new DefaultScenarioScope();
    const result = bindScenario(scenario as any, scope);
    expect(result.queues).toHaveLength(1);
    expect(result.queues[0].steps).toHaveLength(2);
  });
});
