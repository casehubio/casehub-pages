import { describe, it, expect } from 'vitest';
import { parseScenario } from './parser.js';
import type { OrchestratedStep, OrchestrationConstruct } from './types.js';

describe('Parser — orchestration constructs', () => {
  it('parses concurrent block with named branches', () => {
    const yaml = `
scenario: test
steps:
  - concurrent:
      branch-a:
        - click: { role: button, name: A }
      branch-b:
        - click: { role: button, name: B }
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as OrchestratedStep & OrchestrationConstruct;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('concurrent');
    expect('branches' in step && Object.keys(step.branches)).toEqual(['branch-a', 'branch-b']);
  });

  it('parses signal step', () => {
    const yaml = `
scenario: test
steps:
  - signal: go
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('signal');
    expect(step.name).toBe('go');
  });

  it('parses await step with signal', () => {
    const yaml = `
scenario: test
steps:
  - await: { signal: data-loaded, timeout: 30s }
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('await');
    expect(step.signal).toBe('data-loaded');
    expect(step.timeout).toBe('30s');
  });

  it('parses await step with barrier', () => {
    const yaml = `
scenario: test
steps:
  - await: { barrier: all-ready }
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('await');
    expect(step.barrier).toBe('all-ready');
  });

  it('parses delay step', () => {
    const yaml = `
scenario: test
steps:
  - delay: 500ms
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('delay');
    expect(step.duration).toBe('500ms');
  });

  it('parses inline decorators on aria steps', () => {
    const yaml = `
scenario: test
steps:
  - click: { role: button, name: Submit }
    mutex: db-write
    retry: 3
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as OrchestratedStep;
    expect(step.delivery).toBe('aria');
    expect(step.decorators?.mutex).toBe('db-write');
    expect(step.decorators?.retry).toEqual({ type: 'simple', max: 3 });
  });

  it('parses delay decorator', () => {
    const yaml = `
scenario: test
steps:
  - click: { role: button, name: OK }
    delay: 100ms
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as OrchestratedStep;
    expect(step.decorators?.delay).toBe('100ms');
  });

  it('parses when decorator', () => {
    const yaml = `
scenario: test
steps:
  - click: { role: button, name: OK }
    when: isReady
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as OrchestratedStep;
    expect(step.decorators?.when).toBe('isReady');
  });

  it('parses top-level orchestration block', () => {
    const yaml = `
scenario: test
orchestration:
  barriers:
    all-ready: { count: 3 }
  channels:
    trades: { capacity: 10 }
  signals: [go, stop]
steps:
  - click: { role: button, name: Start }
    `;
    const result = parseScenario(yaml);
    expect((result as any).orchestration?.barriers?.['all-ready']?.count).toBe(3);
    expect((result as any).orchestration?.channels?.['trades']?.capacity).toBe(10);
    expect((result as any).orchestration?.signals).toEqual(['go', 'stop']);
  });

  it('parses triggered steps', () => {
    const yaml = `
scenario: test
steps:
  - trigger:
      type: data
      channel: trades
    steps:
      - click: { role: button, name: Refresh }
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('orchestration');
    expect(step.construct).toBe('trigger');
    expect(step.trigger.type).toBe('data');
    expect(step.trigger.channel).toBe('trades');
    expect(step.steps).toHaveLength(1);
  });

  it('parses simulated delivery step', () => {
    const yaml = `
scenario: test
steps:
  - simulated:
      dataset: accounts
      data: { id: 1, name: Test }
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('simulated');
    expect(step.dataset).toBe('accounts');
  });

  it('parses graphql delivery step', () => {
    const yaml = `
scenario: test
steps:
  - graphql:
      name: fetchAccounts
      domain: finance
      operation: getAccounts
    `;
    const result = parseScenario(yaml);
    const step = result.steps[0] as any;
    expect(step.delivery).toBe('graphql');
    expect(step.name).toBe('fetchAccounts');
    expect(step.domain).toBe('finance');
    expect(step.operation).toBe('getAccounts');
  });

  it('preserves existing aria parsing', () => {
    const yaml = `
scenario: test
steps:
  - click: { role: button, name: OK }
  - fill: { role: textbox, name: Email, value: test@example.com }
    `;
    const result = parseScenario(yaml);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].delivery).toBe('aria');
    expect(result.steps[1].delivery).toBe('aria');
  });
});
