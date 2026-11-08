import type { Action, Result, CatalogEntry } from '../../step/walker.js';
import { stepSuccess, stepFailureWithCategory } from '../../step/walker.js';
import type { Definition } from '../../step/types.js';

const MATCHERS: Record<string, (actual: unknown, expected: unknown) => boolean> = {
  equals: (a, e) => a === e || String(a) === String(e),
  contains: (a, e) => {
    if (Array.isArray(a)) return a.some(item => String(item) === String(e));
    return String(a).includes(String(e));
  },
  matches: (a, e) => new RegExp(String(e)).test(String(a)),
  hasSize: (a, e) => {
    const len = Array.isArray(a) ? a.length : String(a).length;
    return len === Number(e);
  },
  startsWith: (a, e) => String(a).startsWith(String(e)),
  endsWith: (a, e) => String(a).endsWith(String(e)),
  greaterThan: (a, e) => Number(a) > Number(e),
  greaterThanOrEqual: (a, e) => Number(a) >= Number(e),
  lessThan: (a, e) => Number(a) < Number(e),
  'not-null': (a) => a !== null && a !== undefined,
  'not-empty': (a) => {
    if (Array.isArray(a)) return a.length > 0;
    return a !== '' && a !== null && a !== undefined;
  },
  empty: (a) => {
    if (Array.isArray(a)) return a.length === 0;
    return a === '' || a === null || a === undefined;
  },
};

const MATCHER_KEYS = new Set(Object.keys(MATCHERS));

const assertThatDefinition: Definition = {
  name: 'assertThat',
  inputs: { expression: { type: 'STRING' as any, required: true } },
  outputs: {},
  absorbSiblings: true,
};

const assertThatAction: Action = {
  async execute(params: Record<string, unknown>): Promise<Result> {
    const actual = params['expression'] ?? params['_subject'];
    const failures: string[] = [];

    for (const [key, expected] of Object.entries(params)) {
      if (key === 'expression' || key === '_subject') continue;
      const matcher = MATCHERS[key];
      if (!matcher) continue;
      if (!matcher(actual, expected)) {
        failures.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }

    if (failures.length > 0) {
      return stepFailureWithCategory(
        `assertThat failed: ${failures.join('; ')}`,
        'STEP_ACTION_FAILED',
      );
    }
    return stepSuccess({});
  },
};

export function createAssertThatPlugin(): CatalogEntry {
  return { qualifiedName: 'assertThat', definition: assertThatDefinition, action: assertThatAction };
}

export { MATCHER_KEYS };
