import { describe, it, expect, vi } from 'vitest';
import { AgentSessionQueryHandler } from './agent-session-query-handler.js';
import type { AgentSessionQueryBinding } from '../types.js';
import type { SessionPipeline, AgentEvent, AgentSession } from './session-pipeline.js';

function mockSession(events: AgentEvent[]): AgentSession {
  return {
    async *query(_prompt: string) { for (const e of events) yield e; },
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function mockPipeline(sessions: Record<string, AgentSession> = {}): SessionPipeline {
  return {
    openSession: vi.fn().mockResolvedValue(undefined),
    sessionFor: vi.fn((name: string) => sessions[name]),
    releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionQueryHandler', () => {
  it('supports agent-session-query binding', () => {
    const handler = new AgentSessionQueryHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-query', sessionRef: 's1', user: 'hi' } as AgentSessionQueryBinding)).toBe(true);
    expect(handler.supports({ kind: 'agent' } as any)).toBe(false);
  });

  it('collects text deltas into response', async () => {
    const session = mockSession([
      { kind: 'text-delta', text: 'Hello' },
      { kind: 'text-delta', text: ' world' },
      { kind: 'invocation-complete', inputTokens: 10, outputTokens: 5, durationMs: 100 },
    ]);
    const pipeline = mockPipeline({ 'chat-1': session });
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 'chat-1', user: 'Hi' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output.response).toBe('Hello world');
      expect(result.output.inputTokens).toBe(10);
      expect(result.output.outputTokens).toBe(5);
      expect(result.output.durationMs).toBe(100);
    }
  });

  it('returns failure when session not found', async () => {
    const pipeline = mockPipeline({});
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 'missing', user: 'Hi' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') expect(result.message).toContain('Session not found');
  });

  it('handles query with no invocation-complete event', async () => {
    const session = mockSession([
      { kind: 'text-delta', text: 'Just text' },
    ]);
    const pipeline = mockPipeline({ 's1': session });
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 's1', user: 'Q' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output.response).toBe('Just text');
  });
});
