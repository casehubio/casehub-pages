import type { CatalogSource } from '../step-catalog.js';
import type { CatalogEntry } from '../step-walker.js';
import type { InvokeHandler } from '../invoke/invoke-handler.js';
import type { StepDefinitionFile } from '../step-types.js';
import { StepDefinitionParser } from '../step-definition-parser.js';
import { ValidatingStepAction } from '../step-action.js';

export class YamlStepDefinitionSource implements CatalogSource {
  readonly priority = 100;
  private readonly files: StepDefinitionFile[] = [];
  private readonly handlers: InvokeHandler[] = [];

  constructor(handlers: InvokeHandler[]) {
    this.handlers = [...handlers];
  }

  addFile(raw: Record<string, unknown>): void {
    this.files.push(StepDefinitionParser.parse(raw));
  }

  addParsedFile(file: StepDefinitionFile): void {
    this.files.push(file);
  }

  populate(entries: Map<string, CatalogEntry>): void {
    for (const file of this.files) {
      for (const [name, definition] of Object.entries(file.actions)) {
        const qualifiedName = file.namespace ? `${file.namespace}.${name}` : name;
        if (definition.invoke) {
          const handler = this.handlers.find(h => h.supports(definition.invoke!));
          if (handler) {
            const rawAction = handler.create(definition, definition.invoke);
            const action = new ValidatingStepAction(rawAction, definition);
            if (!entries.has(qualifiedName)) {
              entries.set(qualifiedName, { qualifiedName, definition, action });
            }
            if (file.namespace && !entries.has(name)) {
              entries.set(name, { qualifiedName, definition, action });
            }
          }
        }
      }
    }
  }
}
