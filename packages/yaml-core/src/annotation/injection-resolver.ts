import type { Annotation } from './annotation-map.js';
import type { ServiceRegistry } from '../step/walker.js';

export class InjectionResolver {
  static resolve(
    annotations: Annotation[],
    params: Record<string, unknown>,
    services: ServiceRegistry,
  ): Record<string, unknown> {
    const augmented = { ...params };
    for (const ann of annotations) {
      if (ann.name !== 'Inject') continue;
      const typeName = ann.args['0'];
      if (!typeName) continue;
      try {
        const instance = services.lookup({ name: typeName });
        augmented[typeName] = instance;
      } catch {
        throw new Error(`@Inject failed: service '${typeName}' not found in registry`);
      }
    }
    return augmented;
  }
}
