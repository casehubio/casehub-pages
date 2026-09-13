import { describe, it, expect, vi } from 'vitest';
import { PageDocument } from './page-document.js';

const MINIMAL_PAGE = `pages:
  - name: Overview
    components:
      - type: title
        properties:
          text: Hello
`;

const ROWS_PAGE = `pages:
- name: Overview
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

const COLUMNS_PAGE = `pages:
- name: Overview
  columns:
  - span: 4
    components:
    - type: metric
  - span: 8
    components:
    - type: data-table
`;

const WITH_DATASETS = `datasets:
- uuid: sales_tx
  url: /api/sales
  columns:
  - id: amount
    type: NUMBER
  - id: region
    type: LABEL
pages:
- name: Overview
  components:
  - type: bar-chart
    properties:
      lookup:
        uuid: sales_tx
`;

const WITH_NAV = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello
- name: Details
  components:
  - type: data-table
navTree:
  root_items:
  - type: GROUP
    id: MainNav
    children:
    - page: Overview
    - page: Details
`;

const WITH_COMMENT = `# Sales Dashboard
pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello  # greeting
`;

describe('PageDocument', () => {
  describe('parse and round-trip', () => {
    it('preserves YAML formatting on round-trip', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.toString()).toBe(MINIMAL_PAGE);
    });

    it('creates empty document', () => {
      const doc = PageDocument.empty();
      expect(doc.getPages()).toHaveLength(0);
      expect(doc.getDatasets()).toHaveLength(0);
    });

    it('parses invalid YAML without throwing', () => {
      const doc = PageDocument.parse('pages:\n  - [invalid: yaml: here');
      expect(doc.diagnostics.length).toBeGreaterThan(0);
    });

    it('preserves comments', () => {
      const doc = PageDocument.parse(WITH_COMMENT);
      expect(doc.toString()).toContain('# Sales Dashboard');
      expect(doc.toString()).toContain('# greeting');
    });
  });

  describe('pages', () => {
    it('lists pages', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const pages = doc.getPages();
      expect(pages).toHaveLength(1);
      expect(pages[0]!.name).toBe('Overview');
    });

    it('adds a page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      expect(doc.getPages()).toHaveLength(2);
      expect(doc.getPages()[1]!.name).toBe('Dashboard');
    });

    it('removes a page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      doc.removePage(0);
      expect(doc.getPages()).toHaveLength(1);
      expect(doc.getPages()[0]!.name).toBe('Dashboard');
    });
  });

  describe('datasets', () => {
    it('reads existing datasets', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const datasets = doc.getDatasets();
      expect(datasets).toHaveLength(1);
      expect(datasets[0]!.uuid).toBe('sales_tx');
    });

    it('adds a dataset', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addDataset('sales_tx');
      expect(doc.getDatasets()).toHaveLength(1);
      expect(doc.getDatasets()[0]!.uuid).toBe('sales_tx');
      expect(doc.toString()).toContain('uuid: sales_tx');
    });

    it('removes a dataset', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      doc.removeDataset(0);
      expect(doc.getDatasets()).toHaveLength(0);
    });

    it('reads dataset columns', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const ds = doc.getDatasets()[0]!;
      const cols = ds.getColumns();
      expect(cols).toHaveLength(2);
      expect(cols[0]!.id).toBe('amount');
      expect(cols[0]!.type).toBe('NUMBER');
    });

    it('reads dataset source', () => {
      const doc = PageDocument.parse(WITH_DATASETS);
      const ds = doc.getDatasets()[0]!;
      expect(ds.getSource()).toBe('url');
      expect(ds.url).toBe('/api/sales');
    });
  });

  describe('layout modes', () => {
    it('detects flat layout', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.getPages()[0]!.getLayoutMode()).toBe('flat');
    });

    it('detects rows layout', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      expect(doc.getPages()[0]!.getLayoutMode()).toBe('rows');
    });

    it('detects columns layout', () => {
      const doc = PageDocument.parse(COLUMNS_PAGE);
      expect(doc.getPages()[0]!.getLayoutMode()).toBe('columns');
    });

    it('reads flat components', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comps = doc.getPages()[0]!.getComponents();
      expect(comps).toHaveLength(1);
      expect(comps[0]!.type).toBe('title');
    });
  });

  describe('rows and columns', () => {
    it('reads rows', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      const rows = doc.getPages()[0]!.getRows();
      expect(rows).toHaveLength(1);
    });

    it('reads columns within rows', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      const cols = doc.getPages()[0]!.getRows()[0]!.getColumns();
      expect(cols).toHaveLength(2);
      expect(cols[0]!.span).toBe(6);
      expect(cols[1]!.span).toBe(6);
    });

    it('reads components within columns', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      const comps = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!.getComponents();
      expect(comps).toHaveLength(1);
      expect(comps[0]!.type).toBe('bar-chart');
    });

    it('adds a row', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      doc.getPages()[0]!.addRow();
      expect(doc.getPages()[0]!.getRows()).toHaveLength(2);
    });

    it('adds a component to a column', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
      col.addComponent('metric', { subtype: 'card' });
      expect(col.getComponents()).toHaveLength(2);
      expect(col.getComponents()[1]!.type).toBe('metric');
    });

    it('preserves formatting after column mutation', () => {
      const doc = PageDocument.parse(ROWS_PAGE);
      const comp = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!.getComponents()[0]!;
      comp.setProperty('title', 'Revenue');
      const yaml = doc.toString();
      expect(yaml).toContain('bar-chart');
      expect(yaml).toContain('title: Revenue');
    });

    it('reads columns-layout columns', () => {
      const doc = PageDocument.parse(COLUMNS_PAGE);
      const cols = doc.getPages()[0]!.getColumns();
      expect(cols).toHaveLength(2);
      expect(cols[0]!.span).toBe(4);
      expect(cols[0]!.getComponents()[0]!.type).toBe('metric');
    });
  });

  describe('component properties', () => {
    it('reads properties', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comp = doc.getPages()[0]!.getComponents()[0]!;
      expect(comp.getProperties()).toEqual({ text: 'Hello' });
    });

    it('sets a property', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comp = doc.getPages()[0]!.getComponents()[0]!;
      comp.setProperty('text', 'World');
      expect(comp.getProperties()['text']).toBe('World');
      expect(doc.toString()).toContain('text: World');
    });

    it('removes a property', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comp = doc.getPages()[0]!.getComponents()[0]!;
      comp.removeProperty('text');
      expect(comp.getProperties()['text']).toBeUndefined();
    });

    it('adds a new property', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comp = doc.getPages()[0]!.getComponents()[0]!;
      comp.setProperty('size', 'h1');
      expect(comp.getProperties()['size']).toBe('h1');
    });
  });

  describe('navigation', () => {
    it('reads navTree', () => {
      const doc = PageDocument.parse(WITH_NAV);
      const nav = doc.getNavTree();
      expect(nav).toBeDefined();
      expect(nav!.children).toHaveLength(1);
      expect(nav!.children[0]!.id).toBe('MainNav');
    });

    it('reads nav children', () => {
      const doc = PageDocument.parse(WITH_NAV);
      const group = doc.getNavTree()!.children[0]!;
      expect(group.children).toHaveLength(2);
      expect(group.children[0]!.page).toBe('Overview');
      expect(group.children[1]!.page).toBe('Details');
    });
  });

  describe('undo/redo', () => {
    it('undoes a mutation', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      expect(doc.getPages()).toHaveLength(2);
      doc.undo();
      expect(doc.getPages()).toHaveLength(1);
      expect(doc.getPages()[0]!.name).toBe('Overview');
    });

    it('redoes after undo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      doc.undo();
      doc.redo();
      expect(doc.getPages()).toHaveLength(2);
    });

    it('clears redo stack on new mutation after undo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('A');
      doc.undo();
      doc.addPage('B');
      expect(doc.redo()).toBe(false);
    });

    it('reports canUndo/canRedo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.canUndo()).toBe(false);
      doc.addPage('A');
      expect(doc.canUndo()).toBe(true);
      expect(doc.canRedo()).toBe(false);
      doc.undo();
      expect(doc.canRedo()).toBe(true);
    });

    it('respects stack limit', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      for (let i = 0; i < 60; i++) {
        doc.addPage(`Page-${i}`);
      }
      let undoCount = 0;
      while (doc.undo()) undoCount++;
      expect(undoCount).toBeLessThanOrEqual(50);
    });
  });

  describe('onChange', () => {
    it('fires on mutation', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const listener = vi.fn();
      doc.onChange(listener);
      doc.addPage('Dashboard');
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0]![0]).toContain('Dashboard');
    });

    it('unsubscribes', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const listener = vi.fn();
      const unsub = doc.onChange(listener);
      unsub();
      doc.addPage('Dashboard');
      expect(listener).not.toHaveBeenCalled();
    });

    it('fires on undo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      const listener = vi.fn();
      doc.onChange(listener);
      doc.undo();
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('properties', () => {
    it('reads document-level properties', () => {
      const doc = PageDocument.parse('properties:\n  GoalsFunction: SUM\npages: []\n');
      expect(doc.getProperties()).toEqual({ GoalsFunction: 'SUM' });
    });

    it('sets document-level property', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.setProperty('theme', 'dark');
      expect(doc.getProperties()['theme']).toBe('dark');
    });
  });

  describe('add component to flat page', () => {
    it('adds component to flat page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.getPages()[0]!.addComponent('bar-chart', { subtype: 'column' });
      const comps = doc.getPages()[0]!.getComponents();
      expect(comps).toHaveLength(2);
      expect(comps[1]!.type).toBe('bar-chart');
      expect(comps[1]!.getProperties()['subtype']).toBe('column');
    });

    it('emits canonical format', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.getPages()[0]!.addComponent('metric');
      const yaml = doc.toString();
      expect(yaml).toContain('type: metric');
    });
  });

  describe('transaction API', () => {
    it('compound operation is a single undo step', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart
      - type: line-chart`);
      const page = doc.getPages()[0]!;
      expect(page.getComponents()).toHaveLength(2);

      doc.beginTransaction();
      page.removeChild(1);
      page.removeChild(0);
      page.addComponent('pie-chart');
      doc.commitTransaction();

      expect(page.getComponents()).toHaveLength(1);
      expect(doc.getPages()[0]!.getComponents()[0]!.type).toBe('pie-chart');

      doc.undo();
      const restored = doc.getPages()[0]!.getComponents();
      expect(restored).toHaveLength(2);
      expect(restored[0]!.type).toBe('bar-chart');
      expect(restored[1]!.type).toBe('line-chart');
    });

    it('suppresses notifications during transaction, fires one on commit', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart`);
      const notifications: string[] = [];
      doc.onChange(() => notifications.push('changed'));

      doc.beginTransaction();
      doc.getPages()[0]!.addComponent('line-chart');
      doc.getPages()[0]!.addComponent('pie-chart');
      expect(notifications).toHaveLength(0);

      doc.commitTransaction();
      expect(notifications).toHaveLength(1);
    });

    it('abortTransaction restores pre-transaction state', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart`);
      const original = doc.toString();

      doc.beginTransaction();
      doc.getPages()[0]!.removeChild(0);
      expect(doc.getPages()[0]!.getComponents()).toHaveLength(0);

      doc.abortTransaction();
      expect(doc.toString()).toBe(original);
      expect(doc.getPages()[0]!.getComponents()).toHaveLength(1);
      expect(doc.canUndo()).toBe(false);
    });

    it('beginTransaction throws if already in transaction', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1`);
      doc.beginTransaction();
      expect(() => doc.beginTransaction()).toThrow();
      doc.commitTransaction();
    });

    it('abortTransaction fires no notification', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart`);
      const notifications: string[] = [];
      doc.onChange(() => notifications.push('changed'));

      doc.beginTransaction();
      doc.getPages()[0]!.removeChild(0);
      doc.abortTransaction();
      expect(notifications).toHaveLength(0);
    });
  });
});
