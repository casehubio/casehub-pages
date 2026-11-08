import type { Action, Result, CatalogEntry, Catalog, ServiceRegistry } from '../../step/walker.js';
import { Walker, stepSuccess, stepFailure } from '../../step/walker.js';
import type { Definition } from '../../step/types.js';
import { StructuralEvaluator } from '../../step/structural-evaluator.js';
import type { Context } from '../../step/decorator-chain.js';

const runPlaybookDefinition: Definition = {
  name: 'run-playbook',
  inputs: { playbook: { type: 'STRING' as any, required: true } },
  outputs: {},
};

const runPlaybookAction: Action = {
  async execute(params: Record<string, unknown>, services: ServiceRegistry): Promise<Result> {
    const playbookSteps = params['playbook'];
    if (!Array.isArray(playbookSteps)) {
      return stepFailure('run-playbook: playbook must be an array of steps');
    }

    let catalog: Catalog;
    try {
      catalog = services.lookup<Catalog>({ name: 'Catalog' });
    } catch {
      return stepFailure('run-playbook: Catalog service not registered');
    }

    let evaluator: StructuralEvaluator;
    try {
      evaluator = services.lookup<StructuralEvaluator>({ name: 'StructuralEvaluator' });
    } catch {
      return stepFailure('run-playbook: StructuralEvaluator service not registered');
    }

    let context: Context;
    try {
      context = services.lookup<Context>({ name: 'TestContext' });
    } catch {
      return stepFailure('run-playbook: TestContext service not registered');
    }

    const resolved = Walker.resolve(playbookSteps as Record<string, unknown>[], catalog);
    let lastResult: Result = stepSuccess({});
    for (const step of resolved) {
      lastResult = await evaluator.evaluate(step, context);
      if (lastResult.kind === 'failure') return lastResult;
    }
    return lastResult;
  },
};

export function createRunPlaybookPlugin(): CatalogEntry {
  return { qualifiedName: 'run-playbook', definition: runPlaybookDefinition, action: runPlaybookAction };
}
