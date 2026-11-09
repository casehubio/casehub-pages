import { describe, it, expect } from 'vitest';
import { JsExpressionEngine } from './js-expression-engine.js';

describe('JsExpressionEngine', () => {
  const engine = new JsExpressionEngine();

  it('has type js', () => {
    expect(engine.type).toBe('js');
  });

  describe('compile + eval', () => {
    it('evaluates arithmetic expression', () => {
      const compiled = engine.compile('a + b');
      expect(compiled.eval({ a: 3, b: 4 })).toBe(7);
    });

    it('evaluates boolean condition', () => {
      const compiled = engine.compile('count > 0');
      expect(compiled.eval({ count: 5 })).toBe(true);
      expect(compiled.eval({ count: 0 })).toBe(false);
    });

    it('evaluates string concatenation', () => {
      const compiled = engine.compile("firstName + ' ' + lastName");
      expect(compiled.eval({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    });

    it('evaluates ternary', () => {
      const compiled = engine.compile("status === 'active' ? 'yes' : 'no'");
      expect(compiled.eval({ status: 'active' })).toBe('yes');
      expect(compiled.eval({ status: 'inactive' })).toBe('no');
    });

    it('evaluates complex boolean expressions', () => {
      const compiled = engine.compile('age >= 18 && active');
      expect(compiled.eval({ age: 21, active: true })).toBe(true);
      expect(compiled.eval({ age: 16, active: true })).toBe(false);
    });

    it('provides access to context properties without ctx prefix', () => {
      const compiled = engine.compile('itemCount');
      expect(compiled.eval({ itemCount: 42 })).toBe(42);
    });
  });

  describe('validate', () => {
    it('does not throw for valid syntax', () => {
      expect(() => engine.validate('x > 0')).not.toThrow();
    });

    it('throws for invalid syntax', () => {
      expect(() => engine.validate('if {')).toThrow();
    });
  });
});
