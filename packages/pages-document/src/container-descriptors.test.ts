import { describe, it, expect } from 'vitest';
import { getContainerDescriptor, CONTAINER_DESCRIPTORS } from './container-descriptors.js';

describe('container descriptors', () => {
  it('returns descriptor for tabs', () => {
    const desc = getContainerDescriptor('tabs');
    expect(desc).toBeDefined();
    expect(desc!.slots).toHaveLength(1);
    expect(desc!.slots[0]!.kind).toBe('named-record');
  });

  it('returns descriptor for sidebar with two slots', () => {
    const desc = getContainerDescriptor('sidebar');
    expect(desc).toBeDefined();
    expect(desc!.slots).toHaveLength(2);
    expect(desc!.slots[0]!.yamlKey).toBe('sidebar');
    expect(desc!.slots[1]!.yamlKey).toBe('content');
  });

  it('returns descriptor for split with nested-array', () => {
    const desc = getContainerDescriptor('split');
    expect(desc).toBeDefined();
    expect(desc!.slots[0]!.kind).toBe('nested-array');
  });

  it('returns undefined for non-container', () => {
    expect(getContainerDescriptor('bar-chart')).toBeUndefined();
    expect(getContainerDescriptor('metric')).toBeUndefined();
  });

  it('covers all known container types', () => {
    const types = CONTAINER_DESCRIPTORS.map(d => d.type);
    expect(types).toContain('tabs');
    expect(types).toContain('pills');
    expect(types).toContain('accordion');
    expect(types).toContain('sidebar');
    expect(types).toContain('split');
    expect(types).toContain('form-scope');
    expect(types).toContain('carousel');
    expect(types).toContain('stack');
    expect(types).toContain('menu');
    expect(types).toContain('tree');
  });
});
