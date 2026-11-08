import { describe, it, expect } from 'vitest';
import type { Catalog, CatalogEntry, Action } from './walker.js';
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

  describe('match case body resolution', () => {
    it('handles "default" key holding actions directly', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        {
          match: 'value',
          cases: [
            { pattern: 'x', doA: {} },
            { default: [{ step: 'fallback', doA: {} }] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('match');
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0].cases[0]!.steps).toHaveLength(1);
        expect(resolved[0].cases[1]!.pattern.type).toBe('default');
        expect(resolved[0].cases[1]!.steps).toHaveLength(1);
      }
    });

    it('resolves inline action as case body', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA'), doB: makeEntry('doB') });
      const steps = [
        {
          match: 'v',
          cases: [
            { when: 'hello', doA: {} },
            { pattern: 'world', doB: {} },
            { default: [] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0].cases[0]!.pattern).toEqual({ type: 'value', value: 'hello' });
        expect(resolved[0].cases[0]!.steps).toHaveLength(1);
        expect(resolved[0].cases[0]!.steps[0]!.kind).toBe('plugin');
        expect(resolved[0].cases[1]!.pattern).toEqual({ type: 'value', value: 'world' });
        expect(resolved[0].cases[2]!.pattern.type).toBe('default');
      }
    });

    it('resolves block as case body for multiple actions', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA'), doB: makeEntry('doB') });
      const steps = [
        {
          match: 'v',
          cases: [
            { when: 'x', block: [{ doA: {} }, { doB: {} }] },
            { default: [] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0].cases[0]!.steps).toHaveLength(1);
        expect(resolved[0].cases[0]!.steps[0]!.kind).toBe('block');
        if (resolved[0].cases[0]!.steps[0]!.kind === 'block') {
          expect(resolved[0].cases[0]!.steps[0].steps).toHaveLength(2);
        }
      }
    });
  });

  describe('select branch body resolution', () => {
    it('resolves inline action as wait body', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        {
          select: [
            { wait: 'sig-a', doA: {} },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'select') {
        expect(resolved[0].branches[0]!.name).toBe('sig-a');
        expect(resolved[0].branches[0]!.steps).toHaveLength(1);
        expect(resolved[0].branches[0]!.steps[0]!.kind).toBe('plugin');
      }
    });

    it('resolves block as wait body for multiple actions', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA'), doB: makeEntry('doB') });
      const steps = [
        {
          select: [
            { wait: 'sig-a', block: [{ doA: {} }, { doB: {} }] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'select') {
        expect(resolved[0].branches[0]!.steps).toHaveLength(1);
        expect(resolved[0].branches[0]!.steps[0]!.kind).toBe('block');
      }
    });

    it('handles empty wait branch', () => {
      const catalog = makeCatalog();
      const steps = [
        { select: [{ wait: 'sig-a' }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'select') {
        expect(resolved[0].branches[0]!.steps).toHaveLength(0);
      }
    });
  });

  describe('DelayStep resolution', () => {
    it('resolves standalone delay as DelayStep', () => {
      const steps = [{ delay: '500ms' }];
      const resolved = Walker.resolve(steps, makeCatalog());
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.kind).toBe('delay');
      expect((resolved[0] as any).duration).toBe(500);
    });

    it('resolves delay with step name', () => {
      const steps = [{ step: 'pause', delay: '2s' }];
      const resolved = Walker.resolve(steps, makeCatalog());
      expect(resolved[0]!.kind).toBe('delay');
      expect(resolved[0]!.name).toBe('pause');
      expect((resolved[0] as any).duration).toBe(2000);
    });

    it('treats delay alongside action key as decorator', () => {
      const catalog = makeCatalog({ click: makeEntry('click') });
      const steps = [{ click: { role: 'button', name: 'A' }, delay: '1s' }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect(resolved[0]!.decorators['delay']).toBe('1s');
    });
  });

  describe('non-object action value wrapping', () => {
    it('wraps string action value as { _subject: string }', () => {
      const catalog = makeCatalog({ navigate: makeEntry('navigate') });
      const steps = [{ navigate: '/dashboard' }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect((resolved[0] as any).params).toEqual({ _subject: '/dashboard' });
    });

    it('wraps number action value as { _subject: number }', () => {
      const catalog = makeCatalog({ waitMs: makeEntry('waitMs') });
      const steps = [{ waitMs: 500 }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect((resolved[0] as any).params).toEqual({ _subject: 500 });
    });

    it('passes object action values unchanged', () => {
      const catalog = makeCatalog({ click: makeEntry('click') });
      const steps = [{ click: { role: 'button', name: 'A' } }];
      const resolved = Walker.resolve(steps, catalog);
      expect((resolved[0] as any).params).toEqual({ role: 'button', name: 'A' });
    });
  });

  describe('match case validation', () => {
    it('throws when case has neither pattern nor default', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { match: 'v', cases: [{ doA: {} }] },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/must have.*pattern.*when.*default/i);
    });

    it('throws when case has both pattern and default', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        { match: 'v', cases: [{ pattern: 'x', default: [{ doA: {} }] }] },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/mutually exclusive/i);
    });

    it('treats string "default" and "_" as literal values, not default markers', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      const steps = [
        {
          match: 'v',
          cases: [
            { pattern: 'default', doA: {} },
            { pattern: '_', doA: {} },
            { default: [] },
          ],
        },
      ];
      const resolved = Walker.resolve(steps, catalog);
      if (resolved[0]!.kind === 'match') {
        expect(resolved[0]!.cases[0]!.pattern).toEqual({ type: 'value', value: 'default' });
        expect(resolved[0]!.cases[1]!.pattern).toEqual({ type: 'value', value: '_' });
        expect(resolved[0]!.cases[2]!.pattern.type).toBe('default');
      }
    });
  });

  describe('removed keys', () => {
    it('rejects steps key with clear error', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      expect(() => Walker.resolve([{ steps: [{ doA: {} }] }], catalog))
        .toThrow("'steps' is no longer valid — use inline sibling keys");
    });

    it('rejects do key with clear error', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      expect(() => Walker.resolve([{ do: [{ doA: {} }] }], catalog))
        .toThrow("'do' is no longer valid — use inline sibling keys");
    });

    it('rejects steps key in nested context', () => {
      const catalog = makeCatalog({ doA: makeEntry('doA') });
      expect(() => Walker.resolve([
        { block: [{ steps: [{ doA: {} }] }] },
      ], catalog)).toThrow("'steps' is no longer valid — use inline sibling keys");
    });
  });

  describe('structural decorator forms', () => {
    it('resolves forEach with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { forEach: { 'member in members': [{ fill: {} }, { click: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(2);
        expect(resolved[0].steps[0]!.kind).toBe('plugin');
        expect(resolved[0].decorators['forEach']).toBe('member in members');
      }
    });

    it('resolves retry with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { retry: { '3': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['retry']).toBe('3');
      }
    });

    it('resolves when with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { when: { '${params.enabled}': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['when']).toBe('${params.enabled}');
      }
    });

    it('resolves timeout with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { timeout: { '30s': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['timeout']).toBe('30s');
      }
    });

    it('resolves mutex with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { mutex: { 'order-lock': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['mutex']).toBe('order-lock');
      }
    });

    it('resolves loop with object value as structural block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { loop: { 'continuous': [{ fill: {} }] }, cancel: 'done', timeout: '1m' },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['loop']).toBe('continuous');
        expect(resolved[0].decorators['cancel']).toBe('done');
      }
    });

    it('resolves retry with array value as structural block (no parameter)', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { retry: [{ fill: {} }, { click: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(2);
        expect(resolved[0].decorators['retry']).toBe(true);
      }
    });

    it('combines structural decorator with scalar decorators', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { forEach: { 'member in members': [{ fill: {} }] }, retry: 3, timeout: '30s' },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['forEach']).toBe('member in members');
        expect(resolved[0].decorators['retry']).toBe(3);
        expect(resolved[0].decorators['timeout']).toBe('30s');
      }
    });

    it('preserves step name on structural decorator', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { step: 'my-loop', forEach: { 'item in items': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.name).toBe('my-loop');
    });

    it('treats scalar decorator value alongside action key as decorator (unchanged)', () => {
      const catalog = makeCatalog({ click: makeEntry('click') });
      const steps = [{ click: { role: 'button' }, retry: 3, forEach: 'item in items' }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect(resolved[0]!.decorators['retry']).toBe(3);
      expect(resolved[0]!.decorators['forEach']).toBe('item in items');
    });

    it('throws when two promotable decorators both have non-scalar values', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { forEach: { 'a in b': [{ fill: {} }] }, retry: { '3': [{ fill: {} }] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/structural.*structural/i);
    });

    it('throws when structural decorator conflicts with block', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { block: [{ fill: {} }], forEach: { 'a in b': [{ fill: {} }] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/structural.*structural/i);
    });

    it('treats object with multiple keys as decorator (not structural)', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { fill: {}, forEach: { 'a in b': [{ fill: {} }], 'c in d': [{ fill: {} }] } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect(resolved[0]!.decorators['forEach']).toEqual({ 'a in b': [{ fill: {} }], 'c in d': [{ fill: {} }] });
    });

    it('treats object with non-array value as decorator (not structural)', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { fill: {}, forEach: { 'a in b': 'not-an-array' } },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('plugin');
      expect(resolved[0]!.decorators['forEach']).toEqual({ 'a in b': 'not-an-array' });
    });

    it('throws when structural decorator conflicts with action key', () => {
      const catalog = makeCatalog({ click: makeEntry('click') });
      const steps = [
        { click: {}, forEach: { 'a in b': [{ click: {} }] } },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/structural.*action/i);
    });

    it('resolves combined-key form: forEach member in members', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { 'forEach member in members': [{ fill: {} }, { click: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(2);
        expect(resolved[0].decorators['forEach']).toBe('member in members');
      }
    });

    it('resolves combined-key form: retry 3', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'retry 3': [{ fill: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['retry']).toBe('3');
      }
    });

    it('resolves combined-key form: when ${params.enabled}', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'when ${params.enabled}': [{ fill: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(1);
        expect(resolved[0].decorators['when']).toBe('${params.enabled}');
      }
    });

    it('resolves combined-key form: timeout 30s', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'timeout 30s': [{ fill: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].decorators['timeout']).toBe('30s');
      }
    });

    it('resolves combined-key form: mutex order-lock', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'mutex order-lock': [{ fill: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].decorators['mutex']).toBe('order-lock');
      }
    });

    it('resolves combined-key form: loop continuous', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'loop continuous': [{ fill: {} }], cancel: 'done', timeout: '1m' },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].decorators['loop']).toBe('continuous');
        expect(resolved[0].decorators['cancel']).toBe('done');
      }
    });

    it('combined-key form with scalar decorators', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'forEach item in items': [{ fill: {} }], retry: 3, timeout: '30s' },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].decorators['forEach']).toBe('item in items');
        expect(resolved[0].decorators['retry']).toBe(3);
        expect(resolved[0].decorators['timeout']).toBe('30s');
      }
    });

    it('rejects combined-key with non-array value', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { 'forEach item in items': 'not-an-array' },
      ];
      expect(() => Walker.resolve(steps, catalog)).toThrow(/unknown step key/i);
    });

    it('combined-key form: block with name', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { 'block setup': [{ fill: {} }, { click: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('block');
      expect(resolved[0]!.name).toBe('setup');
      if (resolved[0]!.kind === 'block') {
        expect(resolved[0].steps).toHaveLength(2);
      }
    });

    it('combined-key form: parallel with name', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { 'parallel fast-path': [{ fill: {} }, { click: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('parallel');
      expect(resolved[0]!.name).toBe('fast-path');
    });

    it('combined-key form: race with name', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill'), click: makeEntry('click') });
      const steps = [
        { 'race winner': [{ fill: {} }, { click: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.kind).toBe('race');
      expect(resolved[0]!.name).toBe('winner');
    });

    it('combined-key step name does not override explicit step key', () => {
      const catalog = makeCatalog({ fill: makeEntry('fill') });
      const steps = [
        { step: 'explicit', 'block setup': [{ fill: {} }] },
      ];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0]!.name).toBe('explicit');
    });
  });

  describe('emit-event', () => {
    const catalog = makeCatalog();

    it('parses single event', () => {
      const steps = Walker.resolve([{
        step: 'alert',
        'emit-event': { type: 'pathology.alert', data: { severity: 'HIGH' } },
      }], catalog);
      expect(steps).toHaveLength(1);
      expect(steps[0].kind).toBe('emit-event');
      const s = steps[0] as import('./walker.js').EmitEventStep;
      expect(s.name).toBe('alert');
      expect(s.events).toHaveLength(1);
      expect(s.events[0].type).toBe('pathology.alert');
      expect(s.events[0].data).toEqual({ severity: 'HIGH' });
      expect(s.emitTo).toBe('both');
    });

    it('parses batch events', () => {
      const steps = Walker.resolve([{
        'emit-event': [
          { type: 'a.b', data: { x: 1 } },
          { type: 'c.d', data: { y: 2 } },
        ],
      }], catalog);
      const s = steps[0] as import('./walker.js').EmitEventStep;
      expect(s.events).toHaveLength(2);
      expect(s.events[0].type).toBe('a.b');
      expect(s.events[1].type).toBe('c.d');
    });

    it('parses all CloudEvent fields', () => {
      const steps = Walker.resolve([{
        'emit-event': {
          type: 'test.event',
          data: { key: 'val' },
          source: '/test',
          id: 'evt-001',
          specversion: '1.0',
          time: '2026-10-20T00:00:00Z',
          subject: 'patient-123',
          datacontenttype: 'application/json',
        },
      }], catalog);
      const evt = (steps[0] as import('./walker.js').EmitEventStep).events[0];
      expect(evt.source).toBe('/test');
      expect(evt.id).toBe('evt-001');
      expect(evt.specversion).toBe('1.0');
      expect(evt.time).toBe('2026-10-20T00:00:00Z');
      expect(evt.subject).toBe('patient-123');
      expect(evt.datacontenttype).toBe('application/json');
    });

    it('collects extension attributes as top-level properties', () => {
      const steps = Walker.resolve([{
        'emit-event': {
          type: 'test.event',
          data: {},
          priority: 'urgent',
          traceid: 'abc-123',
        },
      }], catalog);
      const evt = (steps[0] as import('./walker.js').EmitEventStep).events[0];
      expect((evt as Record<string, unknown>).priority).toBe('urgent');
      expect((evt as Record<string, unknown>).traceid).toBe('abc-123');
    });

    it('throws on missing type', () => {
      expect(() => Walker.resolve([{
        'emit-event': { data: { x: 1 } },
      }], catalog)).toThrow(/type.*required/i);
    });

    it('throws on missing data', () => {
      expect(() => Walker.resolve([{
        'emit-event': { type: 'a.b' },
      }], catalog)).toThrow(/data.*required/i);
    });

    it('extracts emit-to field', () => {
      const steps = Walker.resolve([{
        'emit-to': 'scope',
        'emit-event': { type: 'a.b', data: {} },
      }], catalog);
      expect((steps[0] as import('./walker.js').EmitEventStep).emitTo).toBe('scope');
    });

    it('defaults emit-to to both', () => {
      const steps = Walker.resolve([{
        'emit-event': { type: 'a.b', data: {} },
      }], catalog);
      expect((steps[0] as import('./walker.js').EmitEventStep).emitTo).toBe('both');
    });

    it('throws on emit-to without emit-event', () => {
      const cat = makeCatalog({ doA: makeEntry('doA') });
      expect(() => Walker.resolve([{
        'emit-to': 'scope',
        doA: {},
      }], cat)).toThrow(/emit-to.*requires.*emit-event/i);
    });

    it('works with decorators', () => {
      const steps = Walker.resolve([{
        step: 'retry-emit',
        'emit-event': { type: 'a.b', data: {} },
        retry: 3,
        timeout: '5s',
      }], catalog);
      const s = steps[0] as import('./walker.js').EmitEventStep;
      expect(s.kind).toBe('emit-event');
      expect(s.decorators.retry).toBe(3);
      expect(s.decorators.timeout).toBe('5s');
    });
  });

  describe('inferred method dispatch', () => {
    it('resolves unknown key via resolveInferred', () => {
      const inferredEntry = makeEntry('load-content');
      const catalog = {
        ...makeCatalog({ click: makeEntry('click') }),
        resolveInferred: (name: string) =>
          name === 'load-content' ? inferredEntry : undefined,
      };
      const steps = [{ step: 'load-panel', 'load-content': { role: 'region', name: 'Diff' } }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].kind).toBe('plugin');
      expect(resolved[0].name).toBe('load-panel');
      expect((resolved[0] as any).entry.qualifiedName).toBe('load-content');
    });

    it('throws for unknown key when resolveInferred returns undefined', () => {
      const catalog = {
        ...makeCatalog({}),
        resolveInferred: () => undefined,
      };
      const steps = [{ 'bad-key': {} }];
      expect(() => Walker.resolve(steps, catalog)).toThrow('unknown step key');
    });

    it('throws for unknown key when resolveInferred is not present', () => {
      const catalog = makeCatalog({});
      const steps = [{ 'bad-key': {} }];
      expect(() => Walker.resolve(steps, catalog)).toThrow('unknown step key');
    });

    it('catalog.resolve takes priority over resolveInferred', () => {
      const registeredEntry = makeEntry('click-registered');
      const inferredEntry = makeEntry('click-inferred');
      const catalog = {
        ...makeCatalog({ click: registeredEntry }),
        resolveInferred: () => inferredEntry,
      };
      const steps = [{ click: {} }];
      const resolved = Walker.resolve(steps, catalog);
      expect(resolved[0].kind).toBe('plugin');
      expect((resolved[0] as any).entry.qualifiedName).toBe('click-registered');
    });
  });

  describe('schema parity — keyword acceptance', () => {
    const catalog = makeCatalog({ doA: makeEntry('doA') });

    it('C1: scalar plugin value wrapped as _subject not value', () => {
      const steps = Walker.resolve([{ doA: 'hello' }], catalog);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params).toEqual({ _subject: 'hello' });
        expect(steps[0].params).not.toHaveProperty('value');
      }
    });

    it('C2: capture accepted as decorator key', () => {
      expect(() => Walker.resolve([{ capture: 'result', doA: {} }], catalog)).not.toThrow();
      const steps = Walker.resolve([{ capture: 'result', doA: {} }], catalog);
      expect(steps[0]!.decorators['capture']).toBe('result');
    });

    it('H6: at accepted as decorator key', () => {
      const steps = Walker.resolve([{ at: '2026-01-01T00:00:00Z', doA: {} }], catalog);
      expect(steps[0]!.decorators['at']).toBe('2026-01-01T00:00:00Z');
    });

    it('H6: on-complete accepted as decorator key', () => {
      const steps = Walker.resolve([{ 'on-complete': 'cleanup', doA: {} }], catalog);
      expect(steps[0]!.decorators['on-complete']).toBe('cleanup');
    });

    it('H6: resource accepted as decorator key', () => {
      const steps = Walker.resolve([{ resource: 'db-pool', doA: {} }], catalog);
      expect(steps[0]!.decorators['resource']).toBe('db-pool');
    });

    it('H6: priority accepted as decorator key', () => {
      const steps = Walker.resolve([{ priority: 'high', doA: {} }], catalog);
      expect(steps[0]!.decorators['priority']).toBe('high');
    });

    it('M1: barrier as combined key prefix', () => {
      const steps = Walker.resolve([
        { step: 'a', doA: {} },
        { step: 'b', doA: {} },
        { 'barrier myBarrier': { await: ['a', 'b'] } },
      ], catalog);
      expect(steps[2]!.name).toBe('myBarrier');
      expect(steps[2]!.kind).toBe('barrier');
    });

    it('M1: quorum as combined key prefix', () => {
      const steps = Walker.resolve([
        { step: 'a', doA: {} },
        { step: 'b', doA: {} },
        { 'quorum 2-of-3': { required: 2, of: ['a', 'b'] } },
      ], catalog);
      expect(steps[2]!.name).toBe('2-of-3');
      expect(steps[2]!.kind).toBe('quorum');
    });

    it('M2: concurrent accepted as alias for parallel', () => {
      const steps = Walker.resolve([{
        concurrent: [{ doA: {} }, { doA: {} }],
      }], catalog);
      expect(steps[0]!.kind).toBe('parallel');
      if (steps[0]!.kind === 'parallel') {
        expect(steps[0].steps).toHaveLength(2);
      }
    });

    it('M2: concurrent with named branches', () => {
      const steps = Walker.resolve([{
        concurrent: { branchA: [{ doA: {} }], branchB: [{ doA: {} }] },
      }], catalog);
      expect(steps[0]!.kind).toBe('parallel');
      if (steps[0]!.kind === 'parallel') {
        expect(steps[0].branches).toHaveLength(2);
      }
    });

    it('H8: Result failure type allows detail field', () => {
      const result: import('./walker.js').Result = {
        kind: 'failure',
        message: 'broken',
        detail: { code: 'E001', context: { key: 'val' } },
      };
      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.detail).toEqual({ code: 'E001', context: { key: 'val' } });
      }
    });

    it('M8: vars accepted as reserved key on steps', () => {
      expect(() => Walker.resolve([{ vars: { x: 1 }, doA: {} }], catalog)).not.toThrow();
    });

    it('M8: params accepted as reserved key on steps', () => {
      expect(() => Walker.resolve([{ params: { y: 2 }, doA: {} }], catalog)).not.toThrow();
    });

    it('C4: all step types carry annotations field', () => {
      const steps = Walker.resolve([{ doA: {} }], catalog);
      expect(steps[0]).toHaveProperty('annotations');
    });

    it('M4: pause accepted as structural step type', () => {
      const steps = Walker.resolve([{ pause: 'workflow-gate' }], catalog);
      expect(steps[0]!.kind).toBe('control');
    });

    it('M4: resume accepted as structural step type', () => {
      const steps = Walker.resolve([{ resume: 'workflow-gate' }], catalog);
      expect(steps[0]!.kind).toBe('control');
    });

    it('C3: absorbSiblings causes unknown keys to be absorbed into params', () => {
      const absorbEntry = makeEntry('assertThat');
      absorbEntry.definition.absorbSiblings = true;
      const cat = makeCatalog({ assertThat: absorbEntry });
      const steps = Walker.resolve([{ assertThat: '${expr}', contains: 'expected' }], cat);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params['contains']).toBe('expected');
      }
    });

    it('name accepted as alias for step on structural blocks', () => {
      const steps = Walker.resolve([{ name: 'my-block', block: [{ doA: {} }] }], catalog);
      expect(steps[0]!.name).toBe('my-block');
    });

    it('#735: combined-key invoke shorthand resolves prefix as action', () => {
      const cat = makeCatalog({ 'rest-request': makeEntry('rest-request') });
      const steps = Walker.resolve([{ 'rest-request GET /api/users': {} }], cat);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params['_subject']).toBe('GET /api/users');
      }
    });

    it('#735: combined-key invoke shorthand with object value merges', () => {
      const cat = makeCatalog({ 'rest-request': makeEntry('rest-request') });
      const steps = Walker.resolve([{ 'rest-request GET /api/users': { headers: { auth: 'token' } } }], cat);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params['_subject']).toBe('GET /api/users');
        expect(steps[0].params['headers']).toEqual({ auth: 'token' });
      }
    });

    it('P1: scalar value maps to first required input when definition has inputs', () => {
      const entry = makeEntry('rest-request');
      entry.definition.inputs = { url: { type: 'string' as any, required: true }, method: { type: 'string' as any, required: false } };
      const cat = makeCatalog({ 'rest-request': entry });
      const steps = Walker.resolve([{ 'rest-request': '/api/users' }], cat);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params['url']).toBe('/api/users');
      }
    });

    it('P1: scalar value falls back to _subject when no required inputs', () => {
      const steps = Walker.resolve([{ doA: 'hello' }], catalog);
      expect(steps[0]!.kind).toBe('plugin');
      if (steps[0]!.kind === 'plugin') {
        expect(steps[0].params['_subject']).toBe('hello');
      }
    });
  });

  describe('simulation decorator', () => {
    const catalog = makeCatalog({ 'test-action': makeEntry('test-action') });

    it('block with simulation decorator resolves to BlockStep with simulation in decorators', () => {
      const steps = Walker.resolve([{
        step: 'sim-phase',
        simulation: {
          strategies: { 'agent-provider.invoke': 'sequential' },
          corpus: [{ file: 'fixtures/data.yaml' }],
        },
        block: [
          { 'test-action': {} },
        ],
      }], catalog);

      expect(steps).toHaveLength(1);
      expect(steps[0]!.kind).toBe('block');
      expect(steps[0]!.name).toBe('sim-phase');
      expect(steps[0]!.decorators['simulation']).toEqual({
        strategies: { 'agent-provider.invoke': 'sequential' },
        corpus: [{ file: 'fixtures/data.yaml' }],
      });
    });

    it('simulation key without block is accepted as decorator on action step', () => {
      const steps = Walker.resolve([{
        simulation: { strategies: { 'a': 'random' } },
        'test-action': {},
      }], catalog);

      expect(steps).toHaveLength(1);
      expect(steps[0]!.decorators['simulation']).toBeDefined();
    });

    it('simulation key does not throw unknown key error', () => {
      expect(() => Walker.resolve([{
        simulation: { strategies: {} },
        block: [{ 'test-action': {} }],
      }], catalog)).not.toThrow();
    });

    it('standalone simulation step resolves to zero-delay step', () => {
      const steps = Walker.resolve([{
        step: 'switch-to-simulated',
        simulation: {
          strategies: { 'agent-provider.invoke': 'key-lookup' },
          corpus: ['fixtures/llm-responses.yaml'],
        },
      }], catalog);

      expect(steps).toHaveLength(1);
      expect(steps[0]!.kind).toBe('delay');
      expect((steps[0] as any).duration).toBe(0);
      expect(steps[0]!.decorators['simulation']).toBeDefined();
    });
  });
});
