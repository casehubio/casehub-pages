import type { PositionedPlacement, IdentifiedPlacement } from "./grid-collision.js";
import { overlaps } from "./grid-collision.js";

/**
 * Single-rule layout resolver.
 *
 * Given items and a moved item's new placement, produce a layout where:
 * 1. The moved item is fixed at newPlacement
 * 2. No items overlap
 * 3. Every other item is as high as possible
 *
 * Place the moved item first, then re-place every other item top-to-bottom
 * at the lowest valid row. One rule, no special cases.
 */
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

  const placed: IdentifiedPlacement[] = [result.find(i => i.id === movedId)!];

  const rest = result
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

  return result;
}
