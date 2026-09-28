import { describe, it, expect } from 'vitest';
import { StepValidator } from './step-validator.js';
import type { StepParameter } from './step-types.js';

function param(overrides: Partial<StepParameter> & { type: StepParameter['type'] }): StepParameter {
  return { required: false, ...overrides };
}

describe('StepValidator', () => {
  describe('validateInputs', () => {
    it('missing required param with no default produces violation', () => {
      const violations = StepValidator.validateInputs('test', {}, {
        inputs: { name: param({ type: 'STRING', required: true }) },
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]!.constraint).toBe('required');
    });

    it('missing optional param produces no violation', () => {
      const violations = StepValidator.validateInputs('test', {}, {
        inputs: { name: param({ type: 'STRING' }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('missing required with default produces no violation', () => {
      const violations = StepValidator.validateInputs('test', {}, {
        inputs: { name: param({ type: 'STRING', required: true, defaultValue: 'fallback' }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('wrong type produces type violation', () => {
      const violations = StepValidator.validateInputs('test', { count: 'not-a-number' }, {
        inputs: { count: param({ type: 'INTEGER', required: true }) },
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]!.constraint).toBe('type');
    });

    it('correct STRING produces no violation', () => {
      const violations = StepValidator.validateInputs('test', { name: 'hello' }, {
        inputs: { name: param({ type: 'STRING', required: true }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('correct INTEGER produces no violation', () => {
      const violations = StepValidator.validateInputs('test', { count: 42 }, {
        inputs: { count: param({ type: 'INTEGER', required: true }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('correct NUMBER produces no violation', () => {
      const violations = StepValidator.validateInputs('test', { rate: 3.14 }, {
        inputs: { rate: param({ type: 'NUMBER', required: true }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('correct BOOLEAN produces no violation', () => {
      const violations = StepValidator.validateInputs('test', { flag: true }, {
        inputs: { flag: param({ type: 'BOOLEAN', required: true }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('allowedValues violation when value not in list', () => {
      const violations = StepValidator.validateInputs('test', { status: 'UNKNOWN' }, {
        inputs: { status: param({ type: 'STRING', required: true, allowedValues: ['ACTIVE', 'INACTIVE'] }) },
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]!.constraint).toBe('allowedValues');
    });

    it('allowedValues passes when value is in list', () => {
      const violations = StepValidator.validateInputs('test', { status: 'ACTIVE' }, {
        inputs: { status: param({ type: 'STRING', required: true, allowedValues: ['ACTIVE', 'INACTIVE'] }) },
      });
      expect(violations).toHaveLength(0);
    });

    it('format date validates YYYY-MM-DD pattern', () => {
      const input = param({ type: 'STRING', required: true, format: 'date' });
      expect(StepValidator.validateInputs('test', { d: '2026-01-15' }, { inputs: { d: input } })).toHaveLength(0);
      expect(StepValidator.validateInputs('test', { d: 'not-a-date' }, { inputs: { d: input } })).toHaveLength(1);
    });

    it('format date-time validates parseable dates', () => {
      const input = param({ type: 'STRING', required: true, format: 'date-time' });
      expect(StepValidator.validateInputs('test', { d: '2026-01-15T10:30:00Z' }, { inputs: { d: input } })).toHaveLength(0);
      expect(StepValidator.validateInputs('test', { d: 'garbage' }, { inputs: { d: input } })).toHaveLength(1);
    });

    it('format uri validates URL format', () => {
      const input = param({ type: 'STRING', required: true, format: 'uri' });
      expect(StepValidator.validateInputs('test', { u: 'https://example.com' }, { inputs: { u: input } })).toHaveLength(0);
      expect(StepValidator.validateInputs('test', { u: 'not a url' }, { inputs: { u: input } })).toHaveLength(1);
    });

    it('unknown format passes without validation', () => {
      const input = param({ type: 'STRING', required: true, format: 'custom-thing' });
      expect(StepValidator.validateInputs('test', { v: 'anything' }, { inputs: { v: input } })).toHaveLength(0);
    });
  });

  describe('validateOutputs', () => {
    it('applies same validation logic to outputs', () => {
      const violations = StepValidator.validateOutputs({ result: 42 }, {
        outputs: { result: param({ type: 'STRING', required: true }) },
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]!.constraint).toBe('type');
    });
  });
});
