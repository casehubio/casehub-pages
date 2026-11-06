import { describe, it, expect } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { GridEditBridge } from './grid-edit-bridge.js';

describe('grid edit integration', () => {
  const YAML = `pages:
  - title: Test
    items:
      - placement: { x: 0, y: 0, w: 6, h: 2 }
        component:
          type: chart
          properties:
            title: Revenue
      - placement: { x: 6, y: 0, w: 6, h: 1 }
        component:
          type: table
`;

  it('end-to-end: move → YAML update → re-parse preserves state', () => {
    const doc = PageDocument.parse(YAML);
    const bridge = new GridEditBridge();

    bridge.applyGridEdit(doc, {
      type: 'move',
      items: [
        { placement: { mode: 'positioned', x: 0, y: 1, w: 6, h: 2 }, component: { type: 'chart' } },
        { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
      ],
    });

    const reparsed = PageDocument.parse(doc.toString());
    const items = reparsed.getPages()[0]!.getItems();
    expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 1, w: 6, h: 2 });
    expect(items[0]!.type).toBe('chart');
    expect(items[0]!.getProperties()).toEqual({ title: 'Revenue' });
  });

  it('undo restores previous placement', () => {
    const doc = PageDocument.parse(YAML);
    const bridge = new GridEditBridge();

    bridge.applyGridEdit(doc, {
      type: 'move',
      items: [
        { placement: { mode: 'positioned', x: 3, y: 0, w: 6, h: 2 }, component: { type: 'chart' } },
        { placement: { mode: 'positioned', x: 6, y: 0, w: 6, h: 1 }, component: { type: 'table' } },
      ],
    });

    doc.undo();
    const items = doc.getPages()[0]!.getItems();
    expect(items[0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 2 });
  });

  it('insert adds item and round-trips through YAML', () => {
    const doc = PageDocument.parse(YAML);
    const bridge = new GridEditBridge();

    bridge.applyGridEdit(doc, {
      type: 'insert',
      placement: { mode: 'positioned', x: 0, y: 2, w: 12, h: 1 },
      componentType: 'summary',
    });

    const reparsed = PageDocument.parse(doc.toString());
    expect(reparsed.getPages()[0]!.getItems()).toHaveLength(3);
    expect(reparsed.getPages()[0]!.getItems()[2]!.type).toBe('summary');
  });

  it('delete via removeItem removes full grid item entry', () => {
    const doc = PageDocument.parse(YAML);
    doc.getPages()[0]!.removeItem(0);
    const items = PageDocument.parse(doc.toString()).getPages()[0]!.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe('table');
  });

  it('format conversion + move round-trips correctly', () => {
    const compYaml = `pages:
  - title: Test
    components:
      - type: chart
      - type: table
`;
    const doc = PageDocument.parse(compYaml);
    const bridge = new GridEditBridge();

    bridge.applyGridEdit(doc, {
      type: 'move',
      items: [
        { placement: { mode: 'positioned', x: 0, y: 0, w: 12, h: 1 }, component: { type: 'chart' } },
        { placement: { mode: 'positioned', x: 0, y: 1, w: 6, h: 1 }, component: { type: 'table' } },
      ],
    });

    const reparsed = PageDocument.parse(doc.toString());
    expect(reparsed.getPages()[0]!.getLayoutMode()).toBe('items');
    expect(reparsed.getPages()[0]!.getItems()[1]!.getPlacement().w).toBe(6);
  });
});
