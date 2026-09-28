import type { StepAction, StepResult, ServiceRegistry } from './step-walker.js';
import { stepFailure } from './step-walker.js';
import type { StepDefinition } from './step-types.js';
import { StepValidator } from './step-validator.js';

export class ValidatingStepAction implements StepAction {
  constructor(
    private readonly delegate: StepAction,
    private readonly definition: StepDefinition,
  ) {}

  async execute(params: Record<string, unknown>, services: ServiceRegistry): Promise<StepResult> {
    const inputViolations = StepValidator.validateInputs(this.definition.name, params, this.definition);
    if (inputViolations.length > 0) {
      return stepFailure(
        `Input validation failed for '${this.definition.name}': ` +
        inputViolations.map(v => v.message).join('; '),
      );
    }

    const result = await this.delegate.execute(params, services);

    if (result.kind === 'success' && Object.keys(this.definition.outputs).length > 0) {
      const outputViolations = StepValidator.validateOutputs(result.output, this.definition);
      if (outputViolations.length > 0) {
        return stepFailure(
          `Output validation failed for '${this.definition.name}': ` +
          outputViolations.map(v => v.message).join('; '),
        );
      }
    }

    return result;
  }
}
