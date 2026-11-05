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
    expect(pageNode.children[0]!.label).toContain('Revenue');
    expect(pageNode.children[0]!.annotation).toBe('[0,0 6×2]');
    expect(pageNode.children[0]!.nodeType).toBe('component');
    expect(pageNode.children[1]!.label).toContain('table');
    expect(pageNode.children[1]!.annotation).toBe('[6,0 6×1]');
  });
});
