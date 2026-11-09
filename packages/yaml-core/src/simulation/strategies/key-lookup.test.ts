import { describe, it, expect } from 'vitest';
import { KeyLookupStrategy } from './key-lookup.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';

function corpus() {
  const c = new InMemorySimulationCorpus<string, string>();
  c.record('action', '', '', 'result-a', 'key-a');
  c.record('action', '', '', 'result-b', 'key-b');
  c.record('action', '', '', 'result-a2', 'key-a');
  return c;
}

describe('KeyLookupStrategy', () => {
  it('looks up by extracted key (FIRST policy)', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input, 'FIRST');
    expect(s.resolve('key-a')).toBe('result-a');
    expect(s.resolve('key-b')).toBe('result-b');
  });

  it('returns undefined for no match with default exhaustion', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input);
    expect(s.resolve('unknown')).toBeUndefined();
  });

  it('THROW policy throws on no match', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input, 'FIRST', 'THROW');
    expect(() => s.resolve('unknown')).toThrow(/No corpus match/);
  });

  it('ALL policy returns first of all matches', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input, 'ALL');
    expect(s.resolve('key-a')).toBe('result-a');
  });

  it('canResolve returns true when key has a match', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input);
    expect(s.canResolve('key-a')).toBe(true);
    expect(s.canResolve('unknown')).toBe(false);
  });

  it('dataRealism returns DOMAIN_PLAUSIBLE', () => {
    const s = new KeyLookupStrategy(corpus(), 'action', (input) => input);
    expect(s.dataRealism()).toBe('DOMAIN_PLAUSIBLE');
  });
});
