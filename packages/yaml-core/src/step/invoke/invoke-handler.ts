import type { StepAction } from '../step-walker.js';
import type { StepDefinition, InvokeBinding } from '../step-types.js';

export interface InvokeHandler {
  supports(binding: InvokeBinding): boolean;
  create(definition: StepDefinition, binding: InvokeBinding): StepAction;
}
