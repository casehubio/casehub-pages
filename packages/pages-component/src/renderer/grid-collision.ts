import type { GridPlacement } from "../model/types.js";

export type PositionedPlacement = Extract<GridPlacement, { mode: "positioned" }>;

export interface IdentifiedPlacement {
  readonly id: string;
  readonly placement: PositionedPlacement;
}

export function overlaps(a: PositionedPlacement, b: PositionedPlacement): boolean {
  return a.x < b.x + b.w
      && a.x + a.w > b.x
      && a.y < b.y + b.h
      && a.y + a.h > b.y;
}

export function resolveCollisions(
  items: readonly IdentifiedPlacement[],
  movedId: string,
  newPlacement: PositionedPlacement,
): IdentifiedPlacement[] {
  const result: IdentifiedPlacement[] = items.map(item =>
    item.id === movedId
      ? { id: item.id, placement: newPlacement }
      : { id: item.id, placement: { ...item.placement } },
  );

  const moved = result.find(i => i.id === movedId)!;

  for (const item of result) {
    if (item.id === movedId) continue;
    if (overlaps(moved.placement, item.placement)) {
      (item as { placement: PositionedPlacement }).placement = {
        ...item.placement,
        y: moved.placement.y + moved.placement.h,
      };
    }
  }

  result.sort((a, b) =>
    a.placement.y !== b.placement.y
      ? a.placement.y - b.placement.y
      : a.placement.x - b.placement.x,
  );

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      if (overlaps(result[i]!.placement, result[j]!.placement)) {
        (result[j] as { placement: PositionedPlacement }).placement = {
          ...result[j]!.placement,
          y: result[i]!.placement.y + result[i]!.placement.h,
        };
      }
    }
  }

  return result;
}
