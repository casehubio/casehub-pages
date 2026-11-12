import { describe, it, expect, vi } from 'vitest';
import { PageDocument } from './page-document.js';

const MINIMAL_PAGE = `pages:
  - name: Overview
    components:
      - type: title
        properties:
          text: Hello
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

    it('reads flat components', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const comps = doc.getPages()[0]!.getComponents();
      expect(comps).toHaveLength(1);
      expect(comps[0]!.type).toBe('title');
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

  describe('positional insert', () => {
    it('insertChildAt inserts component at index in flat page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const page = doc.getPages()[0]!;

      page.insertChildAt(0, 'metric');

      const comps = page.getComponents();
      expect(comps).toHaveLength(2);
      expect(comps[0]!.type).toBe('metric');
      expect(comps[1]!.type).toBe('title');
    });

    it('insertChildAt appends at end when index equals length', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const page = doc.getPages()[0]!;

      page.insertChildAt(page.getComponents().length, 'metric');

      const comps = page.getComponents();
      expect(comps[comps.length - 1]!.type).toBe('metric');
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

  describe('addChild', () => {
    const TABS_DOC = `pages:
  - name: p1
    components:
      - type: tabs
        tabs:
          "Tab 1":
            components:
              - type: bar-chart`;

    const SIDEBAR_DOC = `pages:
  - name: p1
    components:
      - type: sidebar
        content:
          - type: bar-chart`;

    const SPLIT_DOC = `pages:
  - name: p1
    components:
      - type: split
        split:
          direction: horizontal
          children:
            - type: bar-chart`;

    it('adds child to tabs named-record slot', () => {
      const doc = PageDocument.parse(TABS_DOC);
      const tabs = doc.getPages()[0]!.getComponents()[0]!;
      expect(tabs.isContainer()).toBe(true);

      tabs.addChild('Tab 1', 'line-chart');

      const children = tabs.getChildren();
      expect(children.slots['Tab 1']).toHaveLength(2);
      expect(children.slots['Tab 1']![1]!.type).toBe('line-chart');
    });

    it('adds child to sidebar array slot', () => {
      const doc = PageDocument.parse(SIDEBAR_DOC);
      const sidebar = doc.getPages()[0]!.getComponents()[0]!;

      sidebar.addChild('content', 'line-chart');

      const children = sidebar.getChildren();
      expect(children.slots['content']).toHaveLength(2);
    });

    it('adds child to split nested-array slot', () => {
      const doc = PageDocument.parse(SPLIT_DOC);
      const split = doc.getPages()[0]!.getComponents()[0]!;

      split.addChild('split', 'line-chart');

      const children = split.getChildren();
      expect(children.slots['split']).toHaveLength(2);
      expect(children.slots['split']![1]!.type).toBe('line-chart');
    });

    it('creates new named slot if it does not exist', () => {
      const doc = PageDocument.parse(TABS_DOC);
      const tabs = doc.getPages()[0]!.getComponents()[0]!;

      tabs.addChild('Tab 2', 'pie-chart');

      const children = tabs.getChildren();
      expect(Object.keys(children.slots)).toContain('Tab 2');
      expect(children.slots['Tab 2']![0]!.type).toBe('pie-chart');
    });

    it('throws for non-container component', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart`);
      const comp = doc.getPages()[0]!.getComponents()[0]!;
      expect(() => comp.addChild('slot', 'line-chart')).toThrow();
    });

    it('supports undo', () => {
      const doc = PageDocument.parse(TABS_DOC);
      const tabs = doc.getPages()[0]!.getComponents()[0]!;
      tabs.addChild('Tab 1', 'line-chart');
      expect(tabs.getChildren().slots['Tab 1']).toHaveLength(2);

      doc.undo();
      const restored = doc.getPages()[0]!.getComponents()[0]!;
      expect(restored.getChildren().slots['Tab 1']).toHaveLength(1);
    });

    it('adds child with properties', () => {
      const doc = PageDocument.parse(TABS_DOC);
      const tabs = doc.getPages()[0]!.getComponents()[0]!;

      tabs.addChild('Tab 1', 'metric', { title: 'Revenue' });

      const children = tabs.getChildren();
      const added = children.slots['Tab 1']![1]!;
      expect(added.type).toBe('metric');
      expect(added.getProperties()['title']).toBe('Revenue');
    });
  });

  describe('wrapIn', () => {
    it('wraps component in tabs container', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    rows:
      - columns:
          - components:
              - type: bar-chart
              - type: line-chart`);
      const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
      const barChart = col.getComponents()[0]!;

      const tabsContainer = barChart.wrapIn('tabs');

      expect(tabsContainer.type).toBe('tabs');
      const children = tabsContainer.getChildren();
      expect(children.slots['Tab 1']![0]!.type).toBe('bar-chart');
      const colComps = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!.getComponents();
      expect(colComps).toHaveLength(2);
      expect(colComps[0]!.type).toBe('tabs');
      expect(colComps[1]!.type).toBe('line-chart');
    });

    it('uses defaultContentSlot for sidebar', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart`);
      const comp = doc.getPages()[0]!.getComponents()[0]!;

      const sidebar = comp.wrapIn('sidebar');

      expect(sidebar.type).toBe('sidebar');
      const children = sidebar.getChildren();
      expect(children.slots['content']![0]!.type).toBe('bar-chart');
    });

    it('is atomic — single undo restores original', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart
      - type: line-chart`);
      doc.getPages()[0]!.getComponents()[0]!.wrapIn('tabs');

      doc.undo();
      const comps = doc.getPages()[0]!.getComponents();
      expect(comps).toHaveLength(2);
      expect(comps[0]!.type).toBe('bar-chart');
    });
  });

  describe('replaceWith', () => {
    it('replaces type and preserves compatible properties', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart
        properties:
          title: Revenue`);
      const comp = doc.getPages()[0]!.getComponents()[0]!;

      const newComp = comp.replaceWith('line-chart');

      expect(newComp.type).toBe('line-chart');
      expect(newComp.getProperties()['title']).toBe('Revenue');
    });

    it('preserves position among siblings', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: title
      - type: bar-chart
        properties:
          title: Revenue
      - type: metric`);
      doc.getPages()[0]!.getComponents()[1]!.replaceWith('line-chart');

      const comps = doc.getPages()[0]!.getComponents();
      expect(comps).toHaveLength(3);
      expect(comps[0]!.type).toBe('title');
      expect(comps[1]!.type).toBe('line-chart');
      expect(comps[2]!.type).toBe('metric');
    });

    it('is atomic — single undo restores original', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: bar-chart
        properties:
          title: Test`);
      doc.getPages()[0]!.getComponents()[0]!.replaceWith('line-chart');

      doc.undo();
      expect(doc.getPages()[0]!.getComponents()[0]!.type).toBe('bar-chart');
      expect(doc.getPages()[0]!.getComponents()[0]!.getProperties()['title']).toBe('Test');
    });
  });

  describe('moveToSlot', () => {
    it('moves component into existing named slot', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: tabs
        tabs:
          "Tab 1":
            components:
              - type: bar-chart
      - type: pie-chart`);
      const page = doc.getPages()[0]!;
      const pie = page.getComponents()[1]!;
      const tabsPath = page.getComponents()[0]!.path;

      pie.moveToSlot({ path: [...tabsPath], slotName: 'Tab 1' }, 1);

      const tabs = doc.getPages()[0]!.getComponents()[0]!;
      expect(tabs.getChildren().slots['Tab 1']).toHaveLength(2);
      expect(tabs.getChildren().slots['Tab 1']![1]!.type).toBe('pie-chart');
      expect(doc.getPages()[0]!.getComponents()).toHaveLength(1);
    });

    it('creates new named slot when it does not exist', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: tabs
        tabs:
          "Tab 1":
            components:
              - type: bar-chart
      - type: pie-chart`);
      const pie = doc.getPages()[0]!.getComponents()[1]!;
      const tabsPath = [...doc.getPages()[0]!.getComponents()[0]!.path];

      pie.moveToSlot({ path: tabsPath, slotName: 'Tab 2' }, 0);

      const tabs = doc.getPages()[0]!.getComponents()[0]!;
      expect(tabs.getChildren().slots['Tab 2']).toHaveLength(1);
      expect(tabs.getChildren().slots['Tab 2']![0]!.type).toBe('pie-chart');
    });

    it('is atomic — single undo restores original', () => {
      const doc = PageDocument.parse(`pages:
  - name: p1
    components:
      - type: tabs
        tabs:
          "Tab 1":
            components:
              - type: bar-chart
      - type: pie-chart`);
      const pie = doc.getPages()[0]!.getComponents()[1]!;
      const tabsPath = [...doc.getPages()[0]!.getComponents()[0]!.path];
      pie.moveToSlot({ path: tabsPath, slotName: 'Tab 1' }, 0);

      doc.undo();
      expect(doc.getPages()[0]!.getComponents()).toHaveLength(2);
      expect(doc.getPages()[0]!.getComponents()[1]!.type).toBe('pie-chart');
    });
  });

  describe('yaml-core accessors', () => {
    it('returns modules from document', () => {
      const doc = PageDocument.parse('modules:\n  greeting:\n    parameters:\n      name:\n        type: STRING\n');
      const modules = doc.getModules();
      expect(modules).toBeDefined();
      expect(modules!['greeting']).toBeDefined();
    });

    it('returns undefined when no modules', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.getModules()).toBeUndefined();
    });

    it('returns imports from document', () => {
      const doc = PageDocument.parse('imports:\n  - module: greeting\n    as: hi\n');
      const imports = doc.getImports();
      expect(imports).toBeDefined();
      expect(imports).toHaveLength(1);
      expect((imports![0] as any).module).toBe('greeting');
    });

    it('returns undefined when no imports', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.getImports()).toBeUndefined();
    });

    it('returns variables from document', () => {
      const doc = PageDocument.parse('variables:\n  theme:\n    color: blue\n');
      const vars = doc.getVariables();
      expect(vars).toBeDefined();
      expect((vars!['theme'] as any).color).toBe('blue');
    });

    it('returns undefined when no variables', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.getVariables()).toBeUndefined();
    });
  });

  describe('coordinated mode', () => {
    it('parseCoordinated returns functional instance', () => {
      const doc = PageDocument.parseCoordinated(MINIMAL_PAGE);
      expect(doc.getPages()).toHaveLength(1);
      expect(doc.getPages()[0]!.name).toBe('Overview');
    });

    it('suppresses onChange notifications', () => {
      const doc = PageDocument.parseCoordinated(MINIMAL_PAGE);
      const calls: string[] = [];
      doc.onChange(() => calls.push('notified'));
      doc.getPages()[0]!.name = 'Changed';
      expect(calls).toHaveLength(0);
    });

    it('suppresses internal undo recording', () => {
      const doc = PageDocument.parseCoordinated(MINIMAL_PAGE);
      doc.getPages()[0]!.name = 'Changed';
      expect(doc.canUndo()).toBe(false);
    });

    it('standalone mode still fires notifications', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const calls: string[] = [];
      doc.onChange(() => calls.push('notified'));
      doc.getPages()[0]!.name = 'Changed';
      expect(calls).toHaveLength(1);
    });

    it('standalone mode still records undo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.getPages()[0]!.name = 'Changed';
      expect(doc.canUndo()).toBe(true);
    });

    it('coordinated transaction preserves atomicity', () => {
      const doc = PageDocument.parseCoordinated(MINIMAL_PAGE);
      const page = doc.getPages()[0]!;
      page.addComponent('metric');
      expect(page.getComponents()).toHaveLength(2);
      expect(doc.canUndo()).toBe(false);
    });

    it('coordinated abortTransaction does not pop undo stack', () => {
      const doc = PageDocument.parseCoordinated(MINIMAL_PAGE);
      doc.beginTransaction();
      doc.getPages()[0]!.name = 'temp';
      doc.abortTransaction();
      expect(doc.getPages()[0]!.name).toBe('Overview');
      expect(doc.canUndo()).toBe(false);
    });
  });
});
