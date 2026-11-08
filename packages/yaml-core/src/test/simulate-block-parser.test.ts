import { describe, it, expect } from 'vitest';
import { SimulateBlockParser } from './simulate-block-parser.js';

describe('SimulateBlockParser', () => {
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
