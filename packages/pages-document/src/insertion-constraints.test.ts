import { describe, it, expect } from 'vitest';
import { allowedTypesAt, allowedTypesForSiblingOf, isAllowedChild } from './insertion-constraints.js';

describe('allowedTypesAt', () => {
  it('page allows all component types, no structural types', () => {
    const c = allowedTypesAt('page');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
    expect(c.componentTypes).toContain('bar-chart');
    expect(c.componentTypes).toContain('input');
    expect(c.componentTypes).not.toContain('rows');
  });

  it('column allows all component types, no structural', () => {
    const c = allowedTypesAt('column');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
  });

  it('container component (tabs) allows all component types', () => {
    const c = allowedTypesAt('tabs');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
  });

  it('container component (form-scope) allows all component types', () => {
    const c = allowedTypesAt('form-scope');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
  });

  it('leaf component (bar-chart) allows nothing', () => {
    const c = allowedTypesAt('bar-chart');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes).toEqual([]);
  });

  it('unknown type allows nothing', () => {
    const c = allowedTypesAt('nonexistent');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes).toEqual([]);
  });
});

describe('allowedTypesForSiblingOf', () => {
  it('sibling of component = column constraint (all components)', () => {
    const c = allowedTypesForSiblingOf('component');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
  });

  it('sibling of grid-item = page constraint (all components)', () => {
    const c = allowedTypesForSiblingOf('grid-item');
    expect(c.structuralTypes).toEqual([]);
    expect(c.componentTypes.length).toBeGreaterThan(50);
  });
});

describe('isAllowedChild', () => {
  it('bar-chart is allowed in column', () => {
    expect(isAllowedChild('column', 'bar-chart')).toBe(true);
  });

  it('bar-chart is allowed in page', () => {
    expect(isAllowedChild('page', 'bar-chart')).toBe(true);
  });

  it('nothing is allowed in leaf component', () => {
    expect(isAllowedChild('bar-chart', 'input')).toBe(false);
  });

  it('component is allowed in container (tabs)', () => {
    expect(isAllowedChild('tabs', 'bar-chart')).toBe(true);
  });
});
