import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScenarioHandler } from './scenario-handler.js';
import type { EventConnection } from '@casehubio/pages-data';

function mockConnection(): EventConnection & { sent: object[]; commandResults: object[] } {
  const sent: object[] = [];
  return {
    sent,
    get commandResults() {
      return sent.filter((m) => (m as Record<string, unknown>).op === 'command-result');
    },
    send(msg: object) { sent.push(msg); },
    listen: vi.fn().mockResolvedValue({ topics: ['scenario:exec'] }),
    unlisten: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    get connected() { return true; },
    get status() { return 'connected' as const; },
  };
}

function fireCommand(target: EventTarget, data: Record<string, unknown>): void {
  target.dispatchEvent(new CustomEvent('pages-event', {
    detail: { topic: 'scenario:exec', payload: data },
  }));
}

describe('ScenarioHandler', () => {
  let eventTarget: EventTarget;

  beforeEach(() => {
    eventTarget = new EventTarget();
  });

  it('subscribes to scenario:exec on creation', async () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);
    expect(conn.listen).toHaveBeenCalledWith(['scenario:exec']);
    handler.dispose();
  });

  it('executes click command and sends ok result', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    const button = document.createElement('button');
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Submit');
    document.body.appendChild(button);

    const clicked = vi.fn();
    button.addEventListener('click', clicked);

    fireCommand(eventTarget, {
      id: 'cmd-1',
      action: 'click',
      target: { role: 'button', name: 'Submit' },
    });

    expect(clicked).toHaveBeenCalled();
    expect(conn.commandResults).toHaveLength(1);
    expect(conn.commandResults[0]).toEqual({
      op: 'command-result',
      id: 'cmd-1',
      ok: true,
      error: null,
    });

    document.body.removeChild(button);
    handler.dispose();
  });

  it('executes fill command', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    const input = document.createElement('input');
    input.setAttribute('role', 'textbox');
    input.setAttribute('aria-label', 'Name');
    document.body.appendChild(input);

    fireCommand(eventTarget, {
      id: 'cmd-2',
      action: 'fill',
      target: { role: 'textbox', name: 'Name' },
      value: 'Alice',
    });

    expect(input.value).toBe('Alice');
    expect(conn.commandResults[0]).toEqual({
      op: 'command-result',
      id: 'cmd-2',
      ok: true,
      error: null,
    });

    document.body.removeChild(input);
    handler.dispose();
  });

  it('sends error result when target not found', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    fireCommand(eventTarget, {
      id: 'cmd-3',
      action: 'click',
      target: { role: 'button', name: 'Nonexistent' },
    });

    expect(conn.commandResults).toHaveLength(1);
    expect(conn.commandResults[0]).toMatchObject({
      op: 'command-result',
      id: 'cmd-3',
      ok: false,
    });
    expect((conn.commandResults[0] as Record<string, unknown>).error).toContain('Nonexistent');

    handler.dispose();
  });

  it('sends error for unknown action', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    fireCommand(eventTarget, {
      id: 'cmd-4',
      action: 'hover',
      target: { role: 'button', name: 'X' },
    });

    expect(conn.commandResults[0]).toMatchObject({
      op: 'command-result',
      id: 'cmd-4',
      ok: false,
    });
    expect((conn.commandResults[0] as Record<string, unknown>).error).toContain('hover');

    handler.dispose();
  });

  it('executes ready action — no-op that confirms handler is active', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    fireCommand(eventTarget, {
      id: 'cmd-ready',
      action: 'ready',
    });

    expect(conn.commandResults).toHaveLength(1);
    expect(conn.commandResults[0]).toEqual({
      op: 'command-result',
      id: 'cmd-ready',
      ok: true,
      error: null,
    });

    handler.dispose();
  });

  it('ignores non-scenario:exec topics', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    eventTarget.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'data/update', payload: { id: 'x' } },
    }));

    eventTarget.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario/old-format', payload: { id: 'y', action: 'click' } },
    }));

    expect(conn.commandResults).toHaveLength(0);
    handler.dispose();
  });

  it('unlistens on dispose', () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);
    handler.dispose();
    expect(conn.unlisten).toHaveBeenCalledWith(['scenario:exec']);
  });
});

