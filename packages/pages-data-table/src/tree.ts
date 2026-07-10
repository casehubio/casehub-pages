export interface TreeRow<R = unknown> {
  readonly row: R;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}

export function flattenTree<R>(
  rows: readonly R[],
  getChildren: (row: R) => readonly R[],
  expandedIds: ReadonlySet<string>,
  getRowId: (row: R) => string,
  depth = 0,
): TreeRow<R>[] {
  const result: TreeRow<R>[] = [];

  for (const row of rows) {
    const id = getRowId(row);
    const children = getChildren(row);
    const hasChildren = children.length > 0;
    const expanded = hasChildren && expandedIds.has(id);

    result.push({ row, depth, hasChildren, expanded });

    if (expanded) {
      result.push(...flattenTree(children, getChildren, expandedIds, getRowId, depth + 1));
    }
  }

  return result;
}
