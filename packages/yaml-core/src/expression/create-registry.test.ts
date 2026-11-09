import { describe, it, expect } from 'vitest';
import { createExpressionEngineRegistry } from './create-registry.js';

describe('createExpressionEngineRegistry', () => {
  it('registers JQ and JS engines', () => {
    const registry = createExpressionEngineRegistry();
    expect(registry.resolve('jq')).toBeDefined();
    expect(registry.resolve('js')).toBeDefined();
  });

  it('maps all ExpressionContext values to defaults', () => {
    const registry = createExpressionEngineRegistry();
    expect(registry.resolveDefault('CONDITION')).toBe('js');
    expect(registry.resolveDefault('TRANSFORM')).toBe('jq');
    expect(registry.resolveDefault('FILTER')).toBe('jq');
    expect(registry.resolveDefault('PARAMETER')).toBe('js');
  });

  it('compiles and evaluates via JQ default for TRANSFORM', () => {
    const registry = createExpressionEngineRegistry();
    const engineType = registry.resolveDefault('TRANSFORM')!;
    const compiled = registry.compile(engineType, '.items | length');
    expect(compiled.eval({ items: [1, 2, 3] })).toBe(3);
  });

  it('compiles and evaluates via JS default for CONDITION', () => {
    const registry = createExpressionEngineRegistry();
    const engineType = registry.resolveDefault('CONDITION')!;
    const compiled = registry.compile(engineType, 'count > 0');
    expect(compiled.eval({ count: 5 })).toBe(true);
  });
});
