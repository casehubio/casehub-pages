import { describe, it, expect, vi } from 'vitest';
import { AgentSessionClearHandler } from './agent-session-clear-handler.js';
import type { AgentSessionClearBinding } from '../types.js';
import type { SessionPipeline, AgentSession } from './session-pipeline.js';

function mockSession(): AgentSession {
  return { async *query() {}, clear: vi.fn().mockResolvedValue(undefined) };
}

function mockPipeline(sessions: Record<string, AgentSession> = {}): SessionPipeline {
  return {
    openSession: vi.fn(), sessionFor: vi.fn((n: string) => sessions[n]), releaseSession: vi.fn(),
  };
}

describe('AgentSessionClearHandler', () => {
  it('supports agent-session-clear binding', () => {
    const handler = new AgentSessionClearHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-clear', sessionRef: 's1' } as AgentSessionClearBinding)).toBe(true);
  });

  it('clears session successfully', async () => {
    const session = mockSession();
    const pipeline = mockPipeline({ 's1': session });
    const handler = new AgentSessionClearHandler(pipeline);
    const binding: AgentSessionClearBinding = { kind: 'agent-session-clear', sessionRef: 's1' };
    const action = handler.create({ name: 'clear', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 's1', cleared: true });
    expect(session.clear).toHaveBeenCalled();
  });

  it('returns failure when session not found', async () => {
    const handler = new AgentSessionClearHandler(mockPipeline({}));
    const binding: AgentSessionClearBinding = { kind: 'agent-session-clear', sessionRef: 'missing' };
    const action = handler.create({ name: 'clear', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
  });
});
