import type { InvokeHandler } from './invoke-handler.js';
import type { StepAction, StepResult } from '../step-walker.js';
import { stepSuccess, stepFailure } from '../step-walker.js';
import type { StepDefinition, InvokeBinding, McpBinding } from '../step-types.js';

export type McpToolInvoker = (tool: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class McpInvokeHandler implements InvokeHandler {
  constructor(private readonly invoker: McpToolInvoker) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'mcp'; }

  create(definition: StepDefinition, binding: InvokeBinding): StepAction {
    const mcpBinding = binding as McpBinding;
    const invoker = this.invoker;
    return {
      async execute(params: Record<string, unknown>): Promise<StepResult> {
        try {
          const result = await invoker(mcpBinding.tool, params);
          return stepSuccess(result);
        } catch (err) {
          return stepFailure(`MCP tool '${mcpBinding.tool}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
