import { describe, it, expect, vi } from 'vitest';
import type { StepAction, StepResult, ServiceRegistry } from './step-walker.js';
import { stepSuccess, stepFailure } from './step-walker.js';
import { DecoratorChain } from './decorator-chain.js';
import type { StepContext } from './decorator-chain.js';
import { DefaultScenarioScope } from '../orchestration/scenario-scope.js';

function mockAction(result: StepResult = stepSuccess({})): StepAction {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function mockContext(overrides: Partial<StepContext> = {}): StepContext {
  return {
    params: {},
    services: { lookup: () => { throw new Error('no service'); } },
    scope: new DefaultScenarioScope(),
    stepName: 'test-step',
    ...overrides,
  };
}

describe('DecoratorChain', () => {
  describe('build with no decorators', () => {
    it('wraps action directly', async () => {
      const action = mockAction(stepSuccess({ out: 1 }));
      const chain = DecoratorChain.build({}, action);
      const result = await chain.execute(mockContext({ params: { a: 'b' } }));
      expect(result.kind).toBe('success');
      expect(action.execute).toHaveBeenCalledWith({ a: 'b' }, expect.anything());
    });
  });

  describe('when/if decorator', () => {
    it('executes when condition is truthy', async () => {
      const action = mockAction(stepSuccess({ v: 1 }));
      const chain = DecoratorChain.build({ 'if': 'true' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      expect(action.execute).toHaveBeenCalled();
    });

    it('skips execution when condition is falsy', async () => {
      const action = mockAction();
      const chain = DecoratorChain.build({ 'if': 'false' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      expect(action.execute).not.toHaveBeenCalled();
    });
  });

  describe('loop decorator', () => {
    it('repeats execution count times', async () => {
      const action = mockAction(stepSuccess({ v: 1 }));
      const chain = DecoratorChain.build({ loop: 3 }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      expect(action.execute).toHaveBeenCalledTimes(3);
    });

    it('stops on failure', async () => {
      let callCount = 0;
      const action: StepAction = {
        execute: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 2
            ? Promise.resolve(stepFailure('boom'))
            : Promise.resolve(stepSuccess({}));
        }),
      };
      const chain = DecoratorChain.build({ loop: 5 }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('failure');
      expect(action.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry decorator', () => {
    it('retries on failure up to max', async () => {
      let callCount = 0;
      const action: StepAction = {
        execute: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount < 3
            ? Promise.resolve(stepFailure('transient'))
            : Promise.resolve(stepSuccess({ ok: true }));
        }),
      };
      const chain = DecoratorChain.build({ retry: 3 }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      expect(action.execute).toHaveBeenCalledTimes(3);
    });

    it('returns last failure when retries exhausted', async () => {
      const action = mockAction(stepFailure('persistent'));
      const chain = DecoratorChain.build({ retry: 2 }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('failure');
      expect(action.execute).toHaveBeenCalledTimes(2);
    });

    it('does not retry on success', async () => {
      const action = mockAction(stepSuccess({}));
      const chain = DecoratorChain.build({ retry: 3 }, action);
      await chain.execute(mockContext());
      expect(action.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout decorator', () => {
    it('passes through when execution completes in time', async () => {
      const action = mockAction(stepSuccess({ v: 1 }));
      const chain = DecoratorChain.build({ timeout: '1s' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
    });

    it('returns failure when execution exceeds timeout', async () => {
      const action: StepAction = {
        execute: () => new Promise((resolve) => setTimeout(() => resolve(stepSuccess({})), 500)),
      };
      const chain = DecoratorChain.build({ timeout: '10ms' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.message).toContain('timeout');
      }
    });
  });

  describe('delay decorator', () => {
    it('delays execution by specified duration', async () => {
      const action = mockAction(stepSuccess({}));
      const chain = DecoratorChain.build({ delay: '10ms' }, action);
      const start = Date.now();
      await chain.execute(mockContext());
      expect(Date.now() - start).toBeGreaterThanOrEqual(8);
      expect(action.execute).toHaveBeenCalled();
    });
  });

  describe('semaphore decorator', () => {
    it('acquires and releases semaphore around execution', async () => {
      const scope = new DefaultScenarioScope();
      const sem = scope.semaphore('test-sem', 1);
      const action = mockAction(stepSuccess({}));
      const chain = DecoratorChain.build({ semaphore: 'test-sem' }, action);
      await chain.execute(mockContext({ scope }));
      expect(sem.availablePermits()).toBe(1);
      expect(action.execute).toHaveBeenCalled();
    });

    it('releases semaphore even on failure', async () => {
      const scope = new DefaultScenarioScope();
      const sem = scope.semaphore('fail-sem', 1);
      const action: StepAction = {
        execute: () => { throw new Error('boom'); },
      };
      const chain = DecoratorChain.build({ semaphore: 'fail-sem' }, action);
      const result = await chain.execute(mockContext({ scope }));
      expect(result.kind).toBe('failure');
      expect(sem.availablePermits()).toBe(1);
    });
  });

  describe('signal decorator', () => {
    it('fires signal after successful execution', async () => {
      const scope = new DefaultScenarioScope();
      const sig = scope.signal('done-signal');
      const action = mockAction(stepSuccess({}));
      const chain = DecoratorChain.build({ signal: 'done-signal' }, action);
      expect(sig.isSignalled()).toBe(false);
      await chain.execute(mockContext({ scope }));
      expect(sig.isSignalled()).toBe(true);
    });

    it('does not fire signal on failure', async () => {
      const scope = new DefaultScenarioScope();
      const sig = scope.signal('no-fire');
      const action = mockAction(stepFailure('oops'));
      const chain = DecoratorChain.build({ signal: 'no-fire' }, action);
      await chain.execute(mockContext({ scope }));
      expect(sig.isSignalled()).toBe(false);
    });
  });

  describe('on-error decorator', () => {
    it('catches exceptions and returns failure', async () => {
      const action: StepAction = {
        execute: () => { throw new Error('unhandled'); },
      };
      const chain = DecoratorChain.build({ 'on-error': 'continue' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('failure');
    });

    it('passes through normal results', async () => {
      const action = mockAction(stepSuccess({ v: 1 }));
      const chain = DecoratorChain.build({ 'on-error': 'continue' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
    });
  });

  describe('transform decorator', () => {
    it('merges transform entries into output on success', async () => {
      const action = mockAction(stepSuccess({ original: 'value' }));
      const chain = DecoratorChain.build({
        transform: { added: 'new-value' },
      }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.output['original']).toBe('value');
        expect(result.output['added']).toBe('new-value');
      }
    });

    it('does not transform on failure', async () => {
      const action = mockAction(stepFailure('oops'));
      const chain = DecoratorChain.build({ transform: { x: 'y' } }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('failure');
    });
  });

  describe('on-success / on-failure decorator', () => {
    it('records on-success handler name in metadata on success', async () => {
      const action = mockAction(stepSuccess({}));
      const chain = DecoratorChain.build({ 'on-success': 'notify-step' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.executionMetadata['on-success']).toBe('notify-step');
      }
    });

    it('converts failure to success with handler metadata when on-failure set', async () => {
      const action = mockAction(stepFailure('oops'));
      const chain = DecoratorChain.build({ 'on-failure': 'alert-step' }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.output['__on-failure']).toBe('alert-step');
        expect(result.output['__failure']).toBe('oops');
      }
    });
  });

  describe('composition', () => {
    it('applies decorators in correct order: if → loop → retry', async () => {
      let callCount = 0;
      const action: StepAction = {
        execute: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount <= 2
            ? Promise.resolve(stepFailure('fail'))
            : Promise.resolve(stepSuccess({ n: callCount }));
        }),
      };
      const chain = DecoratorChain.build({
        'if': 'true',
        loop: 2,
        retry: 3,
      }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
    });

    it('skips everything when if is false even with other decorators', async () => {
      const action = mockAction();
      const chain = DecoratorChain.build({
        'if': 'false',
        loop: 10,
        retry: 5,
        delay: '100ms',
      }, action);
      const result = await chain.execute(mockContext());
      expect(result.kind).toBe('success');
      expect(action.execute).not.toHaveBeenCalled();
    });
  });
});
