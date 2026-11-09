import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurationSelector } from './duration.js';

describe('DurationSelector', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts in first phase', () => {
    const s = new DurationSelector(
      [{ name: 'a', durationMs: 1000 }, { name: 'b', durationMs: 2000 }],
      () => 1,
    );
    expect(s.activePhase()).toBe('a');
  });

  it('advances to next phase after elapsed time', () => {
    const s = new DurationSelector(
      [{ name: 'a', durationMs: 1000 }, { name: 'b', durationMs: 2000 }],
      () => 1,
    );
    vi.advanceTimersByTime(1000);
    expect(s.activePhase()).toBe('b');
  });

  it('last phase is sticky', () => {
    const s = new DurationSelector(
      [{ name: 'a', durationMs: 100 }, { name: 'b', durationMs: 100 }],
      () => 1,
    );
    vi.advanceTimersByTime(500);
    expect(s.activePhase()).toBe('b');
  });

  it('speed multiplier affects timing', () => {
    const s = new DurationSelector(
      [{ name: 'a', durationMs: 1000 }, { name: 'b', durationMs: 1000 }],
      () => 2,
    );
    vi.advanceTimersByTime(500);
    expect(s.activePhase()).toBe('b');
  });

  it('reset restarts the clock', () => {
    const s = new DurationSelector(
      [{ name: 'a', durationMs: 100 }, { name: 'b', durationMs: 100 }],
      () => 1,
    );
    vi.advanceTimersByTime(150);
    expect(s.activePhase()).toBe('b');
    s.reset();
    expect(s.activePhase()).toBe('a');
  });

  it('type returns duration', () => {
    const s = new DurationSelector([{ name: 'a', durationMs: 100 }], () => 1);
    expect(s.type()).toBe('duration');
  });

  it('onResolved is no-op', () => {
    const s = new DurationSelector([{ name: 'a', durationMs: 100 }], () => 1);
    s.onResolved();
    expect(s.activePhase()).toBe('a');
  });
});
