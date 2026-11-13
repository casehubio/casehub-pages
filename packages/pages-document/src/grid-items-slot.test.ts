import { describe, it, expect } from 'vitest';
import { PageDocument, GridItemNode } from './page-document.js';

const NESTED_GRID_YAML = `
pages:
  - title: Test
    rows:
      - columns:
          - span: 12
            components:
              - type: grid
                grid:
                  - at: { x: 0, y: 0, w: 6, h: 1 }
                    type: chart
                    properties:
                      title: Nested Chart
`;

describe('grid-items slot kind', () => {
  it('getChildren returns GridItemNode[] for grid container', () => {
    const doc = PageDocument.parse(NESTED_GRID_YAML);
    const page = doc.getPages()[0]!;
    const rows = page.getRows();
    const gridComp = rows[0]!.getColumns()[0]!.getComponents()[0]!;
    expect(gridComp.type).toBe('grid');
    expect(gridComp.isContainer()).toBe(true);
    const children = gridComp.getChildren();
    expect(children.descriptor.type).toBe('grid');
    const items = children.slots['grid'];
    expect(items).toBeDefined();
    expect(items).toHaveLength(1);
    const item = items![0]!;
    expect(item).toBeInstanceOf(GridItemNode);
    if (!(item instanceof GridItemNode)) throw new Error('Expected a grid item');
    expect(item.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 1 });
    expect(item.getComponent()!.type).toBe('chart');
  });
  it('adds an auto-placed component to a grid slot', () => {
    const doc = PageDocument.parse(NESTED_GRID_YAML);
    const grid = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!.getComponents()[0]!;
    const child = grid.addChild('grid', 'title', { text: 'Added' });
    expect(child.type).toBe('title');
    const items = grid.getChildren().slots['grid']!;
    expect(items).toHaveLength(2);
    const added = items[1]!;
    expect(added).toBeInstanceOf(GridItemNode);
    if (!(added instanceof GridItemNode)) throw new Error('Expected a grid item');
    expect(added.getPlacement()).toEqual({ mode: 'auto', w: 1, h: 1 });
    expect(added.getComponent()!.getProperties()).toEqual({ text: 'Added' });
  });

  it('wraps a component in a grid without losing its properties', () => {
    const doc = PageDocument.parse(NESTED_GRID_YAML);
    const original = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!.getComponents()[0]!;
    const wrapped = original.wrapIn('grid');
    const item = wrapped.getChildren().slots['grid']![0]!;
    expect(item).toBeInstanceOf(GridItemNode);
    if (!(item instanceof GridItemNode)) throw new Error('Expected a grid item');
    expect(item.getComponent()!.type).toBe('grid');
    expect(item.getPlacement()).toEqual({ mode: 'auto', w: 1, h: 1 });
    expect(doc.toString()).toContain('Nested Chart');
  });

});
