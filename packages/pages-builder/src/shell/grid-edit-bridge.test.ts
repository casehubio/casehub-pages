// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { GridEditBridge } from './grid-edit-bridge.js';

const GRID_YAML = `pages:
  - title: Test
    items:
      - placement: { x: 0, y: 0, w: 6, h: 2 }
        component:
          type: chart
      - placement: { x: 6, y: 0, w: 6, h: 1 }
        component:
          type: table
`;

const GRID_3ITEMS_YAML = `pages:
  - title: Test
    items:
      - placement: { x: 0, y: 0, w: 6, h: 4 }
        component:
          type: chart
      - placement: { x: 6, y: 0, w: 6, h: 2 }
        component:
          type: table
      - placement: { x: 6, y: 2, w: 6, h: 2 }
        component:
          type: summary
`;

describe('GridEditBridge', () => {
  describe('move', () => {
    it('updates placements for moved items only', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 3, y: 1, w: 6, h: 2 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
        ],
      });

      const items = doc.getPages()[0]!.getItems();
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 3, y: 1, w: 6, h: 2 });
      expect(items[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 6, y: 0, w: 6, h: 1 });
    });

    it('skips items whose placement has not changed', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const original = doc.toString();
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 0, y: 0, w: 6, h: 2 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
        ],
      });

      expect(doc.toString()).toBe(original);
    });
  });

  describe('resize', () => {
    it('updates w/h and x/y for top-left resize', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'resize',
        items: [
          { at: { mode: 'positioned', x: 1, y: 1, w: 5, h: 1 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
        ],
      });

      expect(doc.getPages()[0]!.getItems()[0]!.getPlacement()).toEqual(
        { mode: 'positioned', x: 1, y: 0, w: 5, h: 1 }
      );
    });
  });

  describe('insert', () => {
    it('appends new item with placement and type', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'insert',
        placement: { mode: 'positioned', x: 0, y: 2, w: 12, h: 1 },
        componentType: 'summary',
      });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[2]!.type).toBe('summary');
      expect(items[2]!.getPlacement()).toEqual(
        { mode: 'positioned', x: 0, y: 2, w: 12, h: 1 }
      );
    });
  });

  describe('split', () => {
    it('horizontal split divides height in half and appends empty item', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'split',
        targetIndex: 0,
        direction: 'horizontal',
      });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 1 });
      const newItem = items[2]!;
      expect(newItem.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 1, w: 6, h: 1 });
      expect(newItem.type).toBe('markdown');
    });

    it('vertical split divides width in half', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'split',
        targetIndex: 0,
        direction: 'vertical',
      });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 3, h: 2 });
      expect(items[2]!.getPlacement()).toEqual({ mode: 'positioned', x: 3, y: 0, w: 3, h: 2 });
    });

    it('undo after horizontal split restores original item and removes new half', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'split', targetIndex: 0, direction: 'horizontal' });

      doc.undo();
      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
      expect(items[0]!.type).toBe('chart');
    });

    it('preserves original item component after split', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'split', targetIndex: 0, direction: 'horizontal' });

      const items = doc.getPages()[0]!.getItems();
      expect(items[0]!.type).toBe('chart');
    });
  });

  describe('merge', () => {
    it('merges two items into bounding rect, removes extras', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'merge', indices: [0, 1] });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(1);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 12, h: 2 });
      expect(items[0]!.type).toBe('chart');
    });

    it('undo after merge restores original items', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'merge', indices: [0, 1] });

      doc.undo();
      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
      expect(items[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 6, y: 0, w: 6, h: 1 });
    });

    it('merges non-adjacent items into bounding rect', () => {
      const doc = PageDocument.parse(GRID_3ITEMS_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'merge', indices: [0, 2] });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(2);
      const merged = items.find(i => i.type === 'chart');
      expect(merged!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 12, h: 4 });
    });
  });

  describe('swap', () => {
    it('exchanges placements between two items', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'swap', indexA: 0, indexB: 1 });

      const items = doc.getPages()[0]!.getItems();
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 6, y: 0, w: 6, h: 1 });
      expect(items[0]!.type).toBe('chart');
      expect(items[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
      expect(items[1]!.type).toBe('table');
    });

    it('undo after swap restores both items to original placements', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'swap', indexA: 0, indexB: 1 });

      doc.undo();
      const items = doc.getPages()[0]!.getItems();
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
      expect(items[0]!.type).toBe('chart');
      expect(items[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 6, y: 0, w: 6, h: 1 });
      expect(items[1]!.type).toBe('table');
    });
  });

  describe('remove', () => {
    it('undo after remove restores the deleted item', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'remove', index: 0 });

      doc.undo();
      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
      expect(items[0]!.type).toBe('chart');
    });

    it('removes item at index', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, { type: 'remove', index: 0 });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(1);
      expect(items[0]!.type).toBe('table');
    });
  });

  describe('add-empty', () => {
    it('appends empty container with no component', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'add-empty',
        placement: { mode: 'positioned', x: 0, y: 2, w: 6, h: 2 },
      });

      const items = doc.getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[2]!.type).toBeUndefined();
      expect(items[2]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 2, w: 6, h: 2 });
    });
  });

  describe('format conversion', () => {
    const COMPONENTS_YAML = `pages:
  - title: Test
    components:
      - type: chart
        properties:
          title: Revenue
      - type: table
        properties:
          title: Users
`;

    it('silently converts components: to grid: with full-width stacked placement', () => {
      const doc = PageDocument.parse(COMPONENTS_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 0, y: 0, w: 12, h: 1 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 0, y: 1, w: 12, h: 1 }, component: { type: 'table' } },
        ],
      });

      const page = PageDocument.parse(doc.toString()).getPages()[0]!;
      expect(page.getLayoutMode()).toBe('grid');
      const items = page.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.type).toBe('chart');
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 12, h: 1 });
      expect(items[1]!.type).toBe('table');
      expect(doc.toString()).not.toContain('components:');
      expect(doc.toString()).toContain('grid:');
      expect(doc.toString()).toContain('at:');
    });

  });

  describe('path-routed mutations', () => {
    const NESTED_GRID_YAML = `pages:
  - title: Test
    grid:
      - at: { x: 0, y: 0, w: 12, h: 4 }
        type: panel
        grid:
          - at: { x: 0, y: 0, w: 3, h: 2 }
            type: chart
          - at: { x: 3, y: 0, w: 3, h: 2 }
            type: table
`;

    it('routes move to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        items: [
          { at: { mode: 'positioned', x: 1, y: 1, w: 3, h: 2 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 3, y: 0, w: 3, h: 2 }, component: { type: 'table' } },
        ],
      });

      const rootItems = doc.getPages()[0]!.getItems();
      expect(rootItems[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 12, h: 4 });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      const nestedAt0 = nestedSeq?.get(0)?.get('at')?.toJSON();
      expect(nestedAt0).toEqual({ x: 1, y: 1, w: 3, h: 2 });
    });

    it('does not compact root grid when gridPath targets nested grid', () => {
      const GAPPED_ROOT_YAML = `pages:
  - title: Test
    items:
      - placement: { x: 0, y: 2, w: 12, h: 4 }
        type: panel
        grid:
          - at: { x: 0, y: 0, w: 3, h: 2 }
            type: chart
          - at: { x: 3, y: 0, w: 3, h: 2 }
            type: table
`;
      const doc = PageDocument.parse(GAPPED_ROOT_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        gridPath: ['pages', 0, 'items', 0, 'grid'],
        items: [
          { at: { mode: 'positioned', x: 1, y: 0, w: 3, h: 2 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 3, y: 0, w: 3, h: 2 }, component: { type: 'table' } },
        ],
      });

      const rootItems = doc.getPages()[0]!.getItems();
      expect(rootItems[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 2, w: 12, h: 4 });
    });

    it('routes insert to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'insert',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        placement: { mode: 'positioned', x: 6, y: 0, w: 3, h: 2 },
        componentType: 'summary',
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(3);
      const newEntry = nestedSeq.get(2)?.toJSON();
      expect(newEntry.at).toEqual({ x: 6, y: 0, w: 3, h: 2 });
      expect(newEntry.type).toBe('summary');
    });

    it('routes split to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'split',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        targetIndex: 0,
        direction: 'horizontal',
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(3);
      const originalAt = nestedSeq.get(0)?.get('at')?.toJSON();
      expect(originalAt).toEqual({ x: 0, y: 0, w: 3, h: 1 });
      const newAt = nestedSeq.get(2)?.get('at')?.toJSON();
      expect(newAt).toEqual({ x: 0, y: 1, w: 3, h: 1 });
    });

    it('routes merge to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'merge',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        indices: [0, 1],
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(1);
      const mergedAt = nestedSeq.get(0)?.get('at')?.toJSON();
      expect(mergedAt).toEqual({ x: 0, y: 0, w: 6, h: 2 });
    });

    it('routes swap to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'swap',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        indexA: 0,
        indexB: 1,
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.get(0)?.get('at')?.toJSON()).toEqual({ x: 3, y: 0, w: 3, h: 2 });
      expect(nestedSeq.get(1)?.get('at')?.toJSON()).toEqual({ x: 0, y: 0, w: 3, h: 2 });
    });

    it('routes remove to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'remove',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        index: 0,
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(1);
      expect(nestedSeq.get(0)?.get('type')).toBe('table');
    });

    it('routes add-empty to nested grid when gridPath is provided', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'add-empty',
        gridPath: ['pages', 0, 'grid', 0, 'grid'],
        placement: { mode: 'positioned', x: 0, y: 2, w: 6, h: 2 },
      });

      const reparsed = PageDocument.parse(doc.toString());
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(3);
      const newEntry = nestedSeq.get(2)?.toJSON();
      expect(newEntry.at).toEqual({ x: 0, y: 2, w: 6, h: 2 });
      expect(newEntry.type).toBeUndefined();
    });

    it('falls back to root when gridPath is absent', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 2, y: 1, w: 12, h: 4 }, component: { type: 'panel' } },
        ],
      });

      const rootItems = doc.getPages()[0]!.getItems();
      expect(rootItems[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 2, y: 0, w: 12, h: 4 });
    });
  });

  describe('cross-grid mutation', () => {
    const NESTED_GRID_YAML_2 = `pages:
  - title: Test
    grid:
      - at: { x: 0, y: 0, w: 12, h: 4 }
        type: panel
        grid:
          - at: { x: 0, y: 0, w: 3, h: 2 }
            type: chart
          - at: { x: 3, y: 0, w: 3, h: 2 }
            type: table
`;

    it('swaps cross-grid components while preserving properties and placements', () => {
      const doc = PageDocument.parse(`pages:
  - grid:
      - type: grid
        grid:
          - at: { x: 0, y: 0, w: 3, h: 2 }
            type: chart
            properties: { title: Source }
      - type: grid
        grid:
          - at: { x: 1, y: 1, w: 4, h: 2 }
            type: table
            properties: { title: Target }
`);
      new GridEditBridge().applyCrossGridEdit(doc, {
        type: 'cross-move',
        sourceGridPath: ['pages', 0, 'grid', 0, 'grid'],
        targetGridPath: ['pages', 0, 'grid', 1, 'grid'],
        sourceIndex: 0,
        swapTargetIndex: 0,
        targetPlacement: { mode: 'positioned', x: 1, y: 1, w: 3, h: 2 },
        component: { type: 'chart' },
      });
      const yaml = doc._getDoc().toJS() as { pages: { grid: { grid: Record<string, unknown>[] }[] }[] };
      const [source, target] = yaml.pages[0]!.grid;
      expect(source!.grid[0]).toEqual({
        at: { x: 0, y: 0, w: 3, h: 2 }, type: 'table', properties: { title: 'Target' },
      });
      expect(target!.grid[0]).toEqual({
        at: { x: 1, y: 1, w: 3, h: 2 }, type: 'chart', properties: { title: 'Source' },
      });
    });

    it('removes item from source and inserts into target atomically', () => {
      const doc = PageDocument.parse(NESTED_GRID_YAML_2);
      const bridge = new GridEditBridge();

      bridge.applyCrossGridEdit(doc, {
        type: 'cross-move',
        sourceGridPath: ['pages', 0, 'grid', 0, 'grid'],
        targetGridPath: ['pages', 0, 'grid'],
        sourceIndex: 0,
        targetPlacement: { mode: 'positioned', x: 0, y: 4, w: 6, h: 2 },
        component: { type: 'chart' },
      });

      const yaml = doc.toString();
      const reparsed = PageDocument.parse(yaml);
      const nestedSeq = reparsed._getDoc().getIn(['pages', 0, 'grid', 0, 'grid']) as any;
      expect(nestedSeq.items.length).toBe(1);

      const rootSeq = reparsed._getDoc().getIn(['pages', 0, 'grid']) as any;
      expect(rootSeq.items.length).toBe(2);
    });
  });

  describe('fixedWidth preservation', () => {
    it('preserves fixedWidth through move via setPlacement', () => {
      const yaml = `pages:
  - title: Test
    grid:
      - at: { x: 0, y: 0, w: 4, h: 1, fixedWidth: 160 }
        type: html
      - at: { x: 4, y: 0, w: 8, h: 1 }
        type: chart
`;
      const doc = PageDocument.parse(yaml);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 2, y: 1, w: 4, h: 1, fixedWidth: 160 }, component: { type: 'html' } },
          { at: { mode: 'positioned', x: 4, y: 0, w: 8, h: 1 }, component: { type: 'chart' } },
        ],
      });

      const p = doc.getPages()[0]!.getItems()[0]!.getPlacement();
      expect(p).toEqual({ mode: 'positioned', x: 2, y: 1, w: 4, h: 1, fixedWidth: 160 });
    });

    it('preserves fixedWidth through nested grid move', () => {
      const yaml = `pages:
  - title: Test
    grid:
      - at: { x: 0, y: 0, w: 12, h: 2 }
        type: grid
        grid:
          - at: { x: 0, y: 0, w: 3, h: 1, fixedWidth: 100 }
            type: html
`;
      const doc = PageDocument.parse(yaml);
      const bridge = new GridEditBridge();
      const gridPath: (string | number)[] = ['pages', 0, 'grid', 0, 'grid'];

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 2, y: 0, w: 3, h: 1, fixedWidth: 100 }, component: { type: 'html' } },
        ],
        gridPath,
      });

      const result = doc.toString();
      expect(result).toContain('fixedWidth: 100');
    });
  });
});
