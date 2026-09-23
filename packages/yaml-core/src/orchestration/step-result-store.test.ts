import { describe, it, expect } from 'vitest';
import { DefaultStepResultStore } from './step-result-store.js';

describe('DefaultStepResultStore', () => {
  it('records and retrieves success', () => {
    const store = new DefaultStepResultStore();
    store.recordSuccess('step-1', { count: 42 });
    expect(store.result('step-1')).toEqual({ count: 42 });
    expect(store.hasCompleted('step-1')).toBe(true);
    expect(store.error('step-1')).toBeUndefined();
  });

  it('records and retrieves failure', () => {
    const store = new DefaultStepResultStore();
    const err = { message: 'boom', exceptionClass: 'Error', stackTrace: 'at ...' };
    store.recordFailure('step-2', err);
    expect(store.error('step-2')).toEqual(err);
    expect(store.hasCompleted('step-2')).toBe(true);
    expect(store.result('step-2')).toBeUndefined();
  });

  it('returns undefined for unknown steps', () => {
    const store = new DefaultStepResultStore();
    expect(store.result('nope')).toBeUndefined();
    expect(store.error('nope')).toBeUndefined();
    expect(store.hasCompleted('nope')).toBe(false);
  });
});
