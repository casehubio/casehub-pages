import { describe, it, expect } from 'vitest';
import { PhasedCorpus } from './phased-corpus.js';
import { LookupCountSelector } from './selectors/lookup-count.js';
import type { InvocationRecord } from './types.js';

function rec(input: string, output: string, key = ''): InvocationRecord<string, string> {
  return { tenancyId: '', key, input, output, recordedAt: 0 };
}

describe('PhasedCorpus', () => {
  it('delegates list to active phase', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 2 }, { name: 'b', count: 2 }]);
    const phases = new Map([
      ['a', [rec('in-a', 'out-a')]],
      ['b', [rec('in-b', 'out-b')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);

    expect(corpus.list('any')).toEqual([rec('in-a', 'out-a')]);
    selector.onResolved();
    selector.onResolved();
    expect(corpus.list('any')).toEqual([rec('in-b', 'out-b')]);
  });

  it('lookupByIndex returns from active phase only', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }, { name: 'b', count: 1 }]);
    const phases = new Map([
      ['a', [rec('a1', 'A1'), rec('a2', 'A2')]],
      ['b', [rec('b1', 'B1')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);

    expect(corpus.lookupByIndex('x', 0)).toBe('A1');
    expect(corpus.lookupByIndex('x', 1)).toBe('A2');
    selector.onResolved();
    expect(corpus.lookupByIndex('x', 0)).toBe('B1');
    expect(corpus.lookupByIndex('x', 1)).toBeUndefined();
  });

  it('lookupByKey returns from active phase only', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }, { name: 'b', count: 1 }]);
    const phases = new Map([
      ['a', [rec('in', 'A', 'k1')]],
      ['b', [rec('in', 'B', 'k1')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);

    expect(corpus.lookupByKey('x', 'k1')).toBe('A');
    selector.onResolved();
    expect(corpus.lookupByKey('x', 'k1')).toBe('B');
  });

  it('size returns active phase entry count', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }, { name: 'b', count: 1 }]);
    const phases = new Map([
      ['a', [rec('1', '1'), rec('2', '2')]],
      ['b', [rec('1', '1')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);

    expect(corpus.size('x')).toBe(2);
    selector.onResolved();
    expect(corpus.size('x')).toBe(1);
  });

  it('throws on record', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus<string, string>(selector, new Map([['a', []]]));
    expect(() => corpus.record('q', 't', 'in', 'out')).toThrow();
  });

  it('throws on seed', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus<string, string>(selector, new Map([['a', []]]));
    expect(() => corpus.seed('q', [])).toThrow();
  });

  it('throws on clear', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus<string, string>(selector, new Map([['a', []]]));
    expect(() => corpus.clear('q')).toThrow();
  });

  it('returns empty for unknown phase', () => {
    const selector = new LookupCountSelector([{ name: 'missing', count: 1 }]);
    const corpus = new PhasedCorpus<string, string>(selector, new Map());
    expect(corpus.list('x')).toEqual([]);
    expect(corpus.size('x')).toBe(0);
  });

  it('lookupAllByKey returns all matches from active phase', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const phases = new Map([
      ['a', [rec('1', 'A', 'k'), rec('2', 'B', 'k')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);
    expect(corpus.lookupAllByKey('x', 'k')).toEqual(['A', 'B']);
  });

  it('listByTenant filters active phase entries', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const r1: InvocationRecord<string, string> = { tenancyId: 't1', key: '', input: 'i', output: 'o', recordedAt: 0 };
    const r2: InvocationRecord<string, string> = { tenancyId: 't2', key: '', input: 'i', output: 'o', recordedAt: 0 };
    const corpus = new PhasedCorpus(selector, new Map([['a', [r1, r2]]]));
    expect(corpus.listByTenant('x', 't1')).toEqual([r1]);
  });
});
