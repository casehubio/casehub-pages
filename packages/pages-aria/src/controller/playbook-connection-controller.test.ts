import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventConnection } from '@casehubio/pages-data';
import { PlaybookConnectionController } from './playbook-connection-controller';

const host = () => ({
  addController: vi.fn(), removeController: vi.fn(),
  requestUpdate: vi.fn(), updateComplete: Promise.resolve(true),
});

describe('playbook state compatibility', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['playbook', 'scenario'])('accepts %s in push state', (field) => {
    const target = new EventTarget();
    const controller = new PlaybookConnectionController(host(), { eventTarget: target });
    controller.hostConnected();
    target.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario:state', payload: { [field]: 'helpdesk', progress: 0.5 } },
    }));
    expect(controller.state.scenario).toBe('helpdesk');
    expect(controller.state.progress).toBe(0.5);
    controller.hostDisconnected();
  });

  it('hydrates the current backend playbook name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ playbook: 'helpdesk', progress: 0.25 }),
    }));
    const connection: EventConnection = {
      listen: vi.fn().mockResolvedValue({ topics: [] }),
      unlisten: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(), close: vi.fn(), connected: true, status: 'connected',
    };
    const controller = new PlaybookConnectionController(host(), {
      connection, eventTarget: new EventTarget(),
    });
    controller.hostConnected();
    await vi.waitFor(() => expect(controller.state.scenario).toBe('helpdesk'));
    expect(controller.state.progress).toBe(0.25);
    controller.hostDisconnected();
  });

  it.each(['playbook', 'scenario'])('keeps a null %s idle', (field) => {
    const target = new EventTarget();
    const controller = new PlaybookConnectionController(host(), { eventTarget: target });
    controller.hostConnected();
    target.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario:state', payload: { [field]: null } },
    }));
    expect(controller.state.scenario).toBeNull();
    controller.hostDisconnected();
  });
});
