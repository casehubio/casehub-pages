import { describe, it, expect } from 'vitest';
import { DiagramBaseMixin } from './diagram-base-mixin.js';

describe('DiagramBaseMixin', () => {
  it('exports the mixin function', () => {
    expect(typeof DiagramBaseMixin).toBe('function');
  });
});
