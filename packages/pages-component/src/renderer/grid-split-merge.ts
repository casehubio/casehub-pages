import type { IdRect } from "./grid-compaction.js";

export type SplitDirection = "horizontal" | "vertical";

export function canSplit(item: IdRect, direction: SplitDirection): boolean {
  return direction === "horizontal" ? item.h >= 2 : item.w >= 2;
}

export function validSplitDirections(item: IdRect): SplitDirection[] {
  const dirs: SplitDirection[] = [];
  if (item.h >= 2) dirs.push("horizontal");
  if (item.w >= 2) dirs.push("vertical");
  return dirs;
}

export function splitItem(
  items: readonly IdRect[],
  id: string,
  direction: SplitDirection,
  nextId: string,
): IdRect[] {
  const result: IdRect[] = [];
  for (const item of items) {
    if (item.id !== id) {
      result.push({ ...item });
      continue;
    }
    if (direction === "horizontal") {
      const topH = Math.floor(item.h / 2);
      const bottomH = item.h - topH;
      result.push({ ...item, h: topH });
      result.push({ id: nextId, x: item.x, y: item.y + topH, w: item.w, h: bottomH });
    } else {
      const leftW = Math.floor(item.w / 2);
      const rightW = item.w - leftW;
      result.push({ ...item, w: leftW });
      result.push({ id: nextId, x: item.x + leftW, y: item.y, w: rightW, h: item.h });
    }
  }
  return result;
}

export function mergeItems(
  items: readonly IdRect[],
  ids: readonly string[],
  mergedId: string,
): IdRect[] {
  const idSet = new Set(ids);
  const toMerge = items.filter(i => idSet.has(i.id));
  if (toMerge.length === 0) return [...items];

  const minX = Math.min(...toMerge.map(i => i.x));
  const minY = Math.min(...toMerge.map(i => i.y));
  const maxX = Math.max(...toMerge.map(i => i.x + i.w));
  const maxY = Math.max(...toMerge.map(i => i.y + i.h));

  const merged: IdRect = { id: mergedId, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  const result: IdRect[] = items.filter(i => !idSet.has(i.id)).map(i => ({ ...i }));
  result.unshift(merged);
  return result;
}
