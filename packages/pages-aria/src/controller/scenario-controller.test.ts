import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventConnection } from '@casehubio/pages-data';
import './scenario-controller.js';
import type { PagesScenarioController } from './scenario-controller.js';

function mockConnection(): EventConnection {
  return {
    listen: vi.fn().mockResolvedValue({ topics: ['scenario:state'] }),
    unlisten: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    close: vi.fn(),
    connected: true,
    status: 'connected' as const,
  } as unknown as EventConnection;
}

function fireStateEvent(target: EventTarget, payload: Record<string, unknown>): void {
  target.dispatchEvent(new CustomEvent('pages-event', {
    detail: { topic: 'scenario:state', payload },
  }));
}

describe('pages-scenario-controller', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ scenario: null, chapter: null, section: null, step: null, paused: false, speed: 1.0, progress: 0, content: null, slides: null }),
    }));
  });

  it('registers as custom element', () => {
    expect(customElements.get('pages-scenario-controller')).toBeDefined();
  });

  it('renders error when no connection configured', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain('No connection configured');
    el.remove();
  });

  it('renders idle state with connection', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.textContent).toContain('No scenario running');
    expect(el.shadowRoot?.textContent).toContain('Idle');
    expect(conn.listen).toHaveBeenCalledWith(['scenario:state']);
    el.remove();
  });

  it('updates state from scenario:state event', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;

    const outlineData = [
      { label: 'Ch1', target: null, children: [
        { label: 'Step 1', target: 'browser', children: [] },
      ]},
    ];
    const idleState = { scenario: null, chapter: null, section: null, step: null, paused: false, speed: 1.0, progress: 0, content: null, slides: null };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scenario/outline')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(outlineData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(idleState) });
    }));

    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    fireStateEvent(target, {
      scenario: 'test-demo', chapter: 'Ch1', section: 'S1',
      step: 'Step 1', paused: false, speed: 1.0, progress: 0.25,
      content: null, slides: null,
    });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    await el.updateComplete;

    expect(el.shadowRoot?.textContent).toContain('Step 1');
    expect(el.shadowRoot?.textContent).toContain('25%');
    el.remove();
  });

  it('sends pause command on button click', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;

    const idleState = { scenario: null, chapter: null, section: null, step: null, paused: false, speed: 1.0, progress: 0, content: null, slides: null };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scenario/outline')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(idleState) });
    }));

    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    fireStateEvent(target, {
      scenario: 'test', chapter: null, section: null,
      step: 'S1', paused: false, speed: 1.0, progress: 0,
      content: null, slides: null,
    });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    await el.updateComplete;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    const pauseBtn = el.shadowRoot?.querySelector('button[aria-label="Pause"]') as HTMLButtonElement;
    expect(pauseBtn).not.toBeNull();
    pauseBtn.click();

    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/scenario/pause'),
      expect.objectContaining({ method: 'POST' }),
    );
    el.remove();
  });

  it('shows resume button when paused', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    document.body.appendChild(el);
    await el.updateComplete;

    fireStateEvent(target, {
      scenario: 'test', chapter: null, section: null,
      step: 'S1', paused: true, speed: 1.0, progress: 0,
      content: null, slides: null,
    });
    await el.updateComplete;

    const resumeBtn = el.shadowRoot?.querySelector('button[aria-label="Resume"]');
    expect(resumeBtn).toBeDefined();
    el.remove();
  });

  it('disables buttons when no scenario active', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    document.body.appendChild(el);
    await el.updateComplete;

    const buttons = el.shadowRoot?.querySelectorAll('button');
    buttons?.forEach(btn => {
      expect(btn.disabled).toBe(true);
    });
    el.remove();
  });

  it('space key toggles play/pause', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;

    const idleState = { scenario: null, chapter: null, section: null, step: null, paused: false, speed: 1.0, progress: 0, content: null, slides: null };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scenario/outline')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(idleState) });
    }));

    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    fireStateEvent(target, {
      scenario: 'test', chapter: null, section: null,
      step: 'S1', paused: false, speed: 1.0, progress: 0,
      content: null, slides: null,
    });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    await el.updateComplete;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/scenario/pause'),
      expect.objectContaining({ method: 'POST' }),
    );
    el.remove();
  });

  it('renders source toggle button in compact card', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    el.mode = 'compact';
    el.baseUrl = 'http://localhost:8080';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    document.body.appendChild(el);
    await el.updateComplete;
    (el as any)._expanded = true;
    await el.updateComplete;
    const btn = el.shadowRoot?.querySelector('[aria-label="Toggle source"]');
    expect(btn).not.toBeNull();
    el.remove();
  });

  it('creates yaml viewer on toggle and sets snapped state', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    el.mode = 'compact';
    el.baseUrl = 'http://localhost:8080';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    document.body.appendChild(el);
    await el.updateComplete;
    (el as any)._expanded = true;
    await el.updateComplete;

    const toggleBtn = el.shadowRoot?.querySelector('[aria-label="Toggle source"]') as HTMLButtonElement;
    toggleBtn.click();
    await el.updateComplete;

    const viewer = document.querySelector('pages-scenario-yaml-viewer');
    expect(viewer).not.toBeNull();
    expect((el as any)._snapped).toBe(true);
    expect((el as any)._yamlOpen).toBe(true);

    toggleBtn.click();
    await el.updateComplete;
    expect(viewer?.style.display).toBe('none');
    expect((el as any)._yamlOpen).toBe(false);

    el.remove();
    viewer?.remove();
  });

  it('shows unsnap button when yaml viewer is open and snapped', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    el.mode = 'compact';
    el.baseUrl = 'http://localhost:8080';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    document.body.appendChild(el);
    await el.updateComplete;
    (el as any)._expanded = true;
    await el.updateComplete;

    const toggleBtn = el.shadowRoot?.querySelector('[aria-label="Toggle source"]') as HTMLButtonElement;
    toggleBtn.click();
    await el.updateComplete;

    const unsnapBtn = el.shadowRoot?.querySelector('[aria-label="Unsnap viewer"]');
    expect(unsnapBtn).not.toBeNull();

    unsnapBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    expect((el as any)._snapped).toBe(false);

    const unsnapBtnAfter = el.shadowRoot?.querySelector('[aria-label="Unsnap viewer"]');
    expect(unsnapBtnAfter).toBeNull();

    el.remove();
    document.querySelector('pages-scenario-yaml-viewer')?.remove();
  });

  it('cleans up on disconnect', async () => {
    const el = document.createElement('pages-scenario-controller') as PagesScenarioController;
    const conn = mockConnection();
    const target = new EventTarget();
    el.connection = conn;
    el.eventTarget = target;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    document.body.appendChild(el);
    await el.updateComplete;
    el.remove();

    expect(conn.unlisten).toHaveBeenCalledWith(['scenario:state']);
  });
});
