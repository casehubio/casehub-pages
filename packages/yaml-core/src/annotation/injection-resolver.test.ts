import { describe, it, expect } from 'vitest';
import { InjectionResolver } from './injection-resolver.js';
import { MapServiceRegistry } from '../step/walker.js';
import type { Annotation } from './annotation-map.js';

describe('InjectionResolver', () => {
  it('resolves @Inject from ServiceRegistry', () => {
    const annotations: Annotation[] = [
      { name: 'Inject', args: { '0': 'DatabaseConnection' } },
    ];
    const params: Record<string, unknown> = { query: 'SELECT 1' };
    const registry = new MapServiceRegistry();
    const mockDb = { name: 'primary-db' };
    registry.register({ name: 'DatabaseConnection' }, mockDb);

    const result = InjectionResolver.resolve(annotations, params, registry);
    expect(result['DatabaseConnection']).toBe(mockDb);
    expect(result['query']).toBe('SELECT 1');
  });

  it('throws clear error when type not found', () => {
    const annotations: Annotation[] = [
      { name: 'Inject', args: { '0': 'MissingService' } },
    ];
    expect(() => InjectionResolver.resolve(annotations, {}, new MapServiceRegistry()))
      .toThrow('@Inject failed: service \'MissingService\' not found');
  });

  it('ignores non-Inject annotations', () => {
    const annotations: Annotation[] = [
      { name: 'Timeout', args: { '0': '5s' } },
    ];
    const result = InjectionResolver.resolve(annotations, { x: 1 }, new MapServiceRegistry());
    expect(result).toEqual({ x: 1 });
  });

  it('resolves multiple @Inject annotations', () => {
    const annotations: Annotation[] = [
      { name: 'Inject', args: { '0': 'ServiceA' } },
      { name: 'Inject', args: { '0': 'ServiceB' } },
    ];
    const registry = new MapServiceRegistry();
    registry.register({ name: 'ServiceA' }, { a: true });
    registry.register({ name: 'ServiceB' }, { b: true });

    const result = InjectionResolver.resolve(annotations, {}, registry);
    expect(result['ServiceA']).toEqual({ a: true });
    expect(result['ServiceB']).toEqual({ b: true });
  });

  it('skips @Inject with no type name', () => {
    const annotations: Annotation[] = [
      { name: 'Inject', args: {} },
    ];
    const result = InjectionResolver.resolve(annotations, { x: 1 }, new MapServiceRegistry());
    expect(result).toEqual({ x: 1 });
  });
});
