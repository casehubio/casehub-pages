import { describe, it, expect } from 'vitest';
import { InMemorySimulationCorpus } from './in-memory-corpus.js';

describe('InMemorySimulationCorpus', () => {
  it('starts empty for unknown qualified names', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    expect(corpus.size('foo')).toBe(0);
    expect(corpus.list('foo')).toEqual([]);
  });

  it('records and lists entries', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'tenant1', 'in', 'out');
    expect(corpus.size('action')).toBe(1);
    const entries = corpus.list('action');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.input).toBe('in');
    expect(entries[0]!.output).toBe('out');
    expect(entries[0]!.tenancyId).toBe('tenant1');
  });

  it('records with key and looks up by key', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'tenant1', 'in', 'out', 'key1');
    expect(corpus.lookupByKey('action', 'key1')).toBe('out');
    expect(corpus.lookupByKey('action', 'key2')).toBeUndefined();
  });

  it('lookupAllByKey returns all matches', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't1', 'in1', 'out1', 'k');
    corpus.record('action', 't2', 'in2', 'out2', 'k');
    expect(corpus.lookupAllByKey('action', 'k')).toEqual(['out1', 'out2']);
  });

  it('lookupByIndex returns entry at position', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'in1', 'out1');
    corpus.record('action', 't', 'in2', 'out2');
    expect(corpus.lookupByIndex('action', 0)).toBe('out1');
    expect(corpus.lookupByIndex('action', 1)).toBe('out2');
    expect(corpus.lookupByIndex('action', 2)).toBeUndefined();
  });

  it('listByTenant filters by tenancy', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'a', 'in1', 'out1');
    corpus.record('action', 'b', 'in2', 'out2');
    expect(corpus.listByTenant('action', 'a')).toHaveLength(1);
    expect(corpus.listByTenant('action', 'a')[0]!.input).toBe('in1');
  });

  it('seed replaces entries for qualified name', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'old', 'old');
    corpus.seed('action', [
      { tenancyId: 't', key: '', input: 'new', output: 'new', recordedAt: Date.now() },
    ]);
    expect(corpus.size('action')).toBe(1);
    expect(corpus.list('action')[0]!.input).toBe('new');
  });

  it('clear removes all entries for qualified name', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'in', 'out');
    corpus.clear('action');
    expect(corpus.size('action')).toBe(0);
  });

  it('lookupByKey returns undefined for empty corpus', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    expect(corpus.lookupByKey('none', 'k')).toBeUndefined();
  });

  it('lookupAllByKey returns empty for no matches', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    expect(corpus.lookupAllByKey('none', 'k')).toEqual([]);
  });

  it('lookupByIndex returns undefined for negative index', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('a', 't', 'in', 'out');
    expect(corpus.lookupByIndex('a', -1)).toBeUndefined();
  });
});
