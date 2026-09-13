import { describe, it, expect, afterEach } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { buildTreeModel, type TreeNodeInfo } from './builder-tree.js';
import './builder-tree.js';
import type { PagesBuilderTree } from './builder-tree.js';

const MINIMAL_PAGE = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello
`;

const ROWS_PAGE = `pages:
- name: Dashboard
  rows:
  - columns:
    - span: 6
      components:
      - type: bar-chart
        properties:
          subtype: column
    - span: 6
      components:
      - type: pie-chart
`;

const WITH_DATASETS = `datasets:
- uuid: sales_tx
  name: Sales
  url: /api/sales
pages:
- name: Overview
  components:
  - type: metric
    properties:
      lookup:
        uuid: sales_tx
`;

const WITH_TABS = `pages:
- name: Overview
  components:
  - type: tabs
    tabs:
      Tab 1:
        components:
        - type: title
          properties:
            text: First
      Tab 2:
        components:
        - type: title
          properties:
            text: Second
`;

const WITH_NAV = `pages:
- name: Overview
  components:
  - type: title
navTree:
  root_items:
  - type: GROUP
    id: main-group
    children:
    - type: ITEM
      page: Overview
`;

// --- Model builder tests (pure logic) ---

describe('buildTreeModel', () => {
  it('builds Pages section from minimal page', () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    const model = buildTreeModel(doc);
    expect(model).toHaveLength(1);
    expect(model[0]!.label).toBe('Pages');
    expect(model[0]!.nodeType).toBe('section');
    expect(model[0]!.children).toHaveLength(1);

    const page = model[0]!.children[0]!;
    expect(page.label).toBe('Overview');
    expect(page.nodeType).toBe('page');
    expect(page.children).toHaveLength(1);

    const comp = page.children[0]!;
    expect(comp.nodeType).toBe('component');
    expect(comp.label).toBe('Hello');
  });

  it('builds row > column > component hierarchy', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const model = buildTreeModel(doc);
    const page = model[0]!.children[0]!;
    expect(page.children).toHaveLength(1);

    const row = page.children[0]!;
    expect(row.nodeType).toBe('row');
    expect(row.label).toBe('Row');
    expect(row.children).toHaveLength(2);

    const col1 = row.children[0]!;
    expect(col1.nodeType).toBe('column');
    expect(col1.label).toBe('Column (6)');
    expect(col1.children).toHaveLength(1);
    expect(col1.children[0]!.label).toBe('Bar Chart');
  });

  it('builds Datasets section', () => {
    const doc = PageDocument.parse(WITH_DATASETS);
    const model = buildTreeModel(doc);
    expect(model[0]!.label).toBe('Datasets');
    expect(model[0]!.children).toHaveLength(1);

    const ds = model[0]!.children[0]!;
    expect(ds.nodeType).toBe('dataset');
    expect(ds.label).toBe('Sales');
  });

  it('derives label from lookup.uuid', () => {
    const doc = PageDocument.parse(WITH_DATASETS);
    const model = buildTreeModel(doc);
    const pagesSection = model.find(s => s.label === 'Pages')!;
    const metricNode = pagesSection.children[0]!.children[0]!;
    expect(metricNode.label).toBe('sales_tx');
  });

  it('builds container children for tabs', () => {
    const doc = PageDocument.parse(WITH_TABS);
    const model = buildTreeModel(doc);
    const tabsNode = model[0]!.children[0]!.children[0]!;
    expect(tabsNode.label).toBe('Tabs');
    expect(tabsNode.children).toHaveLength(2);
    expect(tabsNode.children[0]!.label).toBe('Tab 1');
    expect(tabsNode.children[0]!.children[0]!.label).toBe('First');
    expect(tabsNode.children[1]!.label).toBe('Tab 2');
  });

  it('builds Navigation section', () => {
    const doc = PageDocument.parse(WITH_NAV);
    const model = buildTreeModel(doc);
    const navSection = model.find(s => s.label === 'Navigation');
    expect(navSection).toBeDefined();
    expect(navSection!.children).toHaveLength(1);
    expect(navSection!.children[0]!.label).toBe('main-group');
    expect(navSection!.children[0]!.nodeType).toBe('nav-item');
    expect(navSection!.children[0]!.children).toHaveLength(1);
  });

  it('returns empty array for empty document', () => {
    const doc = PageDocument.empty();
    expect(buildTreeModel(doc)).toHaveLength(0);
  });

  it('uses component type as fallback label', () => {
    const doc = PageDocument.parse(`pages:\n- name: P\n  components:\n  - type: bar-chart\n`);
    const model = buildTreeModel(doc);
    const comp = model[0]!.children[0]!.children[0]!;
    expect(comp.label).toBe('Bar Chart');
  });
});

// --- DOM rendering tests ---

describe('PagesBuilderTree', () => {
  let el: PagesBuilderTree;

  afterEach(() => {
    el?.remove();
  });

  it('renders page nodes as tree items', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
    expect(items.length).toBeGreaterThan(0);

    const tree = el.shadowRoot!.querySelector('[role="tree"]');
    expect(tree).toBeTruthy();
    expect(tree!.getAttribute('aria-label')).toBe('Document outline');
  });

  it('renders with correct aria-level', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
    const levels = Array.from(items).map(i => i.getAttribute('aria-level'));
    expect(levels).toContain('1');
    expect(levels).toContain('2');
  });

  it('emits node-select on click', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('node-select', ((e: CustomEvent) => events.push(e)) as EventListener);

    const pageItem = el.shadowRoot!.querySelector('[data-node-type="page"]') as HTMLElement;
    pageItem?.click();

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.nodeType).toBe('page');
    expect(events[0]!.detail.path).toBeDefined();
  });

  it('sections start expanded and toggle on click', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;

    const section = el.shadowRoot!.querySelector('[data-node-type="section"]') as HTMLElement;
    expect(section?.getAttribute('aria-expanded')).toBe('true');

    section?.click();
    await el.updateComplete;

    expect(section?.getAttribute('aria-expanded')).toBe('false');
  });

  it('updates tree when document changes', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;

    doc.addPage('New Page');
    await el.updateComplete;

    const labels = Array.from(el.shadowRoot!.querySelectorAll('.label')).map(l => l.textContent);
    expect(labels).toContain('New Page');
  });

  it('renders empty when no document set', async () => {
    el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
    expect(items).toHaveLength(0);
  });
});
