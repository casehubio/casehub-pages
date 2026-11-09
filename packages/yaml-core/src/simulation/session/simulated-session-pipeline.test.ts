import { describe, it, expect } from 'vitest';
import { SimulatedSessionPipeline } from './simulated-session-pipeline.js';
import { InMemorySimulationCorpus } from '../in-memory-corpus.js';
import { MapSimulationConfig } from '../config.js';
import type { AgentEvent } from '../../step/invoke/session-pipeline.js';

async function collectEvents(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

function textFrom(events: AgentEvent[]): string {
  return events
    .filter(e => e.kind === 'text-delta')
    .map(e => (e as { text: string }).text)
    .join('');
}

describe('SimulatedSessionPipeline', () => {
  it('openSession creates a session, sessionFor returns it', async () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('agent-session.chat', '', '', 'hello');
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');
    const session = pipeline.sessionFor('chat');
    expect(session).toBeDefined();
  });

  it('sessionFor returns undefined for unknown name', () => {
    const corpus = new InMemorySimulationCorpus();
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    expect(pipeline.sessionFor('unknown')).toBeUndefined();
  });

  it('releaseSession removes the session', async () => {
    const corpus = new InMemorySimulationCorpus();
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');
    await pipeline.releaseSession('chat');
    expect(pipeline.sessionFor('chat')).toBeUndefined();
  });

  it('query returns streaming events from corpus entries', async () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('agent-session.chat', '', '', 'hello world');
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');

    const session = pipeline.sessionFor('chat')!;
    const events = await collectEvents(session.query('hi'));
    expect(textFrom(events)).toBe('hello world');
    expect(events[events.length - 1]!.kind).toBe('invocation-complete');
  });

  it('query advances through sequential corpus entries', async () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('agent-session.chat', '', '', 'first');
    corpus.record('agent-session.chat', '', '', 'second');
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');

    const session = pipeline.sessionFor('chat')!;
    const e1 = await collectEvents(session.query('q1'));
    expect(textFrom(e1)).toBe('first');
    const e2 = await collectEvents(session.query('q2'));
    expect(textFrom(e2)).toBe('second');
  });

  it('clear resets session position back to first entry', async () => {
    const corpus = new InMemorySimulationCorpus();
    corpus.record('agent-session.chat', '', '', 'first');
    corpus.record('agent-session.chat', '', '', 'second');
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');

    const session = pipeline.sessionFor('chat')!;
    await collectEvents(session.query('q1'));
    await session.clear();
    const events = await collectEvents(session.query('q2'));
    expect(textFrom(events)).toBe('first');
  });

  it('handles empty corpus gracefully', async () => {
    const corpus = new InMemorySimulationCorpus();
    const pipeline = new SimulatedSessionPipeline(corpus, new MapSimulationConfig());
    await pipeline.openSession('chat', { system: 'test' }, 'manual');

    const session = pipeline.sessionFor('chat')!;
    const events = await collectEvents(session.query('hi'));
    expect(events[events.length - 1]!.kind).toBe('invocation-complete');
  });
});
