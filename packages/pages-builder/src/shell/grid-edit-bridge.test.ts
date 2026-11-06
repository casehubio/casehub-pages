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

describe('GridEditBridge', () => {
  describe('move', () => {
    it('updates placements for moved items only', () => {
      const doc = PageDocument.parse(GRID_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { placement: { mode: 'positioned', x: 3, y: 1, w: 6, h: 2 }, component: { type: 'chart' } },
          { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
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
          { placement: { mode: 'positioned', x: 0, y: 0, w: 6, h: 2 }, component: { type: 'chart' } },
          { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
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
          { placement: { mode: 'positioned', x: 1, y: 1, w: 5, h: 1 }, component: { type: 'chart' } },
          { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
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

    it('silently converts components: to items: with full-width stacked placement', () => {
      const doc = PageDocument.parse(COMPONENTS_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { placement: { mode: 'positioned', x: 0, y: 0, w: 12, h: 1 }, component: { type: 'chart' } },
          { placement: { mode: 'positioned', x: 0, y: 1, w: 12, h: 1 }, component: { type: 'table' } },
        ],
      });

      const page = PageDocument.parse(doc.toString()).getPages()[0]!;
      expect(page.getLayoutMode()).toBe('items');
      const items = page.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.type).toBe('chart');
      expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 12, h: 1 });
      expect(items[1]!.type).toBe('table');
      expect(doc.toString()).not.toContain('components:');
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

    it('converts rows: to items: with inferred placements', () => {
      const doc = PageDocument.parse(ROWS_YAML);
      const bridge = new GridEditBridge();

      bridge.applyGridEdit(doc, {
        type: 'move',
        items: [
          { placement: { mode: 'positioned', x: 0, y: 0, w: 6, h: 1 }, component: { type: 'chart' } },
          { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
          { placement: { mode: 'positioned', x: 0, y: 1, w: 12, h: 1 }, component: { type: 'summary' } },
        ],
      });

      const page = PageDocument.parse(doc.toString()).getPages()[0]!;
      expect(page.getLayoutMode()).toBe('items');
      expect(page.getItems()).toHaveLength(3);
      expect(doc.toString()).not.toContain('rows:');
    });
  });
});
