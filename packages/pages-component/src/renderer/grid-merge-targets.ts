import type { IdRect } from "./grid-compaction.js";

export type MergeDirection = "left" | "right" | "up" | "down";

export function computeMergeDirection(dx: number, dy: number): MergeDirection | null {
  if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return null;
  return Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");
}

export function computeMergeTargets(
  items: readonly IdRect[],
  rootId: string,
  direction: MergeDirection,
  distance: number,
): string[] {
  const root = items.find(i => i.id === rootId);
  if (!root || distance <= 0) return [];

  const targets: string[] = [];
  let edge: number;

  switch (direction) {
    case "right": {
      edge = root.x + root.w;
      for (let d = 0; d < distance; d++) {
        const next = items.find(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.x === edge && i.y <= root.y && i.y + i.h >= root.y + root.h,
        );
        if (!next) break;
        targets.push(next.id);
        edge = next.x + next.w;
      }
      break;
    }
    case "left": {
      edge = root.x;
      for (let d = 0; d < distance; d++) {
        const next = items.find(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.x + i.w === edge && i.y <= root.y && i.y + i.h >= root.y + root.h,
        );
        if (!next) break;
        targets.push(next.id);
        edge = next.x;
      }
      break;
    }
    case "down": {
      edge = root.y + root.h;
      for (let d = 0; d < distance; d++) {
        const next = items.find(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.y === edge && i.x <= root.x && i.x + i.w >= root.x + root.w,
        );
        if (!next) break;
        targets.push(next.id);
        edge = next.y + next.h;
      }
      break;
    }
    case "up": {
      edge = root.y;
      for (let d = 0; d < distance; d++) {
        const next = items.find(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.y + i.h === edge && i.x <= root.x && i.x + i.w >= root.x + root.w,
        );
        if (!next) break;
        targets.push(next.id);
        edge = next.y;
      }
      break;
    }
  }

  return targets;
}
