import { describe, it, expect } from 'vitest';
import { createVerifySimulationPlugin } from './verify-simulation-plugin.js';
import { MapServiceRegistry } from '../../step/walker.js';
import { SimulationRuntime } from '../../step/simulation-runtime.js';

describe('verify-simulation plugin', () => {
  const plugin = createVerifySimulationPlugin();

  function setupRuntime(actionName: string, callCount: number): MapServiceRegistry {
    const services = new MapServiceRegistry();
    const runtime = new SimulationRuntime();
    runtime.pushOverlay({ strategies: {}, corpus: [], capture: [] });
    for (let i = 0; i < callCount; i++) {
      runtime.recordJournal(actionName, 'test', { i }, { result: i }, 'STRUCTURALLY_VALID');
    }
    services.register({ name: 'SimulationRuntime' }, runtime);
    return services;
  }

  it('called — passes on exact match', async () => {
    const services = setupRuntime('rest-request', 3);
    const result = await plugin.action.execute({ action: 'rest-request', called: 3 }, services);
    expect(result.kind).toBe('success');
  });

  it('called — fails on mismatch', async () => {
    const services = setupRuntime('rest-request', 2);
    const result = await plugin.action.execute({ action: 'rest-request', called: 3 }, services);
    expect(result.kind).toBe('failure');
  });

  it('calledAtLeast — passes when above minimum', async () => {
    const services = setupRuntime('rest-request', 5);
    const result = await plugin.action.execute({ action: 'rest-request', calledAtLeast: 3 }, services);
    expect(result.kind).toBe('success');
  });

  it('calledAtMost — fails when above maximum', async () => {
    const services = setupRuntime('rest-request', 5);
    const result = await plugin.action.execute({ action: 'rest-request', calledAtMost: 3 }, services);
    expect(result.kind).toBe('failure');
  });

  it('neverCalled — passes when zero calls', async () => {
    const services = setupRuntime('other-action', 0);
    const result = await plugin.action.execute({ action: 'other-action', neverCalled: true }, services);
    expect(result.kind).toBe('success');
  });

  it('neverCalled — fails when called', async () => {
    const services = setupRuntime('rest-request', 1);
    const result = await plugin.action.execute({ action: 'rest-request', neverCalled: true }, services);
    expect(result.kind).toBe('failure');
  });

  it('fails when SimulationRuntime not registered', async () => {
    const result = await plugin.action.execute({ action: 'test' }, new MapServiceRegistry());
    expect(result.kind).toBe('failure');
  });

  it('has absorbSiblings true', () => {
    expect(plugin.definition.absorbSiblings).toBe(true);
  });
});
