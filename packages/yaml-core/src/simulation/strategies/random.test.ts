import { describe, it, expect } from 'vitest';
import { RandomStrategy } from './random.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';

describe('RandomStrategy', () => {
  it('resolves a random entry from corpus', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', '', 'a');
    corpus.record('action', '', '', 'b');
    const s = new RandomStrategy(corpus, 'action');
    const result = s.resolve('');
    expect(['a', 'b']).toContain(result);
  });

  it('returns undefined for empty corpus', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new RandomStrategy(corpus, 'action');
    expect(s.resolve('')).toBeUndefined();
  });

  it('canResolve true when corpus has entries', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', '', 'a');
    const s = new RandomStrategy(corpus, 'action');
    expect(s.canResolve('')).toBe(true);
  });

  it('canResolve false when corpus is empty', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new RandomStrategy(corpus, 'action');
    expect(s.canResolve('')).toBe(false);
  });

  it('dataRealism returns DOMAIN_PLAUSIBLE', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new RandomStrategy(corpus, 'action');
    expect(s.dataRealism()).toBe('DOMAIN_PLAUSIBLE');
  });
});
