import { describe, it, expect } from 'vitest';
import { DefaultScenarioScope } from './scenario-scope.js';

describe('DefaultScenarioScope', () => {
  it('creates semaphore by name', () => {
    const scope = new DefaultScenarioScope();
    const sem = scope.semaphore('db', 3);
    expect(sem.availablePermits()).toBe(3);
  });

  it('get-or-create — same name returns same instance', () => {
    const scope = new DefaultScenarioScope();
    const s1 = scope.signal('go');
    const s2 = scope.signal('go');
    expect(s1).toBe(s2);
  });

  it('creates latch by name', () => {
    const scope = new DefaultScenarioScope();
    const latch = scope.latch('barrier', 2);
    expect(latch.getCount()).toBe(2);
  });

  it('creates channel by name', () => {
    const scope = new DefaultScenarioScope();
    const ch = scope.channel<number>('trades');
    expect(ch.isEmpty()).toBe(true);
  });

  it('creates bounded channel', async () => {
    const scope = new DefaultScenarioScope();
    const ch = scope.channel<number>('bounded', 1);
    await ch.send(1);
    expect(ch.isEmpty()).toBe(false);
  });

  it('creates state machine by name', () => {
    const scope = new DefaultScenarioScope();
    const sm = scope.stateMachine('wf', ['idle', 'active', 'done'] as const, 'idle');
    expect(sm.currentState()).toBe('idle');
  });

  it('resultStore returns singleton', () => {
    const scope = new DefaultScenarioScope();
    expect(scope.resultStore()).toBe(scope.resultStore());
  });

  it('close cascades — channels closed, signals fired', async () => {
    const scope = new DefaultScenarioScope();
    const ch = scope.channel<number>('test');
    const sig = scope.signal('gate');
    scope.close();
    await expect(ch.receive()).rejects.toThrow();
    expect(sig.isSignalled()).toBe(true);
  });
});
