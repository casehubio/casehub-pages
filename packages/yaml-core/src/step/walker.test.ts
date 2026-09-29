import { describe, it, expect } from 'vitest';
import type { Catalog, CatalogEntry, Action, Result } from './walker.js';
import { Walker, stepSuccess } from './walker.js';

const noopAction: Action = {
  execute: () => Promise.resolve(stepSuccess({})),
};

function makeCatalog(actions: Record<string, CatalogEntry> = {}): Catalog {
  return {
    resolve: (name) => actions[name],
    availableActions: () => new Set(Object.keys(actions)),
  };
}

function makeEntry(name: string): CatalogEntry {
  return {
    qualifiedName: name,
    definition: { name, inputs: {}, outputs: {} },
    action: noopAction,
  };
}

describe('Walker', () => {
  describe('name uniqueness', () => {
    it('allows unique names', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA'), doB: makeEntry('doB') });
      const steps = [
        { step: 'first', doA: {} },
        { step: 'second', doB: {} },
      ];
      expect(() => Walker.resolve(steps, catalog)).not.toThrow();
    });

    it('throws on duplicate step names', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { step: 'same-name', doA: {} },
        { step: 'same-name', doA: {} },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/duplicate.*same-name/i);
    });

    it('allows null names (unnamed steps)', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { doA: {} },
        { doA: {} },
      ];
      expect(() => Walker.resolve(steps, catalog)).not.toThrow();
    });

    it('detects duplicates in nested blocks', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { step: 'outer', doA: {} },
        {
          block: [
            { step: 'outer', doA: {} },
          ],
        },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/duplicate.*outer/i);
    });
  });

  describe('barrier/quorum ref validation', () => {
    it('accepts barrier referencing known step names', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { step: 'step-a', doA: {} },
        { step: 'step-b', doA: {} },
        { barrier: { await: ['step-a', 'step-b'] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).not.toThrow();
    });

    it('throws when barrier references unknown step name', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { step: 'step-a', doA: {} },
        { barrier: { await: ['step-a', 'nonexistent'] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/nonexistent/);
    });

    it('throws when quorum references unknown step name', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { step: 'step-a', doA: {} },
        { quorum: { required: 1, of: ['step-a', 'ghost'] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/ghost/);
    });
  });

  describe('match case default key', () => {
    it('handles "default" key holding steps directly', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        {
          match: 'value',
          cases: [
            { pattern: 'x', steps: [{ doA: {} }] },
            { default: [{ step: 'fallback', doA: {} }] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('match');
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0]!.cases[1]!.pattern.type).toBe('default');
        expect(resolved[0]!.cases[1]!.steps).toHaveLength(1);
      }
    });

    it('accepts "pattern" as primary key and "when" as alias', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        {
          match: 'v',
          cases: [
            { when: 'hello', do: [{ doA: {} }] },
            { pattern: 'world', steps: [{ doA: {} }] },
            { default: [] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0]!.cases[0]!.pattern).toEqual({ type: 'value', value: 'hello' });
        expect(resolved[0]!.cases[1]!.pattern).toEqual({ type: 'value', value: 'world' });
        expect(resolved[0]!.cases[2]!.pattern.type).toBe('default');
      }
    });
  });
});
