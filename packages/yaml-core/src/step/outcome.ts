import type { JournalEntry } from './simulation-runtime.js';

export interface StepOutcomeEntry {
  readonly name: string;
  readonly queue: string;
  readonly kind: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly duration: number;
  readonly result: 'success' | 'failure' | 'skipped';
  readonly error?: { readonly message: string; readonly failureCategory?: string };
  readonly decorators?: readonly string[];
}

export interface OutcomeSummary {
  readonly stepsExecuted: number;
  readonly stepsFailed: number;
  readonly stepsSkipped: number;
}

export interface ExecutionOutcome {
  readonly scenarioName: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly duration: number;
  readonly finalState: 'completed' | 'failed' | 'deadlocked';
  readonly triggerSource?: string;
  readonly summary: OutcomeSummary;
  readonly steps: readonly StepOutcomeEntry[];
  readonly journal?: readonly JournalEntry[];
}

export class OutcomeCollector {
  private readonly scenarioName: string;
  private readonly startedAt: number;
  private readonly stepEntries: StepOutcomeEntry[] = [];
  private readonly activeSteps = new Map<string, {
    startedAt: number; kind: string; queue: string;
  }>();

  constructor(scenarioName: string) {
    this.scenarioName = scenarioName;
    this.startedAt = Date.now();
  }

  stepStarted(key: string, kind: string, queue: string): void {
    this.activeSteps.set(key, { startedAt: Date.now(), kind, queue });
  }

  stepCompleted(
    key: string,
    name: string,
    result: 'success' | 'failure' | 'skipped',
    error?: { message: string; failureCategory?: string },
    decorators?: string[],
  ): void {
    const active = this.activeSteps.get(key);
    if (!active) return;
    this.activeSteps.delete(key);
    const completedAt = Date.now();
    this.stepEntries.push({
      name,
      queue: active.queue,
      kind: active.kind,
      startedAt: active.startedAt,
      completedAt,
      duration: completedAt - active.startedAt,
      result,
      error,
      decorators,
    });
  }

  finalize(
    finalState: 'completed' | 'failed' | 'deadlocked',
    journal?: JournalEntry[],
  ): ExecutionOutcome {
    const completedAt = Date.now();
    return {
      scenarioName: this.scenarioName,
      startedAt: this.startedAt,
      completedAt,
      duration: completedAt - this.startedAt,
      finalState,
      summary: {
        stepsExecuted: this.stepEntries.filter(s => s.result === 'success').length,
        stepsFailed: this.stepEntries.filter(s => s.result === 'failure').length,
        stepsSkipped: this.stepEntries.filter(s => s.result === 'skipped').length,
      },
      steps: this.stepEntries,
      journal: journal && journal.length > 0 ? journal : undefined,
    };
  }
}
