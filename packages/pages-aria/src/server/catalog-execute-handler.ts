import type { Catalog, Result } from '@casehubio/yaml-core/step';
import { stepFailure, MapServiceRegistry } from '@casehubio/yaml-core/step';

export interface CatalogExecuteRequest {
  actionName: string;
  params: Record<string, unknown>;
}

export function createCatalogExecuteHandler(
  catalog: Catalog,
): (req: CatalogExecuteRequest) => Promise<Result> {
  return async (req: CatalogExecuteRequest): Promise<Result> => {
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
