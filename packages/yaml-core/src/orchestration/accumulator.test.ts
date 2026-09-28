import { describe, it, expect } from 'vitest';
import { DefaultOrcAccumulator } from './accumulator.js';

describe('DefaultOrcAccumulator', () => {
  it('sum: accumulates values', () => {
    const acc = new DefaultOrcAccumulator((a, b) => a + b, 0);
    acc.accumulate(3);
    acc.accumulate(7);
    expect(acc.get()).toBe(10);
  });

  it('sum: reset returns to identity', () => {
    const acc = new DefaultOrcAccumulator((a, b) => a + b, 0);
    acc.accumulate(5);
    acc.reset();
    expect(acc.get()).toBe(0);
  });

  it('max: keeps maximum value', () => {
    const acc = new DefaultOrcAccumulator(Math.max, -Infinity);
    acc.accumulate(3);
    acc.accumulate(9);
    acc.accumulate(5);
    expect(acc.get()).toBe(9);
  });

  it('multiply: identity 1', () => {
    const acc = new DefaultOrcAccumulator((a, b) => a * b, 1);
    acc.accumulate(3);
    acc.accumulate(4);
    expect(acc.get()).toBe(12);
  });
});
