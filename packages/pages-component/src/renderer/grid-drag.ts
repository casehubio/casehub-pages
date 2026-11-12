export interface CellCoord {
  readonly x: number;
  readonly y: number;
}

export interface GridGeometry {
  readonly columns: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly gap: number;
  readonly gridLeft: number;
  readonly gridTop: number;
}

export const DRAG_THRESHOLD = 5;

export type ResizeHandle =
  | "top" | "bottom" | "left" | "right"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function computeGridGeometry(
  gridRect: DOMRect,
  columns: number,
  rowHeight: number,
  gap: number,
): GridGeometry {
  const cellWidth = (gridRect.width - gap * (columns - 1)) / columns;
  return {
    columns,
    cellWidth,
    cellHeight: rowHeight,
    gap,
    gridLeft: gridRect.x,
    gridTop: gridRect.y,
  };
}

export function snapToCell(
  pointerX: number,
  pointerY: number,
  geometry: GridGeometry,
): CellCoord {
  const relX = pointerX - geometry.gridLeft;
  const relY = pointerY - geometry.gridTop;
  const xStep = geometry.cellWidth + geometry.gap;
  const yStep = geometry.cellHeight + geometry.gap;
  return {
    x: Math.max(0, Math.floor(relX / xStep)),
    y: Math.max(0, Math.floor(relY / yStep)),
  };
}

export function clampPlacement(
  x: number,
  y: number,
  w: number,
  _h: number,
  columns: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, columns - w)),
    y: Math.max(0, y),
  };
}

export function cellToPixel(
  cellX: number,
  cellY: number,
  geometry: GridGeometry,
): { px: number; py: number } {
  return {
    px: cellX * (geometry.cellWidth + geometry.gap),
    py: cellY * (geometry.cellHeight + geometry.gap),
  };
}

export function cellRectToPixel(
  x: number,
  y: number,
  w: number,
  h: number,
  geometry: GridGeometry,
): { left: number; top: number; width: number; height: number } {
  const { px, py } = cellToPixel(x, y, geometry);
  return {
    left: px,
    top: py,
    width: w * geometry.cellWidth + (w - 1) * geometry.gap,
    height: h * geometry.cellHeight + (h - 1) * geometry.gap,
  };
}

export type RowBounds = readonly [number, { readonly top: number; readonly bottom: number }];

export function captureRowPositions(gridEl: HTMLElement): RowBounds[] | null {
  const computed = getComputedStyle(gridEl);
  const templateRows = computed.gridTemplateRows;
  if (!templateRows || templateRows === "none") return null;

  const rowHeights = templateRows.split(/\s+/).map(s => parseFloat(s));
  if (rowHeights.length === 0 || rowHeights.some(h => isNaN(h))) return null;

  const gap = parseFloat(computed.rowGap) || 0;
  const rect = gridEl.getBoundingClientRect();
  const paddingTop = parseFloat(computed.paddingTop) || 0;

  let top = rect.top + paddingTop;
  const result: RowBounds[] = [];
  for (let i = 0; i < rowHeights.length; i++) {
    const height = rowHeights[i]!;
    result.push([i, { top, bottom: top + height }]);
    top += height + gap;
  }

  return result;
}

export function snapToCellWithRows(
  pointerX: number,
  pointerY: number,
  geometry: GridGeometry,
  frozenRows: RowBounds[] | null,
): CellCoord {
  const relX = pointerX - geometry.gridLeft;
  const xStep = geometry.cellWidth + geometry.gap;
  const x = Math.max(0, Math.floor(relX / xStep));

  if (!frozenRows || frozenRows.length === 0) {
    return snapToCell(pointerX, pointerY, geometry);
  }

  let y = 0;
  for (const [row, bounds] of frozenRows) {
    if (pointerY >= bounds.top) y = row;
    else break;
  }
  const lastRow = frozenRows[frozenRows.length - 1];
  if (lastRow && pointerY > lastRow[1].bottom) {
    y = lastRow[0] + 1;
  }

  return { x: Math.max(0, x), y: Math.max(0, y) };
}

export function hitTestHandle(
  pointerX: number,
  pointerY: number,
  itemRect: DOMRect,
  pointerType: string,
): ResizeHandle | "move" | null {
  const inset = pointerType === "touch" || pointerType === "pen" ? 20 : 8;

  if (pointerX < itemRect.left || pointerX > itemRect.right ||
      pointerY < itemRect.top || pointerY > itemRect.bottom) {
    return null;
  }

  const nearLeft = pointerX - itemRect.left < inset;
  const nearRight = itemRect.right - pointerX < inset;
  const nearTop = pointerY - itemRect.top < inset;
  const nearBottom = itemRect.bottom - pointerY < inset;

  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";
  if (nearTop) return "top";
  if (nearBottom) return "bottom";
  if (nearLeft) return "left";
  if (nearRight) return "right";

  return "move";
}
