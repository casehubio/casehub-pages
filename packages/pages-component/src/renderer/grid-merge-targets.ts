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
        const tier = items.filter(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.x === edge && i.y < root.y + root.h && i.y + i.h > root.y,
        );
        if (tier.length === 0) break;
        for (const t of tier) targets.push(t.id);
        edge = Math.max(...tier.map(t => t.x + t.w));
      }
      break;
    }
    case "left": {
      edge = root.x;
      for (let d = 0; d < distance; d++) {
        const tier = items.filter(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.x + i.w === edge && i.y < root.y + root.h && i.y + i.h > root.y,
        );
        if (tier.length === 0) break;
        for (const t of tier) targets.push(t.id);
        edge = Math.min(...tier.map(t => t.x));
      }
      break;
    }
    case "down": {
      edge = root.y + root.h;
      for (let d = 0; d < distance; d++) {
        const tier = items.filter(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.y === edge && i.x < root.x + root.w && i.x + i.w > root.x,
        );
        if (tier.length === 0) break;
        for (const t of tier) targets.push(t.id);
        edge = Math.max(...tier.map(t => t.y + t.h));
      }
      break;
    }
    case "up": {
      edge = root.y;
      for (let d = 0; d < distance; d++) {
        const tier = items.filter(i =>
          i.id !== rootId && !targets.includes(i.id) &&
          i.y + i.h === edge && i.x < root.x + root.w && i.x + i.w > root.x,
        );
        if (tier.length === 0) break;
        for (const t of tier) targets.push(t.id);
        edge = Math.min(...tier.map(t => t.y));
      }
      break;
    }
  }

  return targets;
}
