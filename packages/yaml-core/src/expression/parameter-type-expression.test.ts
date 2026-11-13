import { describe, it, expect } from 'vitest';
import { ParameterValidator } from '../parameter-validator.js';
import { parseParameterType, validateParamValue, canAcceptType, parseValue, parseScalarParam } from '../types.js';

describe('ParameterType EXPRESSION', () => {
  it('parseParameterType recognizes EXPRESSION', () => {
    expect(parseParameterType('EXPRESSION')).toBe('EXPRESSION');
  });

  it('validateParamValue accepts string for EXPRESSION', () => {
    expect(validateParamValue('EXPRESSION', '.items | length')).toBe(true);
  });

  it('canAcceptType allows EXPRESSION to accept STRING', () => {
    expect(canAcceptType('EXPRESSION', 'STRING')).toBe(true);
  });
  it('preserves expression source while parsing values and defaults', () => {
    const source = '.items | map(.price) | add';
    expect(parseValue('EXPRESSION', source)).toEqual({ type: 'string', value: source });
    expect(parseScalarParam('EXPRESSION', source)).toBe(source);
  });

  it('validates expression strings and their constraints', () => {
    expect(ParameterValidator.validate(
      { filter: { type: 'EXPRESSION', required: true, minLength: 2 } },
      { filter: '.items | length' },
    )).toEqual([]);
    expect(ParameterValidator.validate(
      { filter: { type: 'EXPRESSION', required: true, minLength: 2 } },
      { filter: '.' },
    )).toEqual([expect.objectContaining({ parameterName: 'filter', constraint: 'minLength' })]);
  });

});
