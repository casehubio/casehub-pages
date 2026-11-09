import { describe, it, expect } from 'vitest';
import { RecordedReplayStrategy } from './recorded-replay.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';

describe('RecordedReplayStrategy', () => {
  it('replays recorded entry by key match', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', '', 'response-a', 'key-a');
    corpus.record('action', '', '', 'response-b', 'key-b');
    const s = new RecordedReplayStrategy(corpus, 'action', (input) => input);
    expect(s.resolve('key-a')).toBe('response-a');
    expect(s.resolve('key-b')).toBe('response-b');
  });

  it('returns undefined for unrecorded key', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', '', 'response', 'known');
    const s = new RecordedReplayStrategy(corpus, 'action', (input) => input);
    expect(s.resolve('unknown')).toBeUndefined();
  });

  it('canResolve true for recorded key', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', '', '', 'r', 'k');
    const s = new RecordedReplayStrategy(corpus, 'action', (input) => input);
    expect(s.canResolve('k')).toBe(true);
    expect(s.canResolve('x')).toBe(false);
  });

  it('dataRealism returns RECORDED_REAL', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    const s = new RecordedReplayStrategy(corpus, 'action', (input) => input);
    expect(s.dataRealism()).toBe('RECORDED_REAL');
  });
});