describe('ScenarioHandler sequence protocol', () => {
  let eventTarget: EventTarget;

  beforeEach(() => {
    eventTarget = new EventTarget();
  });

  it('sends executor-register on creation', () => {
    const conn = mockConnection();
    createScenarioHandler(conn, eventTarget);
    const reg = conn.sent.find(
      (m) => (m as Record<string, unknown>).op === 'executor-register');
    expect(reg).toBeDefined();
    expect((reg as Record<string, unknown>).name).toBe('browser');
  });

  it('executes dispatch-sequence steps and sends step-result', async () => {
    const conn = mockConnection();
    createScenarioHandler(conn, eventTarget);

    eventTarget.dispatchEvent(new CustomEvent('scenario-dispatch', {
      detail: {
        op: 'dispatch-sequence',
        sessionId: 's-001',
        steps: [{
          name: 'ready-step',
          label: 'Ready check',
          commands: [{ action: 'ready' }],
        }],
        speed: 1.0,
        paused: false,
      },
    }));

    await vi.waitFor(() => {
      const results = conn.sent.filter(
        (m) => (m as Record<string, unknown>).op === 'step-result');
      expect(results).toHaveLength(1);
    });

    const result = conn.sent.find(
      (m) => (m as Record<string, unknown>).op === 'step-result') as Record<string, unknown>;
    expect(result.stepName).toBe('ready-step');
    expect(result.sessionId).toBe('s-001');
    expect(result.ok).toBe(true);
  });

  it('executes multiple steps in sequence', async () => {
    const conn = mockConnection();
    createScenarioHandler(conn, eventTarget);

    eventTarget.dispatchEvent(new CustomEvent('scenario-dispatch', {
      detail: {
        op: 'dispatch-sequence',
        sessionId: 's-001',
        steps: [
          { name: 'step-1', label: 'First', commands: [{ action: 'ready' }] },
          { name: 'step-2', label: 'Second', commands: [{ action: 'ready' }] },
        ],
        speed: 1000,
        paused: false,
      },
    }));

    await vi.waitFor(() => {
      const results = conn.sent.filter(
        (m) => (m as Record<string, unknown>).op === 'step-result');
      expect(results).toHaveLength(2);
    });

    const results = conn.sent
      .filter((m) => (m as Record<string, unknown>).op === 'step-result')
      .map((m) => (m as Record<string, unknown>).stepName);
    expect(results).toEqual(['step-1', 'step-2']);
  });

  it('pauses on executor-control pause', async () => {
    const conn = mockConnection();
    const handler = createScenarioHandler(conn, eventTarget);

    eventTarget.dispatchEvent(new CustomEvent('scenario-dispatch', {
      detail: {
        op: 'dispatch-sequence',
        sessionId: 's-001',
        steps: [
          { name: 'step-1', label: 'First', commands: [{ action: 'ready' }] },
          { name: 'step-2', label: 'Second', commands: [{ action: 'ready' }] },
        ],
        speed: 1000,
        paused: true,
      },
    }));

    // Paused — no step results should be sent yet (beyond what might execute before pause takes effect)
    await new Promise((r) => setTimeout(r, 50));
    const results = conn.sent.filter(
      (m) => (m as Record<string, unknown>).op === 'step-result');
    expect(results.length).toBeLessThanOrEqual(0);

    handler.dispose();
  });

  it('reports error for failing command in step', async () => {
    const conn = mockConnection();
    createScenarioHandler(conn, eventTarget);

    eventTarget.dispatchEvent(new CustomEvent('scenario-dispatch', {
      detail: {
        op: 'dispatch-sequence',
        sessionId: 's-001',
        steps: [{
          name: 'fail-step',
          label: 'Will fail',
          commands: [{
            action: 'click',
            target: { role: 'button', name: 'Nonexistent-Seq-Test' },
          }],
        }],
        speed: 1000,
        paused: false,
      },
    }));

    await vi.waitFor(() => {
      const results = conn.sent.filter(
        (m) => (m as Record<string, unknown>).op === 'step-result');
      expect(results).toHaveLength(1);
    });

    const result = conn.sent.find(
      (m) => (m as Record<string, unknown>).op === 'step-result') as Record<string, unknown>;
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
