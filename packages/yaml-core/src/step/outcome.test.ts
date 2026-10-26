import { describe, it, expect } from 'vitest';
import { OutcomeCollector } from './outcome.js';
import type { ExecutionOutcome, StepOutcomeEntry } from './outcome.js';
import type { JournalEntry } from './simulation-runtime.js';

describe('OutcomeCollector', () => {
  it('produces an outcome with a single successful step', () => {
    const collector = new OutcomeCollector('test-scenario');
    collector.stepStarted('q0:0', 'plugin', 'q0');
    collector.stepCompleted('q0:0', 'click', 'success');

    const outcome = collector.finalize('completed');

    expect(outcome.scenarioName).toBe('test-scenario');
    expect(outcome.finalState).toBe('completed');
    expect(outcome.summary.stepsExecuted).toBe(1);
    expect(outcome.summary.stepsFailed).toBe(0);
    expect(outcome.summary.stepsSkipped).toBe(0);
    expect(outcome.steps).toHaveLength(1);
    expect(outcome.steps[0]!.name).toBe('click');
    expect(outcome.steps[0]!.kind).toBe('plugin');
    expect(outcome.steps[0]!.queue).toBe('q0');
    expect(outcome.steps[0]!.result).toBe('success');
    expect(outcome.steps[0]!.duration).toBeGreaterThanOrEqual(0);
    expect(outcome.journal).toBeUndefined();
  });

  it('accumulates multiple steps in order', () => {
    const collector = new OutcomeCollector('multi');
    collector.stepStarted('q0:0', 'plugin', 'q0');
    collector.stepCompleted('q0:0', 'step-a', 'success');
    collector.stepStarted('q0:1', 'delay', 'q0');
    collector.stepCompleted('q0:1', 'step-b', 'success');
    collector.stepStarted('q1:0', 'plugin', 'q1');
    collector.stepCompleted('q1:0', 'step-c', 'failure',
      { message: 'boom', failureCategory: 'assertion' });

    const outcome = collector.finalize('failed');

    expect(outcome.steps).toHaveLength(3);
    expect(outcome.summary.stepsExecuted).toBe(2);
    expect(outcome.summary.stepsFailed).toBe(1);
    expect(outcome.steps[2]!.result).toBe('failure');
    expect(outcome.steps[2]!.error).toEqual({
      message: 'boom', failureCategory: 'assertion',
    });
  });

  it('counts skipped steps in summary', () => {
    const collector = new OutcomeCollector('skips');
    collector.stepStarted('q0:0', 'plugin', 'q0');
    collector.stepCompleted('q0:0', 'a', 'success');
    collector.stepStarted('q0:1', 'plugin', 'q0');
    collector.stepCompleted('q0:1', 'b', 'skipped');

    const outcome = collector.finalize('completed');

    expect(outcome.summary.stepsExecuted).toBe(1);
    expect(outcome.summary.stepsSkipped).toBe(1);
  });

  it('ignores stepCompleted with no prior stepStarted', () => {
    const collector = new OutcomeCollector('orphan');
    collector.stepCompleted('q0:0', 'orphan-step', 'success');

    const outcome = collector.finalize('completed');

    expect(outcome.steps).toHaveLength(0);
    expect(outcome.summary.stepsExecuted).toBe(0);
  });

  it('attaches journal entries when provided', () => {
    const collector = new OutcomeCollector('sim');
    const journal: JournalEntry[] = [{
      qualifiedName: 'agent.invoke',
      tenancyId: 'default',
      input: { prompt: 'hi' },
      output: { response: 'hello' },
      timestamp: Date.now(),
      dataRealism: 'DOMAIN_PLAUSIBLE',
    }];

    const outcome = collector.finalize('completed', journal);

    expect(outcome.journal).toHaveLength(1);
    expect(outcome.journal![0]!.qualifiedName).toBe('agent.invoke');
  });

  it('leaves journal undefined when no entries provided', () => {
    const collector = new OutcomeCollector('no-sim');
    const outcome = collector.finalize('completed');
    expect(outcome.journal).toBeUndefined();
  });

  it('computes duration from construction to finalize', () => {
    const collector = new OutcomeCollector('duration');
    const outcome = collector.finalize('completed');

    expect(outcome.duration).toBeGreaterThanOrEqual(0);
    expect(outcome.completedAt).toBeGreaterThanOrEqual(outcome.startedAt);
    expect(outcome.duration).toBe(outcome.completedAt - outcome.startedAt);
  });

  it('records decorator names on step entries', () => {
    const collector = new OutcomeCollector('deco');
    collector.stepStarted('q0:0', 'plugin', 'q0');
    collector.stepCompleted('q0:0', 'step-a', 'success', undefined,
      ['retry', 'if']);

    const outcome = collector.finalize('completed');

    expect(outcome.steps[0]!.decorators).toEqual(['retry', 'if']);
  });
});
