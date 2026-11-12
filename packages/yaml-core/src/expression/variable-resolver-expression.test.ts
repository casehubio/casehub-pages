import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../variable-resolver.js';

describe('VariableResolver expression context', () => {
  it('withExpressionContext returns a new resolver (immutable)', () => {
    const r1 = new VariableResolver({}, new Set());
    const r2 = r1.withExpressionContext('env', { host: 'localhost' });
    expect(r2).not.toBe(r1);
  });

  it('buildExpressionContext returns empty when no containers', () => {
    const resolver = new VariableResolver({}, new Set());
    expect(resolver.buildExpressionContext()).toEqual({});
  });

  it('buildExpressionContext aggregates containers by prefix', () => {
    const resolver = new VariableResolver({}, new Set())
      .withExpressionContext('env', { host: 'localhost', port: 8080 })
      .withExpressionContext('user', { name: 'Alice' });

    expect(resolver.buildExpressionContext()).toEqual({
      env: { host: 'localhost', port: 8080 },
      user: { name: 'Alice' },
    });
  });

  it('withExpressionContext does not affect string interpolation', () => {
    const resolver = new VariableResolver({}, new Set())
      .withExpressionContext('env', { host: 'localhost' });

    expect(() => resolver.resolveString('${env.host}', 'test'))
      .toThrow();
  });

  it('chaining withExpressionContext preserves earlier containers', () => {
    const r = new VariableResolver({}, new Set())
      .withExpressionContext('a', { x: 1 })
      .withExpressionContext('b', { y: 2 });

    const ctx = r.buildExpressionContext();
    expect(ctx).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });

  it('existing withScope does not add to expression context', () => {
    const resolver = new VariableResolver({}, new Set())
      .withScope('vars', (_key) => 'value');
    expect(resolver.buildExpressionContext()).toEqual({});
  });

  it('withObjectScope with record adds to both interpolation and expression context', () => {
    const data = { host: 'localhost', port: 8080 };
    const resolver = new VariableResolver({}, new Set())
      .withObjectScope('env', data);

    expect(resolver.resolveString('${env.host}', 'test')).toBe('localhost');
    expect(resolver.buildExpressionContext()).toEqual({ env: data });
  });
});
