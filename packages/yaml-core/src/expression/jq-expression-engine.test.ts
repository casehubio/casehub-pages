import { describe, it, expect } from 'vitest';
import { JqExpressionEngine } from './jq-expression-engine.js';

describe('JqExpressionEngine', () => {
  const engine = new JqExpressionEngine();

  it('has type jq', () => {
    expect(engine.type).toBe('jq');
  });

  describe('compile + eval', () => {
    it('evaluates identity expression', () => {
      const compiled = engine.compile('.');
      expect(compiled.eval({ x: 1 })).toEqual({ x: 1 });
    });

    it('evaluates field access', () => {
      const compiled = engine.compile('.name');
      expect(compiled.eval({ name: 'Alice' })).toBe('Alice');
    });

    it('evaluates arithmetic', () => {
      const compiled = engine.compile('.a + .b');
      expect(compiled.eval({ a: 3, b: 4 })).toBe(7);
    });

    it('evaluates pipe filter', () => {
      const compiled = engine.compile('.items | length');
      expect(compiled.eval({ items: [1, 2, 3] })).toBe(3);
    });

    it('evaluates object construction', () => {
      const compiled = engine.compile('{ total: (.a + .b) }');
      expect(compiled.eval({ a: 10, b: 20 })).toEqual({ total: 30 });
    });

    it('returns first result for multi-result expressions (scalar semantics)', () => {
      const compiled = engine.compile('.items[]');
      expect(compiled.eval({ items: [1, 2, 3] })).toBe(1);
    });
  });

  describe('validate', () => {
    it('does not throw for valid syntax', () => {
      expect(() => engine.validate('.name')).not.toThrow();
    });

    it('throws for invalid syntax', () => {
      expect(() => engine.validate('.[')).toThrow();
    });
  });
});
