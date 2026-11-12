import type { Action, Result, CatalogEntry, Catalog, ServiceRegistry } from '../../step/walker.js';
import { Walker, stepSuccess, stepFailure } from '../../step/walker.js';
import type { Definition } from '../../step/types.js';

const validatePlaybookDefinition: Definition = {
  name: 'validate-playbook',
  inputs: { playbook: { type: 'STRING' as any, required: true } },
  outputs: {
    stepCount: { type: 'STRING' as any, required: false },
    stepNames: { type: 'STRING' as any, required: false },
  },
};

const validatePlaybookAction: Action = {
  async execute(params: Record<string, unknown>, services: ServiceRegistry): Promise<Result> {
    const playbookSteps = params['playbook'];
    if (!Array.isArray(playbookSteps)) {
      return stepFailure('validate-playbook: playbook must be an array of steps');
    }

    let catalog: Catalog;
    try {
      catalog = services.lookup<Catalog>({ name: 'Catalog' });
    } catch {
      return stepFailure('validate-playbook: Catalog service not registered');
    }

    try {
      const resolved = Walker.resolve(playbookSteps as Record<string, unknown>[], catalog);
      const stepNames = resolved.map(s => s.name).filter(Boolean);
      return stepSuccess({
        stepCount: resolved.length,
        stepNames,
        valid: true,
      });
    } catch (e) {
      return stepFailure(`validate-playbook: compilation failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  },
};

export function createValidatePlaybookPlugin(): CatalogEntry {
  return { qualifiedName: 'validate-playbook', definition: validatePlaybookDefinition, action: validatePlaybookAction };
}
