import type { Catalog, CatalogEntry } from '../../step/walker.js';
import { createAssertPlugin } from './assert-plugin.js';
import { createAssertThatPlugin } from './assert-that-plugin.js';
import { createVerifySimulationPlugin } from './verify-simulation-plugin.js';
import { createRunPlaybookPlugin } from './run-playbook-plugin.js';
import { createValidatePlaybookPlugin } from './validate-playbook-plugin.js';

export class TestCatalog implements Catalog {
  private readonly entries: Map<string, CatalogEntry>;

  constructor() {
    this.entries = new Map([
      ['assert', createAssertPlugin()],
      ['assertThat', createAssertThatPlugin()],
      ['verify-simulation', createVerifySimulationPlugin()],
      ['run-playbook', createRunPlaybookPlugin()],
      ['validate-playbook', createValidatePlaybookPlugin()],
    ]);
  }

  resolve(actionName: string): CatalogEntry | undefined {
    return this.entries.get(actionName);
  }

  availableActions(): Set<string> {
    return new Set(this.entries.keys());
  }
}
