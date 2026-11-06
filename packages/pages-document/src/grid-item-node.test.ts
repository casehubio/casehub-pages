import { describe, it, expect } from 'vitest';
import { PageDocument } from './page-document.js';

const GRID_PAGE_YAML = `
pages:
  - title: Test Page
    items:
      - placement: { x: 0, y: 0, w: 6, h: 2 }
        component:
          type: chart
          properties:
            title: Revenue
      - placement: { x: 6, y: 0, w: 6, h: 1 }
        component:
          type: table
          properties:
            title: Users
`;

describe('GridItemNode', () => {
  function parse(yaml: string) {
    return PageDocument.parse(yaml);
  }

  describe('getPlacement', () => {
    it('reads positioned placement from YAML', () => {
      const doc = parse(GRID_PAGE_YAML);
      const page = doc.getPages()[0]!;
      const items = page.getItems();
      expect(items).toHaveLength(2);
      const p = items[0]!.getPlacement();
      expect(p).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
    });
  });

  describe('getComponent', () => {
    it('returns ComponentNode at component sub-path', () => {
      const doc = parse(GRID_PAGE_YAML);
      const items = doc.getPages()[0]!.getItems();
      const comp = items[0]!.getComponent();
      expect(comp.type).toBe('chart');
      expect(comp.getProperties()).toEqual({ title: 'Revenue' });
    });
  });

  describe('delegated accessors', () => {
    it('type delegates to component', () => {
      const doc = parse(GRID_PAGE_YAML);
      const item = doc.getPages()[0]!.getItems()[0]!;
      expect(item.type).toBe('chart');
    });

    it('getProperties delegates to component', () => {
      const doc = parse(GRID_PAGE_YAML);
      const item = doc.getPages()[0]!.getItems()[1]!;
      expect(item.getProperties()).toEqual({ title: 'Users' });
    });
  });

  describe('setPlacement', () => {
    it('updates individual placement properties preserving YAML formatting', () => {
      const yaml = `pages:
  - title: Test
    items:
      - placement: { x: 0, y: 0, w: 6, h: 2 }  # chart placement
        component:
          type: chart
`;
      const doc = parse(yaml);
      const item = doc.getPages()[0]!.getItems()[0]!;
      item.setPlacement({ mode: 'positioned', x: 3, y: 1, w: 4, h: 3 });
      const result = doc.toString();
      expect(result).toContain('# chart placement');
      const updated = parse(result).getPages()[0]!.getItems()[0]!.getPlacement();
      expect(updated).toEqual({ mode: 'positioned', x: 3, y: 1, w: 4, h: 3 });
    });

    it('does not write mode key to YAML', () => {
      const doc = parse(GRID_PAGE_YAML);
      const item = doc.getPages()[0]!.getItems()[0]!;
      item.setPlacement({ mode: 'positioned', x: 1, y: 1, w: 3, h: 3 });
      expect(doc.toString()).not.toContain('mode:');
    });
  });

  describe('moveToIndex', () => {
    it('moves full item entry preserving placement', () => {
      const doc = parse(GRID_PAGE_YAML);
      const page = doc.getPages()[0]!;
      const items = page.getItems();
      items[0]!.moveToIndex(1);
      const moved = parse(doc.toString()).getPages()[0]!.getItems();
      expect(moved[0]!.type).toBe('table');
      expect(moved[1]!.type).toBe('chart');
      expect(moved[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
    });
  });

  describe('duplicate', () => {
    it('copies full item entry with placement and component', () => {
      const doc = parse(GRID_PAGE_YAML);
      const page = doc.getPages()[0]!;
      page.getItems()[0]!.duplicate();
      const items = parse(doc.toString()).getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[1]!.type).toBe('chart');
      expect(items[1]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
    });
  });

  describe('PageNode', () => {
    it('getLayoutMode returns items for items: pages', () => {
      const doc = parse(GRID_PAGE_YAML);
      expect(doc.getPages()[0]!.getLayoutMode()).toBe('items');
    });

    it('addItem throws if not in items mode', () => {
      const doc = parse(`pages:\n  - title: Test\n    components:\n      - type: chart\n`);
      expect(() => doc.getPages()[0]!.addItem(
        { mode: 'auto', w: 1, h: 1 }, 'table'
      )).toThrow('addItem() requires items: layout mode');
    });

    it('addItem appends item with placement', () => {
      const doc = parse(GRID_PAGE_YAML);
      const page = doc.getPages()[0]!;
      page.addItem({ mode: 'positioned', x: 0, y: 2, w: 12, h: 1 }, 'summary', { title: 'Total' });
      const items = parse(doc.toString()).getPages()[0]!.getItems();
      expect(items).toHaveLength(3);
      expect(items[2]!.type).toBe('summary');
      expect(items[2]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 2, w: 12, h: 1 });
    });

    it('removeItem removes item at index', () => {
      const doc = parse(GRID_PAGE_YAML);
      doc.getPages()[0]!.removeItem(0);
      const items = parse(doc.toString()).getPages()[0]!.getItems();
      expect(items).toHaveLength(1);
      expect(items[0]!.type).toBe('table');
    });
  });
});
