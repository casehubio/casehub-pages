import type { InvokeHandler } from './invoke-handler.js';
import type { StepAction, StepResult } from '../step-walker.js';
import { stepSuccess, stepFailure } from '../step-walker.js';
import type { StepDefinition, InvokeBinding, RestBinding } from '../step-types.js';

export class RestInvokeHandler implements InvokeHandler {
  supports(binding: InvokeBinding): boolean { return binding.kind === 'rest'; }

  create(definition: StepDefinition, binding: InvokeBinding): StepAction {
    const restBinding = binding as RestBinding;
    return {
      async execute(params: Record<string, unknown>): Promise<StepResult> {
        try {
          const response = await fetch(restBinding.url, {
            method: restBinding.method,
            headers: { 'Content-Type': 'application/json', ...restBinding.headers },
            body: restBinding.method !== 'GET' ? JSON.stringify({ ...restBinding.body, ...params }) : undefined,
          });
          const body = await response.json() as Record<string, unknown>;
          return stepSuccess(body);
        } catch (err) {
          return stepFailure(`REST call to '${restBinding.url}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
