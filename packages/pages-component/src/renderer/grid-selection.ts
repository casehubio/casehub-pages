import type { Rect, IdRect } from "./grid-compaction.js";
import { overlaps } from "./grid-compaction.js";

export interface GridSelection {
  readonly items: readonly string[];
  readonly bounds: Rect | null;
}

export function clearSelection(): GridSelection {
  return { items: [], bounds: null };
}

export function computeBounds(ids: readonly string[], allItems: readonly IdRect[]): Rect | null {
  const selected = allItems.filter(i => ids.includes(i.id));
  if (selected.length === 0) return null;
  const minX = Math.min(...selected.map(i => i.x));
  const minY = Math.min(...selected.map(i => i.y));
  const maxX = Math.max(...selected.map(i => i.x + i.w));
  const maxY = Math.max(...selected.map(i => i.y + i.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function selectItem(
  _prev: GridSelection,
  id: string,
  allItems: readonly IdRect[],
): GridSelection {
  return { items: [id], bounds: computeBounds([id], allItems) };
}

export function extendSelection(
  prev: GridSelection,
  id: string,
  allItems: readonly IdRect[],
): GridSelection {
  const anchorId = prev.items[0];
  if (!anchorId) return selectItem(prev, id, allItems);
  const anchor = allItems.find(i => i.id === anchorId);
  const target = allItems.find(i => i.id === id);
  if (!anchor || !target) return selectItem(prev, id, allItems);

  const bounds: Rect = {
    x: Math.min(anchor.x, target.x),
    y: Math.min(anchor.y, target.y),
    w: Math.max(anchor.x + anchor.w, target.x + target.w) - Math.min(anchor.x, target.x),
    h: Math.max(anchor.y + anchor.h, target.y + target.h) - Math.min(anchor.y, target.y),
  };

  const selectedIds = allItems
    .filter(item => overlaps(item, bounds))
    .map(item => item.id);

  return { items: selectedIds, bounds };
}
