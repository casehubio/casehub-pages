import { describe, it, expect, vi } from 'vitest';
import type {
  StepAction, StepResult, PluginStep, BlockStep,
  ParallelStep, IfElseStep, MatchStep, TryCatchFinallyStep,
  BarrierStep, QuorumStep, CatalogEntry,
} from './step-walker.js';
import { stepSuccess, stepFailure, MapServiceRegistry } from './step-walker.js';
import { StructuralStepEvaluator } from './structural-evaluator.js';
import type { StepContext } from './decorator-chain.js';
import { DefaultScenarioScope } from '../orchestration/scenario-scope.js';
import { defaultPattern, valuePattern } from '../match.js';

function makeAction(result: StepResult = stepSuccess({})): StepAction {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function makeEntry(name: string, result: StepResult = stepSuccess({})): CatalogEntry {
  return {
    qualifiedName: name,
    definition: { name, inputs: {}, outputs: {} },
    action: makeAction(result),
  };
}

function makeContext(overrides: Partial<StepContext> = {}): StepContext {
  return {
    params: {},
    services: new MapServiceRegistry(),
    scope: new DefaultScenarioScope(),
    stepName: 'root',
    ...overrides,
  };
}

describe('StructuralStepEvaluator', () => {
  describe('plugin step', () => {
    it('executes catalog action with params', async () => {
      const entry = makeEntry('greet', stepSuccess({ msg: 'hello' }));
      const step: PluginStep = {
        kind: 'plugin', name: 'greet', entry, params: { who: 'world' }, decorators: {},
      };
      const evaluator = new StructuralStepEvaluator();
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(entry.action.execute).toHaveBeenCalledWith({ who: 'world' }, expect.anything());
    });
  });

  describe('block step', () => {
    it('executes steps sequentially', async () => {
      const order: string[] = [];
      const a = makeEntry('a', stepSuccess({ a: 1 }));
      a.action.execute = vi.fn().mockImplementation(async () => { order.push('a'); return stepSuccess({ a: 1 }); });
      const b = makeEntry('b', stepSuccess({ b: 2 }));
      b.action.execute = vi.fn().mockImplementation(async () => { order.push('b'); return stepSuccess({ b: 2 }); });

      const step: BlockStep = {
        kind: 'block', name: null, decorators: {},
        steps: [
          { kind: 'plugin', name: 'a', entry: a, params: {}, decorators: {} },
          { kind: 'plugin', name: 'b', entry: b, params: {}, decorators: {} },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(order).toEqual(['a', 'b']);
    });

    it('stops on first failure', async () => {
      const a = makeEntry('a', stepFailure('boom'));
      const b = makeEntry('b');
      const step: BlockStep = {
        kind: 'block', name: null, decorators: {},
        steps: [
          { kind: 'plugin', name: 'a', entry: a, params: {}, decorators: {} },
          { kind: 'plugin', name: 'b', entry: b, params: {}, decorators: {} },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('failure');
      expect(b.action.execute).not.toHaveBeenCalled();
    });
  });

  describe('parallel step', () => {
    it('executes steps concurrently', async () => {
      const a = makeEntry('a', stepSuccess({ a: 1 }));
      const b = makeEntry('b', stepSuccess({ b: 2 }));
      const step: ParallelStep = {
        kind: 'parallel', name: null, decorators: {},
        steps: [
          { kind: 'plugin', name: 'a', entry: a, params: {}, decorators: {} },
          { kind: 'plugin', name: 'b', entry: b, params: {}, decorators: {} },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(a.action.execute).toHaveBeenCalled();
      expect(b.action.execute).toHaveBeenCalled();
    });

    it('returns failure if any step fails', async () => {
      const a = makeEntry('a', stepSuccess({}));
      const b = makeEntry('b', stepFailure('parallel fail'));
      const step: ParallelStep = {
        kind: 'parallel', name: null, decorators: {},
        steps: [
          { kind: 'plugin', name: 'a', entry: a, params: {}, decorators: {} },
          { kind: 'plugin', name: 'b', entry: b, params: {}, decorators: {} },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('failure');
    });
  });

  describe('if-else step', () => {
    it('executes then branch when condition is truthy', async () => {
      const thenEntry = makeEntry('then-action', stepSuccess({ branch: 'then' }));
      const elseEntry = makeEntry('else-action');
      const step: IfElseStep = {
        kind: 'if-else', name: null, condition: 'true', decorators: {},
        thenSteps: [{ kind: 'plugin', name: 't', entry: thenEntry, params: {}, decorators: {} }],
        elseSteps: [{ kind: 'plugin', name: 'e', entry: elseEntry, params: {}, decorators: {} }],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(thenEntry.action.execute).toHaveBeenCalled();
      expect(elseEntry.action.execute).not.toHaveBeenCalled();
    });

    it('executes else branch when condition is falsy', async () => {
      const thenEntry = makeEntry('then-action');
      const elseEntry = makeEntry('else-action', stepSuccess({ branch: 'else' }));
      const step: IfElseStep = {
        kind: 'if-else', name: null, condition: 'false', decorators: {},
        thenSteps: [{ kind: 'plugin', name: 't', entry: thenEntry, params: {}, decorators: {} }],
        elseSteps: [{ kind: 'plugin', name: 'e', entry: elseEntry, params: {}, decorators: {} }],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(thenEntry.action.execute).not.toHaveBeenCalled();
      expect(elseEntry.action.execute).toHaveBeenCalled();
    });
  });

  describe('match step', () => {
    it('executes steps for the matching case', async () => {
      const matchEntry = makeEntry('matched', stepSuccess({ matched: true }));
      const defaultEntry = makeEntry('default');
      const step: MatchStep = {
        kind: 'match', name: null, scrutinee: 'hello', decorators: {},
        cases: [
          {
            pattern: valuePattern('hello'),
            guard: null,
            steps: [{ kind: 'plugin', name: 'm', entry: matchEntry, params: {}, decorators: {} }],
          },
          {
            pattern: defaultPattern(),
            guard: null,
            steps: [{ kind: 'plugin', name: 'd', entry: defaultEntry, params: {}, decorators: {} }],
          },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(matchEntry.action.execute).toHaveBeenCalled();
      expect(defaultEntry.action.execute).not.toHaveBeenCalled();
    });

    it('falls through to default when no match', async () => {
      const defaultEntry = makeEntry('default', stepSuccess({ fallback: true }));
      const step: MatchStep = {
        kind: 'match', name: null, scrutinee: 'unknown', decorators: {},
        cases: [
          {
            pattern: valuePattern('something-else'),
            guard: null,
            steps: [],
          },
          {
            pattern: defaultPattern(),
            guard: null,
            steps: [{ kind: 'plugin', name: 'd', entry: defaultEntry, params: {}, decorators: {} }],
          },
        ],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(defaultEntry.action.execute).toHaveBeenCalled();
    });
  });

  describe('try-catch-finally step', () => {
    it('runs try steps on success', async () => {
      const tryEntry = makeEntry('try', stepSuccess({ tried: true }));
      const catchEntry = makeEntry('catch');
      const finallyEntry = makeEntry('finally', stepSuccess({}));
      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {},
        trySteps: [{ kind: 'plugin', name: 't', entry: tryEntry, params: {}, decorators: {} }],
        catchSteps: [{ kind: 'plugin', name: 'c', entry: catchEntry, params: {}, decorators: {} }],
        finallySteps: [{ kind: 'plugin', name: 'f', entry: finallyEntry, params: {}, decorators: {} }],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(tryEntry.action.execute).toHaveBeenCalled();
      expect(catchEntry.action.execute).not.toHaveBeenCalled();
      expect(finallyEntry.action.execute).toHaveBeenCalled();
    });

    it('runs catch steps on failure, then finally', async () => {
      const tryEntry = makeEntry('try', stepFailure('oops'));
      const catchEntry = makeEntry('catch', stepSuccess({ caught: true }));
      const finallyEntry = makeEntry('finally', stepSuccess({}));
      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {},
        trySteps: [{ kind: 'plugin', name: 't', entry: tryEntry, params: {}, decorators: {} }],
        catchSteps: [{ kind: 'plugin', name: 'c', entry: catchEntry, params: {}, decorators: {} }],
        finallySteps: [{ kind: 'plugin', name: 'f', entry: finallyEntry, params: {}, decorators: {} }],
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(tryEntry.action.execute).toHaveBeenCalled();
      expect(catchEntry.action.execute).toHaveBeenCalled();
      expect(finallyEntry.action.execute).toHaveBeenCalled();
    });
  });

  describe('barrier step', () => {
    it('succeeds when all awaited steps have completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('step-a', { done: true });
      store.recordSuccess('step-b', { done: true });

      const step: BarrierStep = {
        kind: 'barrier', name: null, awaitSteps: ['step-a', 'step-b'], decorators: {},
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('success');
    });

    it('fails when awaited step has not completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('step-a', {});

      const step: BarrierStep = {
        kind: 'barrier', name: null, awaitSteps: ['step-a', 'step-b'], decorators: {},
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('failure');
    });
  });

  describe('quorum step', () => {
    it('succeeds when required count of steps have completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('s1', {});
      store.recordSuccess('s2', {});

      const step: QuorumStep = {
        kind: 'quorum', name: null, required: 2, ofSteps: ['s1', 's2', 's3'], decorators: {},
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('success');
    });

    it('fails when fewer than required steps have completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('s1', {});

      const step: QuorumStep = {
        kind: 'quorum', name: null, required: 2, ofSteps: ['s1', 's2', 's3'], decorators: {},
      };
      const result = await new StructuralStepEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('failure');
    });
  });

  describe('result recording', () => {
    it('records named step results in the store', async () => {
      const scope = new DefaultScenarioScope();
      const entry = makeEntry('action', stepSuccess({ v: 42 }));
      const step: PluginStep = {
        kind: 'plugin', name: 'my-step', entry, params: {}, decorators: {},
      };
      await new StructuralStepEvaluator().evaluate(step, makeContext({ scope }));
      expect(scope.resultStore().result('my-step')).toEqual({ v: 42 });
    });
  });
});
