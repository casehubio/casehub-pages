import type { PositionedPlacement, IdentifiedPlacement } from "./grid-collision.js";
import { overlaps } from "./grid-collision.js";

export function resolveAndCompact(
  items: readonly IdentifiedPlacement[],
  movedId: string,
  newPlacement: PositionedPlacement,
): IdentifiedPlacement[] {
  const result: IdentifiedPlacement[] = items.map(item =>
    item.id === movedId
      ? { id: item.id, placement: { ...newPlacement } }
      : { id: item.id, placement: { ...item.placement } },
  );

  const moved = result.find(i => i.id === movedId)!;

  // 1. Find displaced items
  const displacedIds = new Set<string>();
  for (const item of result) {
    if (item.id === movedId) continue;
    if (overlaps(moved.placement, item.placement)) {
      displacedIds.add(item.id);
    }
  }

  if (displacedIds.size > 0) {
    // 2. Pack displaced items to find how many rows they need
    const displaced = result
      .filter(i => displacedIds.has(i.id))
      .sort((a, b) =>
        a.placement.y !== b.placement.y
          ? a.placement.y - b.placement.y
          : a.placement.x - b.placement.x,
      );

    const packed = displaced.map(i => ({ ...i, placement: { ...i.placement, y: 0 } }));
    for (let idx = 0; idx < packed.length; idx++) {
      for (let tryY = 0; tryY < 100; tryY++) {
        (packed[idx] as { placement: PositionedPlacement }).placement = {
          ...packed[idx]!.placement,
          y: tryY,
        };
        const blocked = packed.some(
          (other, otherIdx) =>
            otherIdx < idx && overlaps(packed[idx]!.placement, other.placement),
        );
        if (!blocked) break;
      }
    }

    const insertRows = packed.reduce(
      (max, p) => Math.max(max, p.placement.y + p.placement.h),
      0,
    );
    const insertY = moved.placement.y + moved.placement.h;

    // 3. Insert rows — shift non-displaced items below insertY down
    for (const item of result) {
      if (item.id === movedId) continue;
      if (displacedIds.has(item.id)) continue;
      if (item.placement.y >= insertY) {
        (item as { placement: PositionedPlacement }).placement = {
          ...item.placement,
          y: item.placement.y + insertRows,
        };
      }
    }

    // 4. Place displaced items in the inserted space
    for (let idx = 0; idx < displaced.length; idx++) {
      (displaced[idx] as { placement: PositionedPlacement }).placement = {
        ...displaced[idx]!.placement,
        y: insertY + packed[idx]!.placement.y,
      };
    }
  }

  // 5. Compact ALL non-moved items upward (runs even when no displacement)
  result.sort((a, b) =>
    a.placement.y !== b.placement.y
      ? a.placement.y - b.placement.y
      : a.placement.x - b.placement.x,
  );
  for (const item of result) {
    if (item.id === movedId) continue;
    for (let tryY = 0; tryY < item.placement.y; tryY++) {
      const candidate: PositionedPlacement = { ...item.placement, y: tryY };
      const blocked = result.some(
        other => other !== item && overlaps(candidate, other.placement),
      );
      if (!blocked) {
        (item as { placement: PositionedPlacement }).placement = candidate;
        break;
      }
    }
  }

  return result;
}
