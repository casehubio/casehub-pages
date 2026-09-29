import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PagesStepCatalog } from './step-catalog.js';
import './step-catalog.js';

const MOCK_ACTIONS = [
  { name: 'check-compliance', description: 'Check doc compliance', invokeKind: 'rest', source: 'yaml', inputCount: 2, outputCount: 1 },
  { name: 'mcp.send-email', description: 'Send an email via MCP', invokeKind: 'mcp', source: 'mcp', inputCount: 3, outputCount: 0 },
  { name: 'run-audit', description: 'Run security audit script', invokeKind: 'script', source: 'script', inputCount: 1, outputCount: 2 },
];

const MOCK_DETAIL = {
  name: 'check-compliance',
  description: 'Check doc compliance',
  invokeKind: 'rest',
  source: 'yaml',
  inputs: {
    documentId: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'Document identifier' },
    standard: { type: 'STRING', required: true, defaultValue: 'ISO-27001', allowedValues: ['ISO-27001', 'SOC-2', 'GDPR'], format: null, description: 'Compliance standard' },
  },
  outputs: {
    compliant: { type: 'BOOLEAN', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Whether compliant' },
  },
  invoke: { kind: 'rest', metadata: { method: 'POST', url: 'https://api.example.com/compliance/check' } },
};

function createCatalog(baseUrl = 'http://localhost:8080'): PagesStepCatalog {
  const el = document.createElement('pages-step-catalog') as PagesStepCatalog;
  el.baseUrl = baseUrl;
  el.execBaseUrl = 'http://localhost:9090';
  return el;
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    const body = opts?.body ? JSON.parse(opts.body as string) : {};
    if (typeof url === 'string' && url.includes('/graphql')) {
      if (typeof body.query === 'string' && body.query.includes('catalogAction(')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { catalogAction: MOCK_DETAIL } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { catalogActions: MOCK_ACTIONS } }),
      });
    }
    if (typeof url === 'string' && url.includes('/scenario/catalog/execute')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ kind: 'success', output: { compliant: true }, executionMetadata: {} }),
      });
    }
    return Promise.resolve({ ok: false });
  });
}

describe('pages-step-catalog', () => {
  let el: PagesStepCatalog;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch());
  });

  afterEach(() => {
    el?.remove();
    vi.restoreAllMocks();
  });

  describe('list view', () => {
    it('renders action list after loading', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el.updateComplete;
      const items = el.shadowRoot!.querySelectorAll('.action-item');
      expect(items.length).toBe(3);
    });

    it('shows action name and description', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el.updateComplete;
      const name = el.shadowRoot!.querySelector('.action-name');
      expect(name).not.toBeNull();
      expect(name!.textContent).toBe('check-compliance');
    });

    it('shows source badge', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el.updateComplete;
      const badges = el.shadowRoot!.querySelectorAll('.source-badge');
      expect(badges.length).toBe(3);
      expect(badges[0]!.textContent!.trim()).toBe('yaml');
    });

    it('filters by search text', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      el['_searchText'] = 'compliance';
      await el.updateComplete;
      const items = el.shadowRoot!.querySelectorAll('.action-item');
      expect(items.length).toBe(1);
    });

    it('filters by source chip', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      el['_sourceFilter'] = ['mcp'];
      await el.updateComplete;
      const items = el.shadowRoot!.querySelectorAll('.action-item');
      expect(items.length).toBe(1);
      expect(items[0]!.querySelector('.action-name')!.textContent).toBe('mcp.send-email');
    });

    it('shows empty state when no actions match', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      el['_searchText'] = 'nonexistent';
      await el.updateComplete;
      const empty = el.shadowRoot!.querySelector('.empty');
      expect(empty).not.toBeNull();
    });

    it('search input has correct aria-label', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('input[aria-label="Search step actions"]');
      expect(input).not.toBeNull();
    });

    it('calls GraphQL endpoint with correct query', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  describe('detail view', () => {
    it('shows input schema table', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('.inputs-table');
      expect(table).not.toBeNull();
      const rows = table!.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });

    it('shows output schema table', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('.outputs-table');
      expect(table).not.toBeNull();
    });

    it('back button returns to list', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;
      const back = el.shadowRoot!.querySelector('[aria-label="Back to catalog list"]') as HTMLElement;
      expect(back).not.toBeNull();
      back!.click();
      await el.updateComplete;
      expect(el['_view']).toBe('list');
    });

    it('shows invoke binding summary', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;
      const invoke = el.shadowRoot!.querySelector('.invoke-summary');
      expect(invoke).not.toBeNull();
      expect(invoke!.textContent).toContain('rest');
    });
  });

  describe('try-it execution', () => {
    it('calls execute endpoint and shows result', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;
      await el['_executeAction']();
      await el.updateComplete;
      const result = el.shadowRoot!.querySelector('.try-result');
      expect(result).not.toBeNull();
      expect(result!.classList.contains('success')).toBe(true);
    });
  });

  describe('YAML template', () => {
    it('generates correct YAML from action detail', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      const { PagesStepCatalog: Cls } = await import('./step-catalog.js');
      const yaml = Cls.generateTemplate(MOCK_DETAIL);
      expect(yaml).toContain('- check-compliance:');
      expect(yaml).toContain('documentId:');
      expect(yaml).toContain('"ISO-27001"');
    });

    it('emits event with YAML template on use-template click', async () => {
      el = createCatalog();
      document.body.appendChild(el);
      await el.loadCatalog();
      await el['_loadDetail']('check-compliance');
      await el.updateComplete;

      const events: CustomEvent[] = [];
      el.addEventListener('step-template-selected', (e) => events.push(e as CustomEvent));

      const btn = el.shadowRoot!.querySelector('[aria-label="Use template"]') as HTMLElement;
      expect(btn).not.toBeNull();
      btn!.click();
      await el.updateComplete;

      expect(events.length).toBe(1);
      expect(events[0]!.detail.actionName).toBe('check-compliance');
      expect(events[0]!.detail.yaml).toContain('check-compliance');
    });
  });
});
