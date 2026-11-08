import type { Action, Result, CatalogEntry, ServiceRegistry } from '../../step/walker.js';
import { stepSuccess, stepFailureWithCategory } from '../../step/walker.js';
import type { Definition } from '../../step/types.js';
import type { SimulationRuntime } from '../../step/simulation-runtime.js';

const verifySimulationDefinition: Definition = {
  name: 'verify-simulation',
  inputs: { action: { type: 'STRING' as any, required: true } },
  outputs: {},
  absorbSiblings: true,
};

const verifySimulationAction: Action = {
  async execute(params: Record<string, unknown>, services: ServiceRegistry): Promise<Result> {
    const actionName = String(params['action'] ?? params['_subject']);
    let runtime: SimulationRuntime;
    try {
      runtime = services.lookup<SimulationRuntime>({ name: 'SimulationRuntime' });
    } catch {
      return stepFailureWithCategory('verify-simulation: SimulationRuntime not registered', 'STEP_ACTION_FAILED');
    }

    const entries = runtime.allEntriesFor(actionName);
    const count = entries.length;

    if (params['called'] !== undefined && count !== Number(params['called'])) {
      return stepFailureWithCategory(`verify-simulation: '${actionName}' called ${count} times, expected ${params['called']}`, 'STEP_ACTION_FAILED');
    }
    if (params['calledAtLeast'] !== undefined && count < Number(params['calledAtLeast'])) {
      return stepFailureWithCategory(`verify-simulation: '${actionName}' called ${count} times, expected at least ${params['calledAtLeast']}`, 'STEP_ACTION_FAILED');
    }
    if (params['calledAtMost'] !== undefined && count > Number(params['calledAtMost'])) {
      return stepFailureWithCategory(`verify-simulation: '${actionName}' called ${count} times, expected at most ${params['calledAtMost']}`, 'STEP_ACTION_FAILED');
    }
    if (params['neverCalled'] === true && count > 0) {
      return stepFailureWithCategory(`verify-simulation: '${actionName}' was called ${count} times, expected never`, 'STEP_ACTION_FAILED');
    }

    return stepSuccess({ actionName, callCount: count });
  },
};

export function createVerifySimulationPlugin(): CatalogEntry {
  return { qualifiedName: 'verify-simulation', definition: verifySimulationDefinition, action: verifySimulationAction };
}
