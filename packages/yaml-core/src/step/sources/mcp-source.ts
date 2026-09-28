import type { CatalogSource } from '../step-catalog.js';
import type { CatalogEntry, StepAction, StepResult } from '../step-walker.js';
import { stepSuccess, stepFailure } from '../step-walker.js';
import type { StepDefinition } from '../step-types.js';

export type McpToolInvoker = (toolName: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class McpToolSource implements CatalogSource {
  readonly priority = 300;

  constructor(
    private readonly tools: Map<string, StepDefinition>,
    private readonly invoker: McpToolInvoker,
  ) {}

  populate(entries: Map<string, CatalogEntry>): void {
    for (const [name, definition] of this.tools) {
      if (!entries.has(name)) {
        const invoker = this.invoker;
        const action: StepAction = {
          async execute(params: Record<string, unknown>): Promise<StepResult> {
            try {
              const result = await invoker(name, params);
              return stepSuccess(result);
            } catch (err) {
              return stepFailure(`MCP tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          },
        };
        entries.set(name, { qualifiedName: name, definition, action });
      }
    }
  }
}
