import { describe, it, expect, vi } from 'vitest';
import { AgentSessionOpenHandler } from './agent-session-open-handler.js';
import type { AgentSessionOpenBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

function mockPipeline(): SessionPipeline {
  return {
    openSession: vi.fn().mockResolvedValue(undefined),
    sessionFor: vi.fn().mockReturnValue(undefined),
    releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionOpenHandler', () => {
  it('supports agent-session-open binding', () => {
    const handler = new AgentSessionOpenHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-open', descriptor: 's1' } as AgentSessionOpenBinding)).toBe(true);
    expect(handler.supports({ kind: 'agent' } as any)).toBe(false);
  });

  it('opens session with default system prompt', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-1' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 'chat-1' });
    expect(pipeline.openSession).toHaveBeenCalledWith('chat-1', { system: 'You are a helpful assistant.' }, 'manual');
  });

  it('opens session with custom system prompt and model', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-2', system: 'Expert mode.', model: 'gpt-4' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    await action.execute({});
    expect(pipeline.openSession).toHaveBeenCalledWith('chat-2', { system: 'Expert mode.', model: 'gpt-4' }, 'manual');
  });

  it('returns failure on pipeline error', async () => {
    const pipeline = mockPipeline();
    (pipeline.openSession as any).mockRejectedValue(new Error('pool exhausted'));
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-3' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') expect(result.message).toContain('pool exhausted');
  });
});
