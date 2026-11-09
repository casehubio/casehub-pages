import { describe, it, expect } from 'vitest';
import {
  hasExpressionParams,
  resolvePluginParams,
} from '../step/expression-resolver.js';
import { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
import { JsExpressionEngine } from './js-expression-engine.js';
import { VariableResolver } from '../variable-resolver.js';
import type { Parameter } from '../step/types.js';

function makeRegistry(): DefaultExpressionEngineRegistry {
  const registry = new DefaultExpressionEngineRegistry();
  registry.register(new JsExpressionEngine());
  registry.registerDefault('PARAMETER', 'js');
  return registry;
}

describe('hasExpressionParams', () => {
  it('returns false for undefined inputs', () => {
    expect(hasExpressionParams(undefined)).toBe(false);
  });

  it('returns false when no EXPRESSION params', () => {
    const inputs: Record<string, Parameter> = {
      name: { type: 'STRING', required: true },
    };
    expect(hasExpressionParams(inputs)).toBe(false);
  });

  it('returns true when EXPRESSION param exists', () => {
    const inputs: Record<string, Parameter> = {
      name: { type: 'STRING', required: true },
      filter: { type: 'EXPRESSION', required: true },
    };
    expect(hasExpressionParams(inputs)).toBe(true);
  });
});

describe('resolvePluginParams', () => {
  it('routes EXPRESSION params through engine, STRING through resolver', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver(
      { vars: (_k: string) => 'hello' },
      new Set(),
    ).withExpressionContext('data', { count: 5 });

    const inputs: Record<string, Parameter> = {
      greeting: { type: 'STRING', required: true },
      active: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { greeting: '${vars.value}', active: 'data.count > 0' },
      inputs,
      resolver,
      registry,
    );

    expect(result.active).toBe(true);
  });

  it('strips ${} wrapper from EXPRESSION values', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, new Set())
      .withExpressionContext('data', { x: 10 });

    const inputs: Record<string, Parameter> = {
      value: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { value: '${data.x + 1}' },
      inputs,
      resolver,
      registry,
    );

    expect(result.value).toBe(11);
  });

  it('passes null through for EXPRESSION params', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, new Set());
    const inputs: Record<string, Parameter> = {
      opt: { type: 'EXPRESSION', required: false },
    };

    const result = resolvePluginParams(
      { opt: null },
      inputs,
      resolver,
      registry,
    );

    expect(result.opt).toBeNull();
  });

  it('passes non-string values through for EXPRESSION params', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, new Set());
    const inputs: Record<string, Parameter> = {
      count: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { count: 42 },
      inputs,
      resolver,
      registry,
    );

    expect(result.count).toBe(42);
  });
});
