import { describe, it, expect } from 'vitest';
import { DescriptiveExpression } from './compiled-expression.js';
import { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

function stubEngine(engineType: string): ExpressionEngine {
  return {
    type: engineType,
    compile(expression: string): CompiledExpression {
      return {
        type: engineType,
        eval(context) { return `${engineType}:${expression}:${JSON.stringify(context)}`; },
      };
    },
    validate(_expression: string): void { /* no-op */ },
  };
}

describe('DescriptiveExpression', () => {
  it('returns structured description with not-available status', () => {
    const expr = new DescriptiveExpression('mvel', 'x > 0');
    const ctx = { x: 42 };
    const result = expr.eval(ctx);

    expect(result).toEqual({
      engine: 'mvel',
      expression: 'x > 0',
      context: { x: 42 },
      status: 'not-available',
    });
  });

  it('has type descriptive', () => {
    const expr = new DescriptiveExpression('mvel', 'x > 0');
    expect(expr.type).toBe('descriptive');
  });
});

describe('DefaultExpressionEngineRegistry', () => {
  it('registers and resolves engines by type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const engine = stubEngine('test');
    registry.register(engine);
    expect(registry.resolve('test')).toBe(engine);
  });

  it('returns undefined for unregistered engine type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    expect(registry.resolve('unknown')).toBeUndefined();
  });

  it('compiles via registered engine', () => {
    const registry = new DefaultExpressionEngineRegistry();
    registry.register(stubEngine('test'));
    const compiled = registry.compile('test', 'x + 1');
    expect(compiled.type).toBe('test');
    expect(compiled.eval({ x: 1 })).toBe('test:x + 1:{"x":1}');
  });

  it('returns DescriptiveExpression for unknown engine type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const compiled = registry.compile('mvel', '.items');
    expect(compiled.type).toBe('descriptive');
    const result = compiled.eval({ items: [1] });
    expect(result).toEqual({
      engine: 'mvel',
      expression: '.items',
      context: { items: [1] },
      status: 'not-available',
    });
  });

  it('caches compiled expressions by type+expression key', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const engine = stubEngine('test');
    let compileCount = 0;
    engine.compile = (expr) => {
      compileCount++;
      return { type: 'test', eval: () => expr };
    };
    registry.register(engine);

    const a = registry.compile('test', 'x + 1');
    const b = registry.compile('test', 'x + 1');
    expect(a).toBe(b);
    expect(compileCount).toBe(1);
  });

  it('clears cache on clearCache()', () => {
    const registry = new DefaultExpressionEngineRegistry();
    let compileCount = 0;
    const engine = stubEngine('test');
    engine.compile = (expr) => {
      compileCount++;
      return { type: 'test', eval: () => expr };
    };
    registry.register(engine);

    registry.compile('test', 'x + 1');
    registry.clearCache();
    registry.compile('test', 'x + 1');
    expect(compileCount).toBe(2);
  });

  it('registers and resolves default engine for context', () => {
    const registry = new DefaultExpressionEngineRegistry();
    registry.registerDefault('CONDITION', 'js');
    expect(registry.resolveDefault('CONDITION')).toBe('js');
  });

  it('returns undefined for context with no default', () => {
    const registry = new DefaultExpressionEngineRegistry();
    expect(registry.resolveDefault('CONDITION')).toBeUndefined();
  });
});
