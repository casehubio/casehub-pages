import { describe, it, expect } from 'vitest';
import { LifecycleEngine, defaultLifecycleEngine } from './lifecycle-engine.js';
import { ScenarioParser } from '../parser.js';

describe('LifecycleEngine', () => {
  describe('default lifecycle', () => {
    const engine = defaultLifecycleEngine();

    it('has draft as initial state', () => {
      expect(engine.initialState).toBe('draft');
    });

    it('lists all states', () => {
      expect(engine.states).toEqual(['draft', 'active', 'archived']);
    });

    it('allows draft → active', () => {
      expect(engine.canTransition('draft', 'active')).toBe(true);
    });

    it('rejects draft → archived (no direct transition)', () => {
      expect(engine.canTransition('draft', 'archived')).toBe(false);
    });

    it('allows active → archived (archive event)', () => {
      expect(engine.canTransition('active', 'archived')).toBe(true);
    });

    it('allows active → draft (revise event)', () => {
      expect(engine.canTransition('active', 'draft')).toBe(true);
    });

    it('allows archived → draft (resurrect event)', () => {
      expect(engine.canTransition('archived', 'draft')).toBe(true);
    });

    it('rejects archived → active (no direct transition)', () => {
      expect(engine.canTransition('archived', 'active')).toBe(false);
    });

    it('validates allowed transition silently', () => {
      expect(() => engine.validateTransition('draft', 'active')).not.toThrow();
    });

    it('validateTransition throws on invalid transition', () => {
      expect(() => engine.validateTransition('draft', 'archived'))
        .toThrow("Cannot transition from 'draft' to 'archived'");
    });

    it('returns available transitions from active', () => {
      expect(engine.availableTransitions('active')).toEqual(['archived', 'draft']);
    });

    it('returns available transitions from draft', () => {
      expect(engine.availableTransitions('draft')).toEqual(['active']);
    });

    it('returns available transitions from archived', () => {
      expect(engine.availableTransitions('archived')).toEqual(['draft']);
    });

    it('throws on unknown state', () => {
      expect(() => engine.availableTransitions('nonexistent'))
        .toThrow("Unknown state: 'nonexistent'");
    });
  });

  describe('custom lifecycle', () => {
    it('supports additional states', () => {
      const def = ScenarioParser.parse('custom-lifecycle', {
        states: {
          draft: [{ next: 'review' }],
          review: [{ on: { approve: 'active', reject: 'draft' } }],
          active: [{ on: { archive: 'archived' } }],
          archived: 'terminal',
        },
      });
      const engine = new LifecycleEngine(def);

      expect(engine.states).toEqual(['draft', 'review', 'active', 'archived']);
      expect(engine.canTransition('draft', 'review')).toBe(true);
      expect(engine.canTransition('draft', 'active')).toBe(false);
      expect(engine.canTransition('review', 'active')).toBe(true);
      expect(engine.canTransition('review', 'draft')).toBe(true);
      expect(engine.availableTransitions('review')).toEqual(['active', 'draft']);
    });
  });
});
