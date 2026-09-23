import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler.js';
import type { StepExecutor } from './step-executor.js';
import type { SchedulerOptions } from './scheduler.js';

function mockExecutor(): { executor: StepExecutor; calls: unknown[] } {
  const calls: unknown[] = [];
  const executor: StepExecutor = {
    canExecute: (step: any) => step.delivery === 'aria',
    execute: async (step) => { calls.push(step); },
  };
  return { executor, calls };
}

function testOptions(executors: StepExecutor[]): SchedulerOptions {
  return {
    eventTarget: new EventTarget(),
    speed: Infinity,
    startPaused: true,
    executors,
  };
}

describe('DES Scheduler', () => {
  it('executes flat sequential steps in order', async () => {
    const { executor, calls } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } },
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'B' } },
      ],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
    expect(calls).toHaveLength(2);
    expect((calls[0] as any).target.name).toBe('A');
    expect((calls[1] as any).target.name).toBe('B');
  });

  it('starts in paused state when startPaused is true', () => {
    const { executor } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } }],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    expect(runner.state).toBe('paused');
  });

  it('starts in idle state when startPaused is false', () => {
    const { executor } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } }],
    };
    const runner = createScheduler(scenario as any, {
      ...testOptions([executor]),
      startPaused: false,
    });
    expect(runner.state).toBe('idle');
  });

  it('step() executes exactly one step', async () => {
    const { executor, calls } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } },
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'B' } },
      ],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    await runner.step();
    expect(calls).toHaveLength(1);
    expect(runner.state).toBe('paused');
  });

  it('concurrent branches execute with DES interleaving', async () => {
    const { executor, calls } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [{
        delivery: 'orchestration', construct: 'concurrent',
        branches: {
          'a': [
            { delivery: 'aria', action: 'click', target: { role: 'button', name: 'A1' } },
            { delivery: 'aria', action: 'click', target: { role: 'button', name: 'A2' } },
          ],
          'b': [
            { delivery: 'aria', action: 'click', target: { role: 'button', name: 'B1' } },
          ],
        },
      }],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
    expect(calls).toHaveLength(3);
  });

  it('dispose stops execution and cleans up', async () => {
    const { executor, calls } = mockExecutor();
    const steps = Array.from({ length: 100 }, (_, i) => ({
      delivery: 'aria', action: 'click', target: { role: 'button', name: `btn-${i}` },
    }));
    const runner = createScheduler({ scenario: 'test', steps } as any, testOptions([executor]));
    runner.play();
    await new Promise(r => setTimeout(r, 10));
    runner.dispose();
    const countAtDispose = calls.length;
    await new Promise(r => setTimeout(r, 50));
    expect(calls.length).toBe(countAtDispose);
  });

  it('emits scenario:state on play', async () => {
    const { executor } = mockExecutor();
    const et = new EventTarget();
    const states: unknown[] = [];
    et.addEventListener('pages-event', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.topic === 'scenario:state') states.push(detail.payload);
    });
    const scenario = {
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'click', target: { role: 'button', name: 'A' } }],
    };
    const runner = createScheduler(scenario as any, { eventTarget: et, speed: Infinity, startPaused: true, executors: [executor] });
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
    expect(states.length).toBeGreaterThan(0);
    expect((states[0] as any).scenario).toBe('test');
  });

  it('signal construct unblocks await', async () => {
    const { executor, calls } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [
        {
          delivery: 'orchestration', construct: 'concurrent',
          branches: {
            'sender': [
              { delivery: 'aria', action: 'click', target: { role: 'button', name: 'Send' } },
              { delivery: 'orchestration', construct: 'signal', name: 'data-ready' },
            ],
            'receiver': [
              { delivery: 'orchestration', construct: 'await', signal: 'data-ready' },
              { delivery: 'aria', action: 'click', target: { role: 'button', name: 'Receive' } },
            ],
          },
        },
      ],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
    expect(calls).toHaveLength(2);
  });

  it('delay construct blocks queue for virtual time', async () => {
    const { executor, calls } = mockExecutor();
    const scenario = {
      scenario: 'test',
      steps: [
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'Before' } },
        { delivery: 'orchestration', construct: 'delay', duration: '1000ms' },
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'After' } },
      ],
    };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
    expect(calls).toHaveLength(2);
    expect(runner.clock.now()).toBeGreaterThanOrEqual(1000);
  });

  it('handles empty scenario', async () => {
    const { executor } = mockExecutor();
    const scenario = { scenario: 'empty', steps: [] };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.play();
    await vi.waitFor(() => expect(runner.state).toBe('done'));
  });

  it('setSpeed updates clock speed', () => {
    const { executor } = mockExecutor();
    const scenario = { scenario: 'test', steps: [] };
    const runner = createScheduler(scenario as any, testOptions([executor]));
    runner.setSpeed(2);
    expect(runner.clock.speed()).toBe(2);
  });
});
