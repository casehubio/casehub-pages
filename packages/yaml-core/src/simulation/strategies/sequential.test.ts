import { describe, it, expect } from 'vitest';
import { SequentialStrategy } from './sequential.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';

function seeded(entries: string[]) {
  const corpus = new InMemorySimulationCorpus<string, string>();
  for (const e of entries) corpus.record('action', '', '', e);
  return corpus;
}

describe('SequentialStrategy', () => {
  it('resolves entries in order', () => {
    const s = new SequentialStrategy(seeded(['a', 'b', 'c']), 'action');
    expect(s.resolve('')).toBe('a');
    expect(s.resolve('')).toBe('b');
    expect(s.resolve('')).toBe('c');
  });

  it('WRAP policy cycles back to start', () => {
    const s = new SequentialStrategy(seeded(['a', 'b']), 'action', 'WRAP');
    expect(s.resolve('')).toBe('a');
    expect(s.resolve('')).toBe('b');
    expect(s.resolve('')).toBe('a');
  });

  it('CLAMP policy repeats last entry', () => {
    const s = new SequentialStrategy(seeded(['a', 'b']), 'action', 'CLAMP');
    expect(s.resolve('')).toBe('a');
    expect(s.resolve('')).toBe('b');
    expect(s.resolve('')).toBe('b');
    expect(s.resolve('')).toBe('b');
  });

  it('THROW policy throws on exhaustion', () => {
    const s = new SequentialStrategy(seeded(['a']), 'action', 'THROW');
    expect(s.resolve('')).toBe('a');
    expect(() => s.resolve('')).toThrow(/exhausted/);
  });

  it('canResolve returns true when corpus has entries', () => {
    const s = new SequentialStrategy(seeded(['a']), 'action');
    expect(s.canResolve('')).toBe(true);
  });

  it('canResolve returns false for empty corpus', () => {
    const s = new SequentialStrategy(seeded([]), 'action');
    expect(s.canResolve('')).toBe(false);
  });

  it('returns undefined for empty corpus', () => {
    const s = new SequentialStrategy(seeded([]), 'action');
    expect(s.resolve('')).toBeUndefined();
  });

  it('dataRealism returns DOMAIN_PLAUSIBLE', () => {
    const s = new SequentialStrategy(seeded([]), 'action');
    expect(s.dataRealism()).toBe('DOMAIN_PLAUSIBLE');
  });
});
