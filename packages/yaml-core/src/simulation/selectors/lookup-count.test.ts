import { describe, it, expect } from 'vitest';
import { LookupCountSelector } from './lookup-count.js';

describe('LookupCountSelector', () => {
  it('starts in first phase', () => {
    const s = new LookupCountSelector([{ name: 'a', count: 2 }, { name: 'b', count: 3 }]);
    expect(s.activePhase()).toBe('a');
  });

  it('advances to next phase after count lookups', () => {
    const s = new LookupCountSelector([{ name: 'a', count: 2 }, { name: 'b', count: 3 }]);
    s.onResolved();
    expect(s.activePhase()).toBe('a');
    s.onResolved();
    expect(s.activePhase()).toBe('b');
  });

  it('last phase is sticky', () => {
    const s = new LookupCountSelector([{ name: 'a', count: 1 }, { name: 'b', count: 1 }]);
    s.onResolved();
    s.onResolved();
    s.onResolved();
    s.onResolved();
    expect(s.activePhase()).toBe('b');
  });

  it('reset returns to first phase', () => {
    const s = new LookupCountSelector([{ name: 'a', count: 1 }, { name: 'b', count: 1 }]);
    s.onResolved();
    expect(s.activePhase()).toBe('b');
    s.reset();
    expect(s.activePhase()).toBe('a');
  });

  it('type returns lookup-count', () => {
    const s = new LookupCountSelector([{ name: 'a', count: 1 }]);
    expect(s.type()).toBe('lookup-count');
  });
});
