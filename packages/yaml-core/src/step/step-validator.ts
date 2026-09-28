import type { StepParameter } from './step-types.js';
import { validateStepParamValue, isScalarStepParam } from '../types.js';

export interface StepViolation {
  parameterName: string;
  constraint: string;
  message: string;
}

export class StepValidator {
  static validateInputs(
    actionName: string,
    params: Record<string, unknown>,
    definition: { inputs: Record<string, StepParameter> },
  ): StepViolation[] {
    return StepValidator.validateParams(actionName, params, definition.inputs, 'input');
  }

  static validateOutputs(
    outputs: Record<string, unknown>,
    definition: { outputs: Record<string, StepParameter> },
  ): StepViolation[] {
    return StepValidator.validateParams('output', outputs, definition.outputs, 'output');
  }

  private static validateParams(
    context: string,
    values: Record<string, unknown>,
    declarations: Record<string, StepParameter>,
    direction: string,
  ): StepViolation[] {
    const violations: StepViolation[] = [];

    for (const [name, param] of Object.entries(declarations)) {
      const value = values[name];
      if (value === undefined || value === null) {
        if (param.required && param.defaultValue === undefined) {
          violations.push({ parameterName: name, constraint: 'required', message: `Required ${direction} '${name}' is missing` });
        }
        continue;
      }
      if (!validateStepParamValue(param.type, value)) {
        violations.push({ parameterName: name, constraint: 'type', message: `${direction} '${name}' expected ${param.type} but got ${typeof value}` });
      }
      if (param.allowedValues && param.allowedValues.length > 0) {
        const canonical = isScalarStepParam(param.type) ? String(value) : value;
        if (!param.allowedValues.some(a => a === canonical || a === String(canonical))) {
          violations.push({ parameterName: name, constraint: 'allowedValues', message: `${direction} '${name}' value '${value}' not in allowed values: ${param.allowedValues.join(', ')}` });
        }
      }
      if (param.format && typeof value === 'string') {
        if (!StepValidator.validateFormat(value, param.format)) {
          violations.push({ parameterName: name, constraint: 'format', message: `${direction} '${name}' does not match format '${param.format}'` });
        }
      }
    }
    return violations;
  }

  private static validateFormat(value: string, format: string): boolean {
    switch (format) {
      case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(value);
      case 'date-time': return !isNaN(Date.parse(value));
      case 'uri': { try { new URL(value); return true; } catch { return false; } }
      default: return true;
    }
  }
}
