import type { CatalogSource } from '../step-catalog.js';
import type { CatalogEntry } from '../step-walker.js';
import type { StepPluginRegistry } from '../step-plugin-registry.js';

export class RuntimePluginSource implements CatalogSource {
  readonly priority = 200;

  constructor(private readonly registry: StepPluginRegistry) {}

  populate(entries: Map<string, CatalogEntry>): void {
    const source = this.registry.createSource(this.priority);
    source.populate(entries);
  }
}
