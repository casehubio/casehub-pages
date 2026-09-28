import type { InvokeHandler } from './invoke-handler.js';
import type { StepAction, StepResult } from '../step-walker.js';
import { stepSuccess, stepFailure } from '../step-walker.js';
import type { StepDefinition, InvokeBinding, GraphqlBinding } from '../step-types.js';

export class GraphqlInvokeHandler implements InvokeHandler {
  constructor(private readonly endpoint: string) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'graphql'; }

  create(definition: StepDefinition, binding: InvokeBinding): StepAction {
    const gqlBinding = binding as GraphqlBinding;
    const endpoint = this.endpoint;
    return {
      async execute(params: Record<string, unknown>): Promise<StepResult> {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gqlBinding.query, variables: params }),
          });
          const body = await response.json() as Record<string, unknown>;
          return stepSuccess(body);
        } catch (err) {
          return stepFailure(`GraphQL query failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
