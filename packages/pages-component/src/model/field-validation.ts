import type { FieldSchema } from "./form-input-types.js";

export interface FieldViolation {
  readonly field: string;
  readonly constraint: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly message: string;
}

export function validateField(
  schema: FieldSchema,
  value: unknown,
  required: boolean,
): string | null {
  const isEmpty = value === null || value === undefined || value === '';

  if (required && isEmpty) return 'Required';
  if (isEmpty) return null;

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      return `Must be at least ${schema.minLength} characters`;
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      return `Must be at most ${schema.maxLength} characters`;
    }
    if (schema.pattern != null) {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) return 'Invalid format';
    }
    if (schema.enum != null && !schema.enum.includes(value)) {
      return `Must be one of: ${schema.enum.join(', ')}`;
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      return `Must be at least ${schema.minimum}`;
    }
    if (schema.maximum != null && value > schema.maximum) {
      return `Must be at most ${schema.maximum}`;
    }
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) {
      return `Must be greater than ${schema.exclusiveMinimum}`;
    }
    if (schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) {
      return `Must be less than ${schema.exclusiveMaximum}`;
    }
    if (schema.multipleOf != null && Math.abs(Math.round(value / schema.multipleOf) - value / schema.multipleOf) > 1e-9) {
      return `Must be a multiple of ${schema.multipleOf}`;
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      return `Must have at least ${schema.minItems} items`;
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      return `Must have at most ${schema.maxItems} items`;
    }
  }

  return null;
}

export function validateFieldAll(
  schema: FieldSchema,
  value: unknown,
  required: boolean,
): readonly FieldViolation[] {
  const violations: FieldViolation[] = [];
  const isEmpty = value === null || value === undefined || value === '';

  if (required && isEmpty) {
    violations.push({ field: '', constraint: 'required', params: {}, message: 'Required' });
  }
  if (isEmpty) return violations;

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      violations.push({ field: '', constraint: 'minLength', params: { min: schema.minLength }, message: `Must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      violations.push({ field: '', constraint: 'maxLength', params: { max: schema.maxLength }, message: `Must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern != null && !new RegExp(schema.pattern).test(value)) {
      violations.push({ field: '', constraint: 'pattern', params: { pattern: schema.pattern }, message: 'Invalid format' });
    }
    if (schema.enum != null && !schema.enum.includes(value)) {
      violations.push({ field: '', constraint: 'enum', params: { values: schema.enum }, message: `Must be one of: ${schema.enum.join(', ')}` });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      violations.push({ field: '', constraint: 'minimum', params: { min: schema.minimum }, message: `Must be at least ${schema.minimum}` });
    }
    if (schema.maximum != null && value > schema.maximum) {
      violations.push({ field: '', constraint: 'maximum', params: { max: schema.maximum }, message: `Must be at most ${schema.maximum}` });
    }
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) {
      violations.push({ field: '', constraint: 'exclusiveMinimum', params: { min: schema.exclusiveMinimum }, message: `Must be greater than ${schema.exclusiveMinimum}` });
    }
    if (schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) {
      violations.push({ field: '', constraint: 'exclusiveMaximum', params: { max: schema.exclusiveMaximum }, message: `Must be less than ${schema.exclusiveMaximum}` });
    }
    if (schema.multipleOf != null && Math.abs(Math.round(value / schema.multipleOf) - value / schema.multipleOf) > 1e-9) {
      violations.push({ field: '', constraint: 'multipleOf', params: { multipleOf: schema.multipleOf }, message: `Must be a multiple of ${schema.multipleOf}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      violations.push({ field: '', constraint: 'minItems', params: { min: schema.minItems }, message: `Must have at least ${schema.minItems} items` });
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      violations.push({ field: '', constraint: 'maxItems', params: { max: schema.maxItems }, message: `Must have at most ${schema.maxItems} items` });
    }
  }

  return violations;
}
