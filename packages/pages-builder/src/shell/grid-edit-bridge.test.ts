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
});
