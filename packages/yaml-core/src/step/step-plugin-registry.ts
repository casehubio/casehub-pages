import type { StepAction, CatalogEntry } from './step-walker.js';
import type { StepDefinition, StepParameter } from './step-types.js';
import type { CatalogSource } from './step-catalog.js';

export interface PluginRegistration {
  name: string;
  description?: string;
  inputs: Record<string, StepParameter>;
  outputs: Record<string, StepParameter>;
  execute: StepAction['execute'];
}

export class StepPluginRegistry {
  private readonly plugins = new Map<string, PluginRegistration>();

  register(plugin: PluginRegistration): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  createSource(priority = 200): CatalogSource {
    const plugins = this.plugins;
    return {
      priority,
      populate(entries: Map<string, CatalogEntry>): void {
        for (const [name, plugin] of plugins) {
          if (!entries.has(name)) {
            const definition: StepDefinition = {
              name: plugin.name,
              description: plugin.description,
              inputs: plugin.inputs,
              outputs: plugin.outputs,
            };
            const action: StepAction = { execute: plugin.execute };
            entries.set(name, { qualifiedName: name, definition, action });
          }
        }
      },
    };
  }
}
