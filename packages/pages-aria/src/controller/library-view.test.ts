import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PagesLibraryView } from './library-view.js';
import './library-view.js';

const MOCK_LIBRARY = [
  {
    name: 'onboard-team',
    description: 'Onboard team members',
    labels: ['domain:hr'],
    tags: ['getting-started'],
    params: [],
    calls: [],
    provenance: 'BUNDLED',
    firstStepTargets: [{ role: 'button', name: 'Submit' }],
  },
  {
    name: 'resolve-ticket',
    description: 'Close a support ticket',
    labels: ['domain:helpdesk'],
    tags: [],
    params: [{ name: 'ticketId', type: 'string', required: true }],
    calls: [],
    provenance: 'UPLOADED',
    firstStepTargets: [{ role: 'textbox', name: 'Ticket ID' }],
  },
  {
    name: 'navigate-only',
    description: 'Navigate to dashboard',
    labels: [],
    tags: [],
    params: [],
    calls: [],
    provenance: 'BUNDLED',
    firstStepTargets: [],
  },
];

function createView(baseUrl = 'http://localhost:8080'): PagesLibraryView {
  const el = document.createElement('pages-library-view') as PagesLibraryView;
  el.baseUrl = baseUrl;
  return el;
}

describe('pages-library-view', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button aria-label="Submit">Submit</button>';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scenario/library') && !url.includes('/yaml')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_LIBRARY),
        });
      }
      if (url.includes('/yaml')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('scenario: test\nsteps: []'),
        });
      }
      return Promise.resolve({ ok: false });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers as custom element', () => {
    expect(customElements.get('pages-library-view')).toBeDefined();
  });

  it('fetches and renders script list', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll('.script-item');
    expect(items?.length).toBe(3);
    expect(el.shadowRoot?.textContent).toContain('onboard-team');
    expect(el.shadowRoot?.textContent).toContain('resolve-ticket');
    el.remove();
  });

  it('shows readiness indicator per script', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    const indicators = el.shadowRoot?.querySelectorAll('.readiness');
    expect(indicators?.length).toBe(3);
    const texts = Array.from(indicators ?? []).map(i => i.textContent?.trim());
    expect(texts).toContain('ready');
    expect(texts).toContain('not-ready');
    expect(texts).toContain('unknown');
    el.remove();
  });

  it('filters by search text', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    el.searchText = 'onboard';
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll('.script-item');
    expect(items?.length).toBe(1);
    expect(el.shadowRoot?.textContent).toContain('onboard-team');
    el.remove();
  });

  it('filters by label', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    el.filterLabels = ['domain:helpdesk'];
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll('.script-item');
    expect(items?.length).toBe(1);
    expect(el.shadowRoot?.textContent).toContain('resolve-ticket');
    el.remove();
  });

  it('emits script-selected event on run click', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('script-selected', handler);

    const runBtn = el.shadowRoot?.querySelector('.script-item .run-btn') as HTMLButtonElement;
    expect(runBtn).not.toBeNull();
    runBtn.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].detail.name).toBe('onboard-team');
    el.remove();
  });

  it('shows provenance badge', async () => {
    const el = createView();
    document.body.appendChild(el);
    await el.updateComplete;
    await el.loadLibrary();
    await el.updateComplete;

    const badges = el.shadowRoot?.querySelectorAll('.provenance');
    const texts = Array.from(badges ?? []).map(b => b.textContent?.trim());
    expect(texts).toContain('bundled');
    expect(texts).toContain('uploaded');
    el.remove();
  });

  it('renders from scripts property without fetch', async () => {
    const el = document.createElement('pages-library-view') as PagesLibraryView;
    el.scripts = MOCK_LIBRARY as any;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll('.script-item');
    expect(items?.length).toBe(3);
    expect(el.shadowRoot?.textContent).toContain('onboard-team');
    el.remove();
  });

  it('filters scripts property by search text', async () => {
    const el = document.createElement('pages-library-view') as PagesLibraryView;
    el.scripts = MOCK_LIBRARY as any;
    document.body.appendChild(el);
    await el.updateComplete;

    el.searchText = 'resolve';
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll('.script-item');
    expect(items?.length).toBe(1);
    expect(el.shadowRoot?.textContent).toContain('resolve-ticket');
    el.remove();
  });

  it('emits script-selected from scripts property mode', async () => {
    const el = document.createElement('pages-library-view') as PagesLibraryView;
    el.scripts = MOCK_LIBRARY as any;
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('script-selected', handler);

    const runBtn = el.shadowRoot?.querySelector('.script-item .run-btn') as HTMLButtonElement;
    runBtn.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].detail.name).toBe('onboard-team');
    el.remove();
  });
});
