import { describe, it, expect } from 'vitest';
import { SimulationRuntime, inputContains } from './runtime.js';
import { MapSimulationConfig } from './config.js';
import { InMemorySimulationCorpus } from './in-memory-corpus.js';

describe('SimulationRuntime', () => {
  it('constructs with defaults (no-arg backward compat)', () => {
    const rt = new SimulationRuntime();
    expect(rt.globalSpeed()).toBe(1.0);
    expect(rt.hasActiveOverlay()).toBe(false);
  });

  it('constructs with config and corpus', () => {
    const config = new MapSimulationConfig({ speed: 2.0 });
    const corpus = new InMemorySimulationCorpus();
    const rt = new SimulationRuntime(config, corpus);
    expect(rt.globalSpeed()).toBe(2.0);
  });

  it('push/pop overlay stack', () => {
    const rt = new SimulationRuntime();
    const overlay = rt.pushOverlay(new MapSimulationConfig());
    expect(rt.hasActiveOverlay()).toBe(true);
    rt.popOverlay(overlay);
    expect(rt.hasActiveOverlay()).toBe(false);
  });

  it('popAll clears stack', () => {
    const rt = new SimulationRuntime();
    rt.pushOverlay(new MapSimulationConfig());
    rt.pushOverlay(new MapSimulationConfig());
    rt.popAll();
    expect(rt.hasActiveOverlay()).toBe(false);
  });

  it('strategyFor resolves from overlay config', () => {
    const rt = new SimulationRuntime();
    const corpus = new InMemorySimulationCorpus();
    corpus.record('action', '', '', 'result');
    rt.pushOverlay(new MapSimulationConfig({ strategies: { 'action': 'sequential' } }), corpus);
    const strategy = rt.strategyFor('action');
    expect(strategy).toBeDefined();
    expect(strategy!.resolve('')).toBe('result');
  });

  it('strategyFor resolves from base config', () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('action', '', '', 'base-result');
    const rt = new SimulationRuntime(
      new MapSimulationConfig({ strategies: { 'action': 'sequential' } }),
      corpus,
    );
    const strategy = rt.strategyFor('action');
    expect(strategy).toBeDefined();
    expect(strategy!.resolve('')).toBe('base-result');
  });

  it('strategyFor returns undefined for unknown', () => {
    const rt = new SimulationRuntime();
    expect(rt.strategyFor('unknown')).toBeUndefined();
  });

  it('resolve delegates to strategyFor', () => {
    const rt = new SimulationRuntime();
    const corpus = new InMemorySimulationCorpus();
    corpus.record('action', '', '', 'result');
    rt.pushOverlay(new MapSimulationConfig({ strategies: { 'action': 'sequential' } }), corpus);
    const resolved = rt.resolve('action', '');
    expect(resolved).toEqual({ output: 'result', realism: 'DOMAIN_PLAUSIBLE' });
  });

  it('resolve returns undefined for unknown', () => {
    const rt = new SimulationRuntime();
    expect(rt.resolve('unknown', '')).toBeUndefined();
  });

  it('resolves strategy aliases', () => {
    const rt = new SimulationRuntime();
    const corpus = new InMemorySimulationCorpus();
    corpus.record('action', '', '', 'result');
    rt.pushOverlay(new MapSimulationConfig({ strategies: { 'action': 'seq' } }), corpus);
    expect(rt.resolve('action', '')).toBeDefined();
  });

  it('passthrough strategy returns undefined', () => {
    const rt = new SimulationRuntime();
    rt.pushOverlay(new MapSimulationConfig({ strategies: { 'action': 'passthrough' } }));
    expect(rt.resolve('action', '')).toBeUndefined();
  });

  it('recordJournal writes to top overlay', () => {
    const rt = new SimulationRuntime();
    rt.pushOverlay(new MapSimulationConfig());
    rt.recordJournal('action', 't', 'in', 'out', 'DOMAIN_PLAUSIBLE');
    expect(rt.allEntries()).toHaveLength(1);
    expect(rt.allEntriesFor('action')).toHaveLength(1);
  });

  it('recordJournal no-op without overlays', () => {
    const rt = new SimulationRuntime();
    rt.recordJournal('action', 't', 'in', 'out', 'DOMAIN_PLAUSIBLE');
    expect(rt.allEntries()).toHaveLength(0);
  });

  it('fallthroughRealism walks overlay stack', () => {
    const rt = new SimulationRuntime(
      new MapSimulationConfig({ fallthroughRealism: { 'a': 'PLACEHOLDER' } }),
    );
    expect(rt.fallthroughRealism('a')).toBe('PLACEHOLDER');
    rt.pushOverlay(new MapSimulationConfig({ fallthroughRealism: { 'a': 'GARBAGE' } }));
    expect(rt.fallthroughRealism('a')).toBe('GARBAGE');
  });

  it('fallthroughRealism defaults to RECORDED_REAL', () => {
    const rt = new SimulationRuntime();
    expect(rt.fallthroughRealism('unknown')).toBe('RECORDED_REAL');
  });

  it('globalSpeed get/set', () => {
    const rt = new SimulationRuntime();
    expect(rt.globalSpeed()).toBe(1.0);
    rt.setGlobalSpeed(3.0);
    expect(rt.globalSpeed()).toBe(3.0);
  });

  it('setGlobalSpeed rejects non-positive', () => {
    const rt = new SimulationRuntime();
    expect(() => rt.setGlobalSpeed(0)).toThrow();
    expect(() => rt.setGlobalSpeed(-1)).toThrow();
  });

  it('pushProfile resolves and pushes', () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('action', '', '', 'profile-result');
    const rt = new SimulationRuntime();
    rt.setProfileSource({
      resolve: (name) => name === 'test'
        ? { config: new MapSimulationConfig({ strategies: { 'action': 'sequential' } }), corpus }
        : undefined,
    });
    rt.pushProfile('test');
    expect(rt.resolve('action', '')).toBeDefined();
  });

  it('pushProfile throws for missing source', () => {
    const rt = new SimulationRuntime();
    expect(() => rt.pushProfile('x')).toThrow(/No ProfileSource/);
  });

  it('pushProfile throws for unknown profile', () => {
    const rt = new SimulationRuntime();
    rt.setProfileSource({ resolve: () => undefined });
    expect(() => rt.pushProfile('x')).toThrow(/Unknown simulation profile/);
  });

  it('selector management — state machine', () => {
    const rt = new SimulationRuntime();
    const transitions = new Map([['idle', new Map([['go', 'running']])]]);
    const phases = new Map<string, never[]>([['idle', []], ['running', []]]);
    rt.pushOverlay(new MapSimulationConfig({
      strategies: { 'action': 'sequential' },
      corpusSelections: {
        'action': { kind: 'state-machine', initial: 'idle', transitions, phases },
      },
    }));
    rt.initializeSelectors();

    expect(rt.stateMachineSelector('action')).toBeDefined();
    expect(rt.stateMachineStates().get('action')).toBe('idle');
    rt.advanceStateMachine('action', 'go');
    expect(rt.stateMachineStates().get('action')).toBe('running');
  });

  it('advanceStateMachines advances all SMs', () => {
    const rt = new SimulationRuntime();
    const transitions = new Map([['a', new Map([['x', 'b']])]]);
    const phases = new Map<string, never[]>([['a', []], ['b', []]]);
    rt.pushOverlay(new MapSimulationConfig({
      strategies: { 's1': 'sequential', 's2': 'sequential' },
      corpusSelections: {
        's1': { kind: 'state-machine', initial: 'a', transitions, phases },
        's2': { kind: 'state-machine', initial: 'a', transitions, phases },
      },
    }));

    rt.advanceStateMachines('x');
    const states = rt.stateMachineStates();
    expect(states.get('s1')).toBe('b');
    expect(states.get('s2')).toBe('b');
  });

  it('allSelectorInfo returns all selectors', () => {
    const rt = new SimulationRuntime();
    rt.pushOverlay(new MapSimulationConfig({
      strategies: { 'a': 'sequential' },
      corpusSelections: {
        'a': { kind: 'lookup-count', orderedPhases: [{ name: 'p1', count: 1 }], phases: new Map() },
      },
    }));
    const info = rt.allSelectorInfo();
    expect(info.get('a')).toEqual({ type: 'lookup-count', activePhase: 'p1' });
  });

  it('resetSelector resets a selector', () => {
    const rt = new SimulationRuntime();
    const transitions = new Map([['a', new Map([['go', 'b']])]]);
    const phases = new Map<string, never[]>([['a', []], ['b', []]]);
    rt.pushOverlay(new MapSimulationConfig({
      strategies: { 'x': 'sequential' },
      corpusSelections: {
        'x': { kind: 'state-machine', initial: 'a', transitions, phases },
      },
    }));
    rt.advanceStateMachine('x', 'go');
    expect(rt.stateMachineStates().get('x')).toBe('b');
    rt.resetSelector('x');
    expect(rt.stateMachineStates().get('x')).toBe('a');
  });

  it('resetSelector throws for unknown', () => {
    const rt = new SimulationRuntime();
    expect(() => rt.resetSelector('unknown')).toThrow();
  });

  it('overlay strategies take priority over base', () => {
    const baseCorp = new InMemorySimulationCorpus();
    baseCorp.record('action', '', '', 'base');
    const rt = new SimulationRuntime(
      new MapSimulationConfig({ strategies: { 'action': 'sequential' } }),
      baseCorp,
    );

    const overCorp = new InMemorySimulationCorpus();
    overCorp.record('action', '', '', 'overlay');
    rt.pushOverlay(new MapSimulationConfig({ strategies: { 'action': 'sequential' } }), overCorp);

    expect(rt.resolve('action', '')?.output).toBe('overlay');
  });
});

describe('inputContains', () => {
  it('null/undefined pattern matches anything', () => {
    expect(inputContains('hello', null)).toBe(true);
    expect(inputContains('hello', undefined)).toBe(true);
  });

  it('primitives match by equality', () => {
    expect(inputContains('hello', 'hello')).toBe(true);
    expect(inputContains('hello', 'world')).toBe(false);
    expect(inputContains(42, 42)).toBe(true);
  });

  it('objects match when pattern keys are subset', () => {
    expect(inputContains({ a: 1, b: 2 }, { a: 1 })).toBe(true);
    expect(inputContains({ a: 1, b: 2 }, { a: 2 })).toBe(false);
  });

  it('nested objects match recursively', () => {
    expect(inputContains({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(inputContains({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('null actual fails object pattern', () => {
    expect(inputContains(null, { a: 1 })).toBe(false);
  });
});
