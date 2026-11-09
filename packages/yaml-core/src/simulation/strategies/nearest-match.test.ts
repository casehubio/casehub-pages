import { describe, it, expect } from 'vitest';
import { NearestMatchStrategy } from './nearest-match.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';

function lengthScorer(a: string, b: string): number {
  const diff = Math.abs(a.length - b.length);
  return Math.max(0, 1 - diff / 10);
}

describe('NearestMatchStrategy', () => {
  it('returns closest match above threshold', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', 'short', 'result-short');
    corpus.record('action', '', 'a-much-longer-string', 'result-long');
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0.5);
    expect(s.resolve('tiny')).toBe('result-short');
  });

  it('returns undefined when all below threshold', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', 'a-very-long-string-indeed', 'result');
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0.99);
    expect(s.resolve('x')).toBeUndefined();
  });

  it('returns highest scorer when multiple match', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', 'abc', 'exact');
    corpus.record('action', '', 'abcdef', 'close');
    corpus.record('action', '', 'abcdefghijklmnop', 'far');
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0);
    expect(s.resolve('abc')).toBe('exact');
  });

  it('canResolve delegates to resolve', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', 'abc', 'result');
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0);
    expect(s.canResolve('abc')).toBe(true);
  });

  it('returns undefined for empty corpus', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0);
    expect(s.resolve('anything')).toBeUndefined();
  });

  it('dataRealism returns DOMAIN_PLAUSIBLE', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new NearestMatchStrategy(corpus, 'action', lengthScorer, 0);
    expect(s.dataRealism()).toBe('DOMAIN_PLAUSIBLE');
  });
});
