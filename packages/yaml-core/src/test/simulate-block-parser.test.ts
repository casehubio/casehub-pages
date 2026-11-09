import { describe, it, expect } from 'vitest';
import { SimulateBlockParser } from './simulate-block-parser.js';

describe('SimulateBlockParser (legacy)', () => {
  it('expands agent alias with field mapping', () => {
    const raw = {
      agent: {
        strategy: 'sequential',
        corpus: [{ prompt: 'hello', response: 'world' }],
      },
    };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['agent-provider.invoke']).toBe('sequential');
    const entry = config.corpus[0]!;
    expect('inline' in entry).toBe(true);
    if ('inline' in entry) {
      const data = entry.inline['agent-provider.invoke']!;
      expect(data[0]!.input).toEqual({ key: 'hello' });
      expect(data[0]!.output).toBe('world');
    }
  });

  it('passes through direct qualified names', () => {
    const raw = {
      'rest-request': {
        strategy: 'key-lookup',
        corpus: [{ input: { url: '/api' }, output: { status: 200 } }],
      },
    };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['rest-request']).toBe('key-lookup');
    if ('inline' in config.corpus[0]!) {
      const data = config.corpus[0]!.inline['rest-request']!;
      expect(data[0]!.input).toEqual({ url: '/api' });
    }
  });

  it('expands rest alias', () => {
    const raw = { rest: { strategy: 'passthrough' } };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['rest-request']).toBe('passthrough');
  });

  it('expands mcp alias', () => {
    const raw = { mcp: { strategy: 'sequential' } };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['mcp-call']).toBe('sequential');
  });

  it('handles mixed aliases and direct names', () => {
    const raw = {
      agent: { strategy: 'sequential' },
      'graphql': { strategy: 'key-lookup' },
    };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['agent-provider.invoke']).toBe('sequential');
    expect(config.strategies['graphql']).toBe('key-lookup');
  });

  it('defaults strategy to sequential', () => {
    const raw = { agent: { corpus: [{ prompt: 'a', response: 'b' }] } };
    const config = SimulateBlockParser.parse(raw);
    expect(config.strategies['agent-provider.invoke']).toBe('sequential');
  });

  it('reads capture array', () => {
    const raw = {
      capture: ['agent-provider.invoke', 'rest-request'],
      agent: { strategy: 'sequential' },
    };
    const config = SimulateBlockParser.parse(raw);
    expect(config.capture).toEqual(['agent-provider.invoke', 'rest-request']);
  });

  it('defaults capture to empty array', () => {
    const raw = { agent: { strategy: 'sequential' } };
    const config = SimulateBlockParser.parse(raw);
    expect(config.capture).toEqual([]);
  });

  it('handles no corpus entries', () => {
    const raw = { agent: { strategy: 'passthrough' } };
    const config = SimulateBlockParser.parse(raw);
    expect(config.corpus).toHaveLength(0);
  });
});

describe('SimulateBlockParser.parseToSimulation', () => {
  it('produces MapSimulationConfig with strategy', () => {
    const { config } = SimulateBlockParser.parseToSimulation({
      agent: { strategy: 'sequential', corpus: [{ prompt: 'hi', response: 'hello' }] },
    });
    expect(config.strategyFor('agent-provider.invoke')).toBe('sequential');
  });

  it('seeds corpus with entries', () => {
    const { corpus } = SimulateBlockParser.parseToSimulation({
      agent: { strategy: 'sequential', corpus: [{ prompt: 'hi', response: 'hello' }] },
    });
    expect(corpus.size('agent-provider.invoke')).toBe(1);
    expect(corpus.lookupByIndex('agent-provider.invoke', 0)).toBe('hello');
  });

  it('parses exhaustion policy', () => {
    const { config } = SimulateBlockParser.parseToSimulation({
      agent: { strategy: 'sequential', exhaustion: 'clamp', corpus: [] },
    });
    expect(config.exhaustionPolicy('agent-provider.invoke')).toBe('CLAMP');
  });

  it('parses lookup-count selection', () => {
    const { config } = SimulateBlockParser.parseToSimulation({
      agent: {
        strategy: 'sequential',
        corpus: [],
        selection: {
          kind: 'lookup-count',
          phases: { greeting: 1, conversation: 3 },
        },
      },
    });
    const sel = config.corpusSelection('agent-provider.invoke');
    expect(sel).toBeDefined();
    expect(sel!.kind).toBe('lookup-count');
    if (sel!.kind === 'lookup-count') {
      expect(sel!.orderedPhases).toEqual([
        { name: 'greeting', count: 1 },
        { name: 'conversation', count: 3 },
      ]);
    }
  });

  it('parses state-machine selection', () => {
    const { config } = SimulateBlockParser.parseToSimulation({
      agent: {
        strategy: 'sequential',
        corpus: [],
        selection: {
          kind: 'state-machine',
          initial: 'idle',
          transitions: { idle: { start: 'running' } },
          phases: { idle: [], running: [] },
        },
      },
    });
    const sel = config.corpusSelection('agent-provider.invoke');
    expect(sel).toBeDefined();
    expect(sel!.kind).toBe('state-machine');
    if (sel!.kind === 'state-machine') {
      expect(sel!.initial).toBe('idle');
      expect(sel!.transitions.get('idle')?.get('start')).toBe('running');
    }
  });

  it('parses streaming config on corpus entries', () => {
    const { corpus } = SimulateBlockParser.parseToSimulation({
      agent: {
        strategy: 'sequential',
        corpus: [
          { prompt: 'hi', response: 'hello world', streaming: { delay: '50ms' } },
        ],
      },
    });
    const output = corpus.lookupByIndex('agent-provider.invoke', 0) as Record<string, unknown>;
    expect(output).toBeDefined();
    expect(output['text']).toBe('hello world');
    expect(output['chunkStrategy']).toBe('word');
    expect(output['delayMs']).toBe(50);
  });

  it('parses delay in seconds', () => {
    const { corpus } = SimulateBlockParser.parseToSimulation({
      agent: {
        strategy: 'sequential',
        corpus: [
          { prompt: 'hi', response: 'text', streaming: { delay: '1s' } },
        ],
      },
    });
    const output = corpus.lookupByIndex('agent-provider.invoke', 0) as Record<string, unknown>;
    expect(output['delayMs']).toBe(1000);
  });

  it('handles capture array', () => {
    const { config } = SimulateBlockParser.parseToSimulation({
      capture: ['agent-provider.invoke'],
      agent: { strategy: 'sequential' },
    });
    expect(config.captureEnabled('agent-provider.invoke')).toBe(true);
    expect(config.captureEnabled('unknown')).toBe(false);
  });
});
