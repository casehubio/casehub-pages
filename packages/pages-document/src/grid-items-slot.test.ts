import { describe, it, expect } from 'vitest';
import { PageDocument } from './page-document.js';

const NESTED_GRID_YAML = `
pages:
  - title: Test
    rows:
      - columns:
          - span: 12
            components:
              - type: grid
                items:
                  - placement: { x: 0, y: 0, w: 6, h: 1 }
                    component:
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
    const items = children.slots['items'];
    expect(items).toBeDefined();
    expect(items).toHaveLength(1);
    expect(items![0]!.getPlacement()).toEqual({ mode: 'positioned', x: 0, y: 0, w: 6, h: 1 });
    expect(items![0]!.getComponent().type).toBe('chart');
  });
});
