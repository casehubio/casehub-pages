import type { InvokeHandler } from './invoke-handler.js';
import type { StepAction, StepResult } from '../step-walker.js';
import { stepSuccess, stepFailure } from '../step-walker.js';
import type { StepDefinition, InvokeBinding, AgentBinding } from '../step-types.js';

export type AgentInvoker = (descriptor: string, params: Record<string, unknown>, options: { model?: string; timeout?: string; structuredOutput: boolean }) => Promise<Record<string, unknown>>;

export class AgentInvokeHandler implements InvokeHandler {
  constructor(private readonly invoker: AgentInvoker) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'agent'; }

  create(definition: StepDefinition, binding: InvokeBinding): StepAction {
    const agentBinding = binding as AgentBinding;
    const invoker = this.invoker;
    return {
      async execute(params: Record<string, unknown>): Promise<StepResult> {
        try {
          const result = await invoker(agentBinding.descriptor, params, {
            ...(agentBinding.model !== undefined ? { model: agentBinding.model } : {}),
            ...(agentBinding.timeout !== undefined ? { timeout: agentBinding.timeout } : {}),
            structuredOutput: agentBinding.structuredOutput,
          });
          return stepSuccess(result);
        } catch (err) {
          return stepFailure(`Agent '${agentBinding.descriptor}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
