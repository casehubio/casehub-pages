import type { CatalogSource } from '../step-catalog.js';
import type { CatalogEntry } from '../step-walker.js';
import type { InvokeHandler } from '../invoke/invoke-handler.js';
import type { StepDefinition, StepParameter } from '../step-types.js';
import { ValidatingStepAction } from '../step-action.js';

export interface ScriptFileEntry {
  name: string;
  runtime: string;
  scriptPath: string;
  schema: { inputs: Record<string, StepParameter>; outputs: Record<string, StepParameter> };
}

export class ScriptSource implements CatalogSource {
  readonly priority = 400;

  constructor(
    private readonly scripts: ScriptFileEntry[],
    private readonly scriptHandler: InvokeHandler,
  ) {}

  populate(entries: Map<string, CatalogEntry>): void {
    for (const script of this.scripts) {
      if (!entries.has(script.name)) {
        const definition: StepDefinition = {
          name: script.name,
          inputs: script.schema.inputs,
          outputs: script.schema.outputs,
          invoke: {
            kind: 'script',
            runtime: script.runtime,
            script: script.scriptPath,
            timeout: '30s',
            env: {},
          },
        };
        const rawAction = this.scriptHandler.create(definition, definition.invoke!);
        const action = new ValidatingStepAction(rawAction, definition);
        entries.set(script.name, { qualifiedName: script.name, definition, action });
      }
    }
  }
}
