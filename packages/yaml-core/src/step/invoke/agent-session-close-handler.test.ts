import { describe, it, expect, vi } from 'vitest';
import { AgentSessionCloseHandler } from './agent-session-close-handler.js';
import type { AgentSessionCloseBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

function mockPipeline(): SessionPipeline {
  return {
    openSession: vi.fn(), sessionFor: vi.fn(), releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionCloseHandler', () => {
  it('supports agent-session-close binding', () => {
    const handler = new AgentSessionCloseHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-close', sessionRef: 's1' } as AgentSessionCloseBinding)).toBe(true);
  });

  it('releases session successfully', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionCloseHandler(pipeline);
    const binding: AgentSessionCloseBinding = { kind: 'agent-session-close', sessionRef: 'chat-1' };
    const action = handler.create({ name: 'close', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 'chat-1', closed: true });
    expect(pipeline.releaseSession).toHaveBeenCalledWith('chat-1');
  });

  it('returns failure on release error', async () => {
    const pipeline = mockPipeline();
    (pipeline.releaseSession as any).mockRejectedValue(new Error('already closed'));
    const handler = new AgentSessionCloseHandler(pipeline);
    const binding: AgentSessionCloseBinding = { kind: 'agent-session-close', sessionRef: 'chat-1' };
    const action = handler.create({ name: 'close', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
  });
});
