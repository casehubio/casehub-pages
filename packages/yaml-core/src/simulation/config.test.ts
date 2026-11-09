import { describe, it, expect } from 'vitest';
import { MapSimulationConfig } from './config.js';

describe('MapSimulationConfig', () => {
  it('returns undefined for unconfigured strategy', () => {
    const config = new MapSimulationConfig();
    expect(config.strategyFor('unknown')).toBeUndefined();
  });

  it('returns configured strategy', () => {
    const config = new MapSimulationConfig({ strategies: { 'action': 'sequential' } });
    expect(config.strategyFor('action')).toBe('sequential');
  });

  it('defaults speed to 1.0', () => {
    const config = new MapSimulationConfig();
    expect(config.speed()).toBe(1.0);
  });

  it('returns configured speed', () => {
    const config = new MapSimulationConfig({ speed: 2.5 });
    expect(config.speed()).toBe(2.5);
  });

  it('captureEnabled returns false by default', () => {
    const config = new MapSimulationConfig();
    expect(config.captureEnabled('action')).toBe(false);
  });

  it('captureEnabled returns true for captured actions', () => {
    const config = new MapSimulationConfig({ capture: ['action'] });
    expect(config.captureEnabled('action')).toBe(true);
  });

  it('returns configured exhaustion policy', () => {
    const config = new MapSimulationConfig({ exhaustionPolicies: { 'a': 'CLAMP' } });
    expect(config.exhaustionPolicy('a')).toBe('CLAMP');
  });

  it('returns configured match policy', () => {
    const config = new MapSimulationConfig({ matchPolicies: { 'a': 'ALL' } });
    expect(config.matchPolicy('a')).toBe('ALL');
  });

  it('returns configured threshold', () => {
    const config = new MapSimulationConfig({ thresholds: { 'a': 0.8 } });
    expect(config.threshold('a')).toBe(0.8);
  });

  it('returns configured fallthrough realism', () => {
    const config = new MapSimulationConfig({ fallthroughRealism: { 'a': 'PLACEHOLDER' } });
    expect(config.fallthroughRealism('a')).toBe('PLACEHOLDER');
  });

  it('returns corpus selection config', () => {
    const sel = {
      kind: 'lookup-count' as const,
      orderedPhases: [{ name: 'a', count: 2 }],
      phases: new Map(),
    };
    const config = new MapSimulationConfig({ corpusSelections: { 'action': sel } });
    expect(config.corpusSelection('action')).toBe(sel);
    expect(config.corpusSelectionKeys()).toEqual(['action']);
  });

  it('returns corpus selection group', () => {
    const config = new MapSimulationConfig({ corpusSelectionGroups: { 'a': 'group1' } });
    expect(config.corpusSelectionGroup('a')).toBe('group1');
  });

  it('returns triggers', () => {
    const triggers = [{ event: 'click', action: 'advance' }];
    const config = new MapSimulationConfig({ triggers });
    expect(config.triggers()).toEqual(triggers);
  });

  it('returns empty triggers by default', () => {
    const config = new MapSimulationConfig();
    expect(config.triggers()).toEqual([]);
  });
});
