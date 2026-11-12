import type { Action, Result, CatalogEntry } from '../../step/walker.js';
import { stepSuccess, stepFailureWithCategory } from '../../step/walker.js';
import { isTruthy } from '../../truthiness.js';
import type { Definition } from '../../step/types.js';

const assertDefinition: Definition = {
  name: 'assert',
  inputs: { expression: { type: 'STRING' as any, required: true } },
  outputs: {},
};

const assertAction: Action = {
  async execute(params: Record<string, unknown>): Promise<Result> {
    const expr = String(params['expression'] ?? params['_subject'] ?? '');
    try {
      if (isTruthy(expr)) return stepSuccess({});
      return stepFailureWithCategory(`Assertion failed: '${expr}' is falsy`, 'STEP_ACTION_FAILED');
    } catch {
      if (expr.length > 0) return stepSuccess({});
      return stepFailureWithCategory(`Assertion failed: expression is empty`, 'STEP_ACTION_FAILED');
    }
  },
};

export function createAssertPlugin(): CatalogEntry {
  return { qualifiedName: 'assert', definition: assertDefinition, action: assertAction };
}
