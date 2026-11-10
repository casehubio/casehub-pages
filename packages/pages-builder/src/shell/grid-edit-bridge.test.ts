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
        { mode: 'positioned', x: 1, y: 1, w: 5, h: 1 }
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
      expect(newItem.type).toBeUndefined();
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
  });

  describe('remove', () => {
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

    const ROWS_YAML = `pages:
  - title: Test
    rows:
      - columns:
          - span: 6
            components:
              - type: chart
                properties:
                  title: Revenue
          - span: 6
            components:
              - type: table
                properties:
                  title: Users
      - columns:
          - span: 12
            components:
              - type: summary
                properties:
                  title: Total
`;

    it('converts rows: to grid: with inferred placements', () => {
      const doc = PageDocument.parse(ROWS_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { at: { mode: 'positioned', x: 0, y: 0, w: 6, h: 1 }, component: { type: 'chart' } },
          { at: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
          { at: { mode: 'positioned', x: 0, y: 1, w: 12, h: 1 }, component: { type: 'summary' } },
        ],
      });

      const page = PageDocument.parse(doc.toString()).getPages()[0]!;
      expect(page.getLayoutMode()).toBe('grid');
      expect(page.getItems()).toHaveLength(3);
      expect(doc.toString()).not.toContain('rows:');
      expect(doc.toString()).toContain('grid:');
    });
  });
});
