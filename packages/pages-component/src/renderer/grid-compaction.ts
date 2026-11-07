import type { PositionedPlacement, IdentifiedPlacement } from "./grid-collision.js";
import { overlaps } from "./grid-collision.js";

/**
 * Pluggable compactor interface.
 *
 * A compactor takes a list of items (with the moved item already at its
 * new placement) and returns the resolved layout. The moved item's
 * placement is fixed — the compactor only repositions other items.
 */
export interface GridCompactor {
  resolve(
    items: IdentifiedPlacement[],
    movedId: string,
  ): void;
}

/**
 * Vertical compaction (gravity top). The standard.
 * Each non-moved item is placed at the lowest row where it fits.
 */
export const verticalCompactor: GridCompactor = {
  resolve(items, movedId) {
    const placed: IdentifiedPlacement[] = [items.find(i => i.id === movedId)!];
    const rest = items
      .filter(i => i.id !== movedId)
      .sort((a, b) =>
        a.placement.y !== b.placement.y
          ? a.placement.y - b.placement.y
          : a.placement.x - b.placement.x,
      );

    for (const item of rest) {
      for (let tryY = 0; ; tryY++) {
        const candidate: PositionedPlacement = { ...item.placement, y: tryY };
        const blocked = placed.some(p => overlaps(candidate, p.placement));
        if (!blocked) {
          (item as { placement: PositionedPlacement }).placement = candidate;
          placed.push(item);
          break;
        }
      }
    }
  },
};

/**
 * Float compactor (no gravity). Items stay where they are unless
 * they overlap the moved item, in which case they shift down minimally.
 */
export const floatCompactor: GridCompactor = {
  resolve(items, movedId) {
    const moved = items.find(i => i.id === movedId)!;
    for (const item of items) {
      if (item.id === movedId) continue;
      while (overlaps(moved.placement, item.placement)) {
        (item as { placement: PositionedPlacement }).placement = {
          ...item.placement,
          y: item.placement.y + 1,
        };
      }
    }
    // Cascade: resolve any secondary overlaps
    const sorted = items
      .filter(i => i.id !== movedId)
      .sort((a, b) => a.placement.y - b.placement.y);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (overlaps(sorted[i]!.placement, sorted[j]!.placement)) {
          (sorted[j] as { placement: PositionedPlacement }).placement = {
            ...sorted[j]!.placement,
            y: sorted[i]!.placement.y + sorted[i]!.placement.h,
          };
        }
      }
    }
  },
};

/**
 * Apply a new placement and resolve the layout with the given compactor.
 */
export function resolveAndCompact(
  items: readonly IdentifiedPlacement[],
  movedId: string,
  newPlacement: PositionedPlacement,
  compactor: GridCompactor = verticalCompactor,
): IdentifiedPlacement[] {
  const result: IdentifiedPlacement[] = items.map(item =>
    item.id === movedId
      ? { id: item.id, placement: { ...newPlacement } }
      : { id: item.id, placement: { ...item.placement } },
  );

  compactor.resolve(result, movedId);
  return result;
}
