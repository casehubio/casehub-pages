import { describe, it, expect, vi } from 'vitest';
import { ValidatingStepAction } from './step-action.js';
import type { StepDefinition } from './step-types.js';
import type { StepAction, ServiceRegistry } from './step-walker.js';
import { stepSuccess, stepFailure } from './step-walker.js';

const services: ServiceRegistry = { lookup: () => { throw new Error('unused'); } };

function def(overrides?: Partial<StepDefinition>): StepDefinition {
  return { name: 'test-action', inputs: {}, outputs: {}, ...overrides };
}

describe('ValidatingStepAction', () => {
  it('passes valid inputs to delegate and returns result', async () => {
    const expected = stepSuccess({ message: 'ok' });
    const delegate: StepAction = { execute: vi.fn().mockResolvedValue(expected) };
    const action = new ValidatingStepAction(delegate, def({
      inputs: { name: { type: 'STRING', required: true } },
    }));
    const result = await action.execute({ name: 'hello' }, services);
    expect(result).toBe(expected);
    expect(delegate.execute).toHaveBeenCalledWith({ name: 'hello' }, services);
  });

  it('returns failure when required input missing', async () => {
    const delegate: StepAction = { execute: vi.fn() };
    const action = new ValidatingStepAction(delegate, def({
      inputs: { name: { type: 'STRING', required: true } },
    }));
    const result = await action.execute({}, services);
    expect(result.kind).toBe('failure');
    expect(delegate.execute).not.toHaveBeenCalled();
  });

  it('returns failure when input has wrong type', async () => {
    const delegate: StepAction = { execute: vi.fn() };
    const action = new ValidatingStepAction(delegate, def({
      inputs: { count: { type: 'INTEGER', required: true } },
    }));
    const result = await action.execute({ count: 'not-a-number' }, services);
    expect(result.kind).toBe('failure');
    expect(delegate.execute).not.toHaveBeenCalled();
  });

  it('validates outputs on success — returns failure when output violates', async () => {
    const delegate: StepAction = { execute: vi.fn().mockResolvedValue(stepSuccess({ result: 42 })) };
    const action = new ValidatingStepAction(delegate, def({
      outputs: { result: { type: 'STRING', required: true } },
    }));
    const result = await action.execute({}, services);
    expect(result.kind).toBe('failure');
  });

  it('skips output validation when definition has no outputs', async () => {
    const expected = stepSuccess({ anything: 123 });
    const delegate: StepAction = { execute: vi.fn().mockResolvedValue(expected) };
    const action = new ValidatingStepAction(delegate, def());
    const result = await action.execute({}, services);
    expect(result).toBe(expected);
  });

  it('passes through delegate failure without output validation', async () => {
    const expected = stepFailure('boom');
    const delegate: StepAction = { execute: vi.fn().mockResolvedValue(expected) };
    const action = new ValidatingStepAction(delegate, def({
      outputs: { result: { type: 'STRING', required: true } },
    }));
    const result = await action.execute({}, services);
    expect(result).toBe(expected);
  });
});
