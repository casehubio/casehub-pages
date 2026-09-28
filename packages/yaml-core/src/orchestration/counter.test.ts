import { describe, it, expect } from 'vitest';
import { DefaultOrcCounter } from './counter.js';

describe('DefaultOrcCounter', () => {
  it('starts at 0', () => {
    expect(new DefaultOrcCounter().get()).toBe(0);
  });

  it('increment increases by 1', () => {
    const c = new DefaultOrcCounter();
    c.increment();
    c.increment();
    expect(c.get()).toBe(2);
  });

  it('decrement decreases by 1', () => {
    const c = new DefaultOrcCounter();
    c.increment();
    c.increment();
    c.decrement();
    expect(c.get()).toBe(1);
  });

  it('add with positive delta', () => {
    const c = new DefaultOrcCounter();
    c.add(5);
    expect(c.get()).toBe(5);
  });

  it('add with negative delta', () => {
    const c = new DefaultOrcCounter();
    c.add(10);
    c.add(-3);
    expect(c.get()).toBe(7);
  });

  it('reset returns to 0', () => {
    const c = new DefaultOrcCounter();
    c.add(42);
    c.reset();
    expect(c.get()).toBe(0);
  });
});
