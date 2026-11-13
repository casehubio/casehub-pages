import { PageDocument, type PageNode, type ComponentNode, GridItemNode } from '@casehubio/pages-document';
import type { TreeNodeType } from '../tree/builder-tree.js';

function resolveGridItem(
  page: PageNode,
  path: readonly (string | number)[],
): ComponentNode | null {
  if (path.length < 4) return null;
  const rootItems = page.getItems();
  let item: GridItemNode | undefined = rootItems[path[3] as number];
  if (!item) return null;

  let i = 4;
  while (i < path.length && item) {
    if (path[i] === 'grid' || path[i] === 'items') {
      const comp: ComponentNode | undefined = item.getComponent();
      if (!comp || !comp.isContainer()) return comp ?? null;
      const nextIdx = path[i + 1] as number | undefined;
      if (nextIdx === undefined) return comp;
      const children: ReturnType<ComponentNode['getChildren']> = comp.getChildren();
      const key = path[i] as string;
      const nested: (ComponentNode | GridItemNode)[] | undefined = children.slots[key];
      if (!nested) return comp;
      const child: ComponentNode | GridItemNode | undefined = nested[nextIdx];
      item = child instanceof GridItemNode ? child : undefined;
      i += 2;
    } else {
      break;
    }
  }
  return item?.getComponent() ?? null;
}

export function collectComponentsInScope(
  doc: PageDocument,
  path: readonly (string | number)[],
  nodeType: TreeNodeType,
): ComponentNode[] {
  const results: ComponentNode[] = [];

  const collectFromPage = (page: PageNode) => {
    const mode = page.getLayoutMode();
    if (mode === 'grid' || mode === 'items') {
      for (const item of page.getItems()) {
        const comp: ComponentNode | undefined = item.getComponent();
        if (comp) results.push(comp);
      }
    } else if (mode === 'rows') {
      for (const row of page.getRows()) for (const col of row.getColumns()) results.push(...col.getComponents());
    } else if (mode === 'columns') {
      for (const col of page.getColumns()) results.push(...col.getComponents());
    } else {
      results.push(...page.getComponents());
    }
  };

  if (nodeType === 'section') {
    if (path[0] === 'pages') {
      for (const page of doc.getPages()) collectFromPage(page);
    }
    return results;
  }

  if (nodeType === 'page') {
    const pageIdx = path[1] as number;
    const page = doc.getPages()[pageIdx];
    if (page) collectFromPage(page);
  } else if (nodeType === 'row') {
    const page = doc.getPages()[path[1] as number];
    if (page && path[2] === 'rows') {
      const row = page.getRows()[path[3] as number];
      if (row) for (const col of row.getColumns()) results.push(...col.getComponents());
    }
  } else if (nodeType === 'column') {
    const page = doc.getPages()[path[1] as number];
    if (page) {
      if (path[2] === 'rows' && path.length >= 6) {
        const row = page.getRows()[path[3] as number];
        if (row) {
          const col = row.getColumns()[path[5] as number];
          if (col) results.push(...col.getComponents());
        }
      } else if (path[2] === 'columns' && path.length >= 4) {
        const col = page.getColumns()[path[3] as number];
        if (col) results.push(...col.getComponents());
      }
    }
  } else if (nodeType === 'grid-item' || nodeType === 'component') {
    const page = doc.getPages()[path[1] as number];
    if (!page) return results;
    if ((path[2] === 'grid' || path[2] === 'items') && path.length >= 4) {
      const c = resolveGridItem(page, path);
      if (c) results.push(c);
    } else if (nodeType === 'component' && path[2] === 'components' && path.length >= 4) {
      const c = page.getComponents()[path[3] as number];
      if (c) results.push(c);
    } else if (path[2] === 'rows' && path.length >= 8) {
      const row = page.getRows()[path[3] as number];
      if (row) {
        const col = row.getColumns()[path[5] as number];
        if (col) {
          const c = col.getComponents()[path[7] as number];
          if (c) results.push(c);
        }
      }
    } else if (path[2] === 'columns' && path.length >= 6) {
      const col = page.getColumns()[path[3] as number];
      if (col) {
        const c = col.getComponents()[path[5] as number];
        if (c) results.push(c);
      }
    }
  } else if (nodeType === 'dataset') {
    if (path[0] !== 'datasets' || path.length < 2) return results;
    const ds = doc.getDatasets()[path[1] as number];
    if (!ds) return results;
    for (const page of doc.getPages()) {
      const check = (c: ComponentNode) => {
        const props = c.getProperties();
        const lookup = props['lookup'];
        if (lookup && typeof lookup === 'object') {
          const serializer = lookup as { toJSON?: () => unknown };
          const plain: unknown = typeof serializer.toJSON === 'function' ? serializer.toJSON() : lookup;
          if (typeof plain === 'object' && plain !== null && 'uuid' in plain && plain.uuid === ds.uuid) results.push(c);
        }
      };
      const mode = page.getLayoutMode();
      if (mode === 'grid' || mode === 'items') {
        for (const item of page.getItems()) { const c = item.getComponent(); if (c) check(c); }
      } else if (mode === 'rows') {
        for (const row of page.getRows()) for (const col of row.getColumns()) col.getComponents().forEach(check);
      } else if (mode === 'columns') {
        for (const col of page.getColumns()) col.getComponents().forEach(check);
      } else {
        page.getComponents().forEach(check);
      }
    }
  }

  return results;
}
