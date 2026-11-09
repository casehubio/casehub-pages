import { describe, it, expect } from 'vitest';
import { parseParameterType, validateParamValue, canAcceptType } from '../types.js';

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
});
