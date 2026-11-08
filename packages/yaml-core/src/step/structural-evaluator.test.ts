import { describe, it, expect, vi } from 'vitest';
import type {
  Action, Result, PluginStep, BlockStep,
  ParallelStep, IfElseStep, MatchStep, TryCatchFinallyStep,
  BarrierStep, QuorumStep, CatalogEntry, InvokeStep,
  DelayStep, RaceStep, ControlStep,
} from './walker.js';
import { stepSuccess, stepFailure, stepFailureWithCategory, MapServiceRegistry } from './walker.js';
import { StructuralEvaluator } from './structural-evaluator.js';
import type { Context } from './decorator-chain.js';
import { DefaultScenarioScope } from '../orchestration/scenario-scope.js';
import { VariableResolver } from '../variable-resolver.js';
import { defaultPattern, valuePattern } from '../match.js';
import { createMockRestHandler, createMockMcpHandler } from './invoke/test-helpers.js';

function makeAction(result: Result = stepSuccess({})): Action {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function makeEntry(name: string, result: Result = stepSuccess({})): CatalogEntry {
  return {
    qualifiedName: name,
    definition: { name, inputs: {}, outputs: {} },
    action: makeAction(result),
  };
}

function makeContext(overrides: Partial<Context> = {}): Context {
  return {
    params: {},
    services: new MapServiceRegistry(),
    scope: new DefaultScenarioScope(),
    stepName: 'root',
    resolver: new VariableResolver({}, new Set()),
    ...overrides,
  };
}

describe('StructuralEvaluator', () => {
  describe('plugin step', () => {
    it('executes catalog action with params', async () => {
      const entry = makeEntry('greet', stepSuccess({ msg: 'hello' }));
      const step: PluginStep = {
        kind: 'plugin', name: 'greet', entry, params: { who: 'world' }, decorators: {},
      };
      const evaluator = new StructuralEvaluator();
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('success');
    });

    it('fails when awaited step has not completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('step-a', {});

      const step: BarrierStep = {
        kind: 'barrier', name: null, awaitSteps: ['step-a', 'step-b'], decorators: {},
      };
      const result = await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
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
      const result = await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('success');
    });

    it('fails when fewer than required steps have completed', async () => {
      const scope = new DefaultScenarioScope();
      const store = scope.resultStore();
      store.recordSuccess('s1', {});

      const step: QuorumStep = {
        kind: 'quorum', name: null, required: 2, ofSteps: ['s1', 's2', 's3'], decorators: {},
      };
      const result = await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('failure');
    });
  });

  describe('invoke step', () => {
    it('returns failure when no handlers are registered', async () => {
      const step: InvokeStep = {
        kind: 'invoke', name: 'call-api',
        invokeSpec: { rest: { method: 'GET', url: '/api/users' } },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator();
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('failure');
    });

    it('dispatches to matching REST handler', async () => {
      const step: InvokeStep = {
        kind: 'invoke', name: 'call-api',
        invokeSpec: { rest: { method: 'GET', url: '/api/users' } },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator([createMockRestHandler()]);
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.output).toHaveProperty('status', 200);
      }
    });

    it('dispatches to matching MCP handler', async () => {
      const step: InvokeStep = {
        kind: 'invoke', name: 'search',
        invokeSpec: { mcp: 'file_search' },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator([createMockMcpHandler()]);
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.output).toHaveProperty('results');
      }
    });

    it('selects correct handler from multiple', async () => {
      const step: InvokeStep = {
        kind: 'invoke', name: 'call-mcp',
        invokeSpec: { mcp: 'code_review' },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator([
        createMockRestHandler(),
        createMockMcpHandler(),
      ]);
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.output).toHaveProperty('findings');
      }
    });

    it('returns failure for unknown binding type', async () => {
      const step: InvokeStep = {
        kind: 'invoke', name: 'bad',
        invokeSpec: { unknown_type: { foo: 'bar' } },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator([createMockRestHandler()]);
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('failure');
    });

    it('records successful invoke result in scope', async () => {
      const scope = new DefaultScenarioScope();
      const step: InvokeStep = {
        kind: 'invoke', name: 'my-invoke',
        invokeSpec: { mcp: 'file_search' },
        decorators: {},
      };
      const evaluator = new StructuralEvaluator([createMockMcpHandler()]);
      await evaluator.evaluate(step, makeContext({ scope }));
      expect(scope.resultStore().result('my-invoke')).toHaveProperty('results');
    });
  });

  describe('result recording', () => {
    it('records named step results in the store', async () => {
      const scope = new DefaultScenarioScope();
      const entry = makeEntry('action', stepSuccess({ v: 42 }));
      const step: PluginStep = {
        kind: 'plugin', name: 'my-step', entry, params: {}, decorators: {},
      };
      await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
      expect(scope.resultStore().result('my-step')).toEqual({ v: 42 });
    });
  });

  describe('delay step', () => {
    it('evaluates delay step with real-time wait', async () => {
      const step: DelayStep = { kind: 'delay', name: null, duration: 30, decorators: {} };
      const start = Date.now();
      const result = await new StructuralEvaluator().evaluate(step, makeContext());
      const elapsed = Date.now() - start;
      expect(result.kind).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    it('records named delay result', async () => {
      const scope = new DefaultScenarioScope();
      const step: DelayStep = { kind: 'delay', name: 'pause', duration: 10, decorators: {} };
      const result = await new StructuralEvaluator().evaluate(step, makeContext({ scope }));
      expect(result.kind).toBe('success');
      expect(scope.resultStore().hasCompleted('pause')).toBe(true);
    });
  });

  describe('race', () => {
    it('first branch to complete wins', async () => {
      const scope = new DefaultScenarioScope();
      const evaluator = new StructuralEvaluator();
      const _slowAction = makeAction(stepSuccess({ branch: 'slow' }));
      const _fastAction = makeAction(stepSuccess({ branch: 'fast' }));
      const step: RaceStep = {
        kind: 'race',
        name: null,
        steps: [
          { kind: 'plugin', name: 'slow', entry: makeEntry('slow', stepSuccess({ branch: 'slow' })), params: {}, decorators: {} },
          { kind: 'plugin', name: 'fast', entry: makeEntry('fast', stepSuccess({ branch: 'fast' })), params: {}, decorators: {} },
        ],
        decorators: {},
      };
      const ctx = makeContext({ scope });
      const result = await evaluator.evaluate(step, ctx);
      expect(result.kind).toBe('success');
      scope.close();
    });

    it('handles branch exceptions gracefully', async () => {
      const scope = new DefaultScenarioScope();
      const evaluator = new StructuralEvaluator();
      const throwAction: Action = { execute: () => { throw new Error('boom'); } };
      const step: RaceStep = {
        kind: 'race',
        name: null,
        steps: [
          { kind: 'plugin', name: 'thrower', entry: { qualifiedName: 'thrower', definition: { name: 'thrower', inputs: {}, outputs: {} }, action: throwAction }, params: {}, decorators: {} },
        ],
        decorators: {},
      };
      const ctx = makeContext({ scope });
      const result = await evaluator.evaluate(step, ctx);
      expect(result.kind).toBe('failure');
      scope.close();
    });
  });

  describe('emit-event step', () => {
    function makeEmitStep(
      events: Array<{ type: string; data: Record<string, unknown>; [k: string]: unknown }>,
      emitTo: 'scope' | 'pages-event' | 'both' = 'both',
      name: string | null = null,
    ): import('./walker.js').EmitEventStep {
      return { kind: 'emit-event', name, events, emitTo, decorators: {} };
    }

    it('emits a single event and returns success', async () => {
      const { DefaultEventEmitter } = await import('./emit-event-emitter.js');
      const emitter = new DefaultEventEmitter();
      const services = new MapServiceRegistry();
      services.register({ name: 'EventEmitter' }, emitter);
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([{ type: 'test.alert', data: { level: 'HIGH' } }]);
      const result = await evaluator.evaluate(step, makeContext({ services }));
      expect(result.kind).toBe('success');
      expect(emitter.emittedEvents).toHaveLength(1);
      expect(emitter.emittedEvents[0].type).toBe('test.alert');
      if (result.kind === 'success') {
        expect(result.output.emittedCount).toBe(1);
        expect(result.output.emittedTypes).toEqual(['test.alert']);
      }
    });

    it('emits batch events', async () => {
      const { DefaultEventEmitter } = await import('./emit-event-emitter.js');
      const emitter = new DefaultEventEmitter();
      const services = new MapServiceRegistry();
      services.register({ name: 'EventEmitter' }, emitter);
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([
        { type: 'a.b', data: { x: 1 } },
        { type: 'c.d', data: { y: 2 } },
      ]);
      const result = await evaluator.evaluate(step, makeContext({ services }));
      expect(result.kind).toBe('success');
      expect(emitter.emittedEvents).toHaveLength(2);
      if (result.kind === 'success') {
        expect(result.output.emittedCount).toBe(2);
        expect(result.output.emittedTypes).toEqual(['a.b', 'c.d']);
      }
    });

    it('routes to EventRouter when emitTo includes scope', async () => {
      const { DefaultEventEmitter } = await import('./emit-event-emitter.js');
      const emitter = new DefaultEventEmitter();
      const services = new MapServiceRegistry();
      services.register({ name: 'EventEmitter' }, emitter);
      let firedEvent: unknown = null;
      let firedContext: unknown = null;
      const mockRouter = {
        fire(event: unknown, context?: unknown) {
          firedEvent = event;
          firedContext = context;
          return true;
        },
      };
      services.register({ name: 'EventRouterRegistry' }, [mockRouter]);
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([{ type: 'test.alert', data: {} }], 'scope');
      await evaluator.evaluate(step, makeContext({ services }));
      expect(firedEvent).toBe('test.alert');
      expect((firedContext as { type: string }).type).toBe('test.alert');
    });

    it('does not fail when no EventRouterRegistry is registered', async () => {
      const { DefaultEventEmitter } = await import('./emit-event-emitter.js');
      const emitter = new DefaultEventEmitter();
      const services = new MapServiceRegistry();
      services.register({ name: 'EventEmitter' }, emitter);
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([{ type: 'a.b', data: {} }], 'scope');
      const result = await evaluator.evaluate(step, makeContext({ services }));
      expect(result.kind).toBe('success');
    });

    it('result contains emittedIds', async () => {
      const { DefaultEventEmitter } = await import('./emit-event-emitter.js');
      const emitter = new DefaultEventEmitter();
      const services = new MapServiceRegistry();
      services.register({ name: 'EventEmitter' }, emitter);
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([{ type: 'a.b', data: {} }]);
      const result = await evaluator.evaluate(step, makeContext({ services }));
      if (result.kind === 'success') {
        expect(result.output.emittedIds).toHaveLength(1);
        expect(typeof (result.output.emittedIds as string[])[0]).toBe('string');
      }
    });

    it('fails when EventEmitter service is not registered', async () => {
      const evaluator = new StructuralEvaluator();
      const step = makeEmitStep([{ type: 'a.b', data: {} }]);
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('failure');
    });
  });

  describe('typed error catch scope', () => {
    it('catch block receives ${error.type} from try failure category', async () => {
      const failEntry = makeEntry('fail', stepFailureWithCategory('timed out', 'TIMEOUT'));
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { expression: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: 'error-test', decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: 'will-fail', entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: 'catch-step', entry: captureEntry, params: { expression: '${error.type}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      const evaluator = new StructuralEvaluator();
      const result = await evaluator.evaluate(step, makeContext());
      expect(result.kind).toBe('success');
      expect(capturedValues['expression']).toBe('TIMEOUT');
    });

    it('catch block receives ${error.message}', async () => {
      const failEntry = makeEntry('fail', stepFailureWithCategory('connection refused', 'INFRASTRUCTURE'));
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { msg: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: 'fail', entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: null, entry: captureEntry, params: { msg: '${error.message}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      await new StructuralEvaluator().evaluate(step, makeContext());
      expect(capturedValues['msg']).toBe('connection refused');
    });

    it('catch block receives ${error.step} with named step', async () => {
      const failEntry = makeEntry('fail', stepFailure('boom'));
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { s: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: 'my-step', entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: null, entry: captureEntry, params: { s: '${error.step}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      await new StructuralEvaluator().evaluate(step, makeContext());
      expect(capturedValues['s']).toBe('my-step');
    });

    it('catch block receives fallback step path for unnamed step', async () => {
      const failEntry = makeEntry('fail', stepFailure('boom'));
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { s: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: null, entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: null, entry: captureEntry, params: { s: '${error.step}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      await new StructuralEvaluator().evaluate(step, makeContext());
      expect(capturedValues['s']).toBe('root → Step 0');
    });

    it('catch block receives ${error.detail.field} deep access', async () => {
      const failResult: Result = { kind: 'failure', message: 'fail', failureCategory: 'STEP_ACTION_FAILED', detail: { code: 504, reason: 'gateway' } };
      const failEntry = makeEntry('fail', failResult);
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { v: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: 'fail', entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: null, entry: captureEntry, params: { v: '${error.detail.reason}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      await new StructuralEvaluator().evaluate(step, makeContext());
      expect(capturedValues['v']).toBe('gateway');
    });

    it('defaults error.type to UNKNOWN when no failureCategory', async () => {
      const failEntry = makeEntry('fail', stepFailure('no category'));
      const capturedValues: Record<string, unknown> = {};
      const captureEntry: CatalogEntry = {
        qualifiedName: 'capture',
        definition: { name: 'capture', inputs: { t: { type: 'STRING' as any, required: true } }, outputs: {} },
        action: { execute: async (params) => { Object.assign(capturedValues, params); return stepSuccess({}); } },
      };

      const step: TryCatchFinallyStep = {
        kind: 'try-catch-finally', name: null, decorators: {}, annotations: [],
        trySteps: [{ kind: 'plugin', name: null, entry: failEntry, params: {}, decorators: {}, annotations: [] }],
        catchSteps: [{ kind: 'plugin', name: null, entry: captureEntry, params: { t: '${error.type}' }, decorators: {}, annotations: [] }],
        finallySteps: [],
      };

      await new StructuralEvaluator().evaluate(step, makeContext());
      expect(capturedValues['t']).toBe('UNKNOWN');
    });
  });

  describe('control step', () => {
    it('evaluates pause via consumer handle', async () => {
      const scope = new DefaultScenarioScope();
      const step: ControlStep = {
        kind: 'control', name: 'pause-worker', control: 'pause',
        target: 'worker-1', decorators: {}, annotations: [],
      };

      const evaluator = new StructuralEvaluator();
      const result = await evaluator.evaluate(step, makeContext({ scope }));

      expect(result.kind).toBe('success');
      expect((result as any).output['control']).toBe('pause');
      expect((result as any).output['target']).toBe('worker-1');
      expect(scope.consumer('worker-1').isPaused()).toBe(true);
    });

    it('evaluates resume via consumer handle', async () => {
      const scope = new DefaultScenarioScope();
      scope.consumer('worker-1').pause();
      expect(scope.consumer('worker-1').isPaused()).toBe(true);

      const step: ControlStep = {
        kind: 'control', name: 'resume-worker', control: 'resume',
        target: 'worker-1', decorators: {}, annotations: [],
      };

      const evaluator = new StructuralEvaluator();
      const result = await evaluator.evaluate(step, makeContext({ scope }));

      expect(result.kind).toBe('success');
      expect(scope.consumer('worker-1').isPaused()).toBe(false);
    });

    it('pause on unregistered target creates handle in paused state', async () => {
      const scope = new DefaultScenarioScope();
      const step: ControlStep = {
        kind: 'control', name: null, control: 'pause',
        target: 'unknown-consumer', decorators: {}, annotations: [],
      };

      const evaluator = new StructuralEvaluator();
      const result = await evaluator.evaluate(step, makeContext({ scope }));

      expect(result.kind).toBe('success');
      expect(scope.consumer('unknown-consumer').isPaused()).toBe(true);
    });
  });
});
