import type { IdRect } from "./grid-compaction.js";

export type ResizeEdge = "top" | "bottom" | "left" | "right";

export function resizeItem(
  items: readonly IdRect[],
  id: string,
  edge: ResizeEdge,
  delta: number,
  columns: number,
): IdRect[] {
  return items.map(item => {
    if (item.id !== id) return { ...item };
    switch (edge) {
      case "right": {
        const newW = Math.max(1, Math.min(item.w + delta, columns - item.x));
        return { ...item, w: newW };
      }
      case "left": {
        const shrink = Math.min(delta, item.w - 1);
        const actualDelta = Math.max(shrink, -item.x);
        return { ...item, x: item.x + actualDelta, w: item.w - actualDelta };
      }
      case "bottom": {
        const newH = Math.max(1, item.h + delta);
        return { ...item, h: newH };
      }
      case "top": {
        const shrink = Math.min(delta, item.h - 1);
        const actualDelta = Math.max(shrink, -item.y);
        return { ...item, y: item.y + actualDelta, h: item.h - actualDelta };
      }
    }
  });
}
