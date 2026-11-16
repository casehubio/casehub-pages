import { describe, it, expect } from 'vitest';
import { chunkToStream } from './streaming.js';
import type { AgentEvent } from '../step/invoke/session-pipeline.js';

async function collectEvents(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

describe('chunkToStream', () => {
  it('chunks by word and emits text-delta + invocation-complete', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'hello world', chunkStrategy: 'word', delayMs: 0,
    }));
    const deltas = events.filter(e => e.kind === 'text-delta');
    expect(deltas.map(d => (d as { text: string }).text).join('')).toBe('hello world');
    expect(events[events.length - 1]!.kind).toBe('invocation-complete');
  });

  it('chunks by char', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'hi', chunkStrategy: 'char', delayMs: 0,
    }));
    const deltas = events.filter(e => e.kind === 'text-delta');
    expect(deltas).toHaveLength(2);
    expect((deltas[0] as { text: string }).text).toBe('h');
    expect((deltas[1] as { text: string }).text).toBe('i');
  });

  it('keeps combining marks and compound emoji in one character chunk', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'e\u0301👩🏽‍💻🇨🇦', chunkStrategy: 'char', delayMs: 0,
    }));
    expect(events.filter(e => e.kind === 'text-delta')).toEqual([
      { kind: 'text-delta', text: 'e\u0301' },
      { kind: 'text-delta', text: '👩🏽‍💻' },
      { kind: 'text-delta', text: '🇨🇦' },
    ]);
    expect(events[events.length - 1]!.kind).toBe('invocation-complete');
  });

  it('includes token counts in invocation-complete', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'test', chunkStrategy: 'word', delayMs: 0,
      inputTokens: 10, outputTokens: 5,
    }));
    const complete = events.find(e => e.kind === 'invocation-complete')!;
    expect(complete).toMatchObject({ inputTokens: 10, outputTokens: 5 });
  });

  it('defaults token counts to 0', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'x', chunkStrategy: 'word', delayMs: 0,
    }));
    const complete = events.find(e => e.kind === 'invocation-complete')!;
    expect(complete).toMatchObject({ inputTokens: 0, outputTokens: 0 });
  });

  it('handles empty text', async () => {
    const events = await collectEvents(chunkToStream({
      text: '', chunkStrategy: 'word', delayMs: 0,
    }));
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('invocation-complete');
  });
});
