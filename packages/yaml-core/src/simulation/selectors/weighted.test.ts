import { describe, it, expect, vi } from 'vitest';
import { RandomSelector } from './weighted.js';

describe('RandomSelector', () => {
  it('with single phase always returns that phase', () => {
    const s = new RandomSelector([{ name: 'only', weight: 1.0 }]);
    expect(s.activePhase()).toBe('only');
  });

  it('returns a phase from the weighted list', () => {
    const s = new RandomSelector([
      { name: 'a', weight: 1.0 },
      { name: 'b', weight: 1.0 },
    ]);
    const phase = s.activePhase();
    expect(['a', 'b']).toContain(phase);
  });

  it('respects weight distribution', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const s = new RandomSelector([
      { name: 'a', weight: 1.0 },
      { name: 'b', weight: 9.0 },
    ]);
    expect(s.activePhase()).toBe('a');
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(s.activePhase()).toBe('b');
    vi.restoreAllMocks();
  });

  it('type returns weighted', () => {
    const s = new RandomSelector([{ name: 'a', weight: 1.0 }]);
    expect(s.type()).toBe('weighted');
  });

  it('onResolved and reset are no-ops', () => {
    const s = new RandomSelector([{ name: 'a', weight: 1.0 }]);
    s.onResolved();
    s.reset();
    expect(s.activePhase()).toBe('a');
  });
});
