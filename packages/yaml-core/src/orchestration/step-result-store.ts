import type { StepResultStore } from './types.js';
import type { StepError } from './directives.js';

export class DefaultStepResultStore implements StepResultStore {
  private readonly _results = new Map<string, Record<string, unknown>>();
  private readonly _errors = new Map<string, StepError>();
  private readonly _completed = new Set<string>();

  recordSuccess(stepName: string, result: Record<string, unknown>): void {
    this._results.set(stepName, result);
    this._completed.add(stepName);
  }

  recordFailure(stepName: string, error: StepError): void {
    this._errors.set(stepName, error);
    this._completed.add(stepName);
  }

  result(stepName: string): Record<string, unknown> | undefined {
    return this._results.get(stepName);
  }

  error(stepName: string): StepError | undefined {
    return this._errors.get(stepName);
  }

  hasCompleted(stepName: string): boolean {
    return this._completed.has(stepName);
  }
}
