import { describe, it, expect } from 'vitest';
import { PageDocument } from '@casehubio/pages-document';
import { buildTreeModel, formatPlacement } from './builder-tree.js';

const GRID_YAML = `pages:
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

describe('formatPlacement', () => {
  it('formats positioned placement', () => {
    expect(formatPlacement({ mode: 'positioned', x: 0, y: 0, w: 12, h: 1 }))
      .toBe('[0,0 12×1]');
  });

  it('formats auto placement', () => {
    expect(formatPlacement({ mode: 'auto', w: 1, h: 1 }))
      .toBe('[auto 1×1]');
  });
});

describe('buildTreeModel for items layout', () => {
  it('produces tree nodes with placement annotations', () => {
    const doc = PageDocument.parse(GRID_YAML);
    const model = buildTreeModel(doc);
    const pagesSection = model.find(n => n.label === 'Pages')!;
    expect(pagesSection).toBeDefined();
    const pageNode = pagesSection.children[0]!;
    expect(pageNode.nodeType).toBe('page');
    expect(pageNode.children).toHaveLength(2);
    const item0 = pageNode.children[0]!;
    expect(item0.label).toContain('Revenue');
    expect(item0.annotation).toBe('[0,0 6×2]');
    expect(item0.nodeType).toBe('grid-item');
    expect(item0.children).toHaveLength(0);
    expect(item0.label).toContain('Revenue');
    const item1 = pageNode.children[1]!;
    expect(item1.label).toContain('table');
    expect(item1.annotation).toBe('[6,0 6×1]');
    expect(item1.children).toHaveLength(0);
  });

  it('sorts grid items by placement y then x', () => {
    const yaml = `pages:
  - title: Test
    items:
      - placement: { x: 6, y: 2, w: 6, h: 1 }
        component: { type: html }
      - placement: { x: 0, y: 0, w: 6, h: 1 }
        component: { type: title }
      - placement: { x: 0, y: 2, w: 6, h: 1 }
        component: { type: metric }
`;
    const doc = PageDocument.parse(yaml);
    const model = buildTreeModel(doc);
    const page = model.find(n => n.label === 'Pages')!.children[0]!;
    expect(page.children[0]!.annotation).toBe('[0,0 6×1]');
    expect(page.children[1]!.annotation).toBe('[0,2 6×1]');
    expect(page.children[2]!.annotation).toBe('[6,2 6×1]');
  });
});
