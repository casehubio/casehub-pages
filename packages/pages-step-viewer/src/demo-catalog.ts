import type { Catalog } from '@casehubio/yaml-core/step';

export const demoCatalog: Catalog = {
  resolve(name: string) {
    return {
      qualifiedName: name,
      definition: { name, inputs: {}, outputs: {} },
      action: { execute: async () => ({ kind: 'success' as const, output: {}, executionMetadata: {} }) },
    };
  },
  availableActions() { return new Set<string>(); },
};
