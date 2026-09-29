import type { StepCatalog, StepResult } from '@casehubio/yaml-core/step';
import { stepFailure, MapServiceRegistry } from '@casehubio/yaml-core/step';

export interface CatalogExecuteRequest {
  actionName: string;
  params: Record<string, unknown>;
}

export function createCatalogExecuteHandler(
  catalog: StepCatalog,
): (req: CatalogExecuteRequest) => Promise<StepResult> {
  return async (req: CatalogExecuteRequest): Promise<StepResult> => {
    const entry = catalog.resolve(req.actionName);
    if (!entry) {
      return stepFailure(`Action '${req.actionName}' not found in catalog`);
    }

    const services = new MapServiceRegistry();

    try {
      return await entry.action.execute(req.params, services);
    } catch (err) {
      return stepFailure(
        `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };
}
