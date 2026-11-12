export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface IdRect extends Rect {
  readonly id: string;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

export function place(items: readonly IdRect[], movedId: string, target: Rect): IdRect[] {
  return items.map(item =>
    item.id === movedId
      ? { ...item, x: target.x, y: target.y, w: target.w, h: target.h }
      : { ...item },
  );
}

export function push(items: readonly IdRect[], movedId: string, pinnedIds?: ReadonlySet<string>): IdRect[] {
  const moved = items.find(i => i.id === movedId);
  if (!moved) return items.map(i => ({ ...i }));
  return items.map(item => {
    if (item.id === movedId || pinnedIds?.has(item.id)) return { ...item };
    if (overlaps(moved, item)) {
      return { ...item, y: moved.y + moved.h };
    }
    return { ...item };
  });
}

export function compactDown(items: readonly IdRect[], pinnedId: string, pinnedIds?: ReadonlySet<string>): IdRect[] {
  const pinned = items.find(i => i.id === pinnedId);
  if (!pinned) return items.map(i => ({ ...i }));
  const others = items.filter(i => i.id !== pinnedId);
  const sorted = [...others].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x,
  );
  const result: IdRect[] = [{ ...pinned }];
  for (const item of sorted) {
    if (pinnedIds?.has(item.id)) { result.push({ ...item }); continue; }
    let bestY = item.y;
    let settled = false;
    while (!settled) {
      settled = true;
      for (const placed of result) {
        if (overlaps({ ...item, y: bestY }, placed)) {
          const newY = placed.y + placed.h;
          if (newY > bestY) {
            bestY = newY;
            settled = false;
          }
        }
      }
    }
    result.push({ ...item, y: bestY });
  }
  return result;
}

export function compact(items: readonly IdRect[], pinnedId?: string, pinnedIds?: ReadonlySet<string>): IdRect[] {
  const sorted = [...items].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x,
  );
  const result: IdRect[] = [];
  for (const item of sorted) {
    if (item.id === pinnedId || pinnedIds?.has(item.id)) {
      result.push({ ...item });
      continue;
    }
    let bestY = 0;
    let settled = false;
    while (!settled) {
      settled = true;
      for (const placed of result) {
        if (overlaps({ ...item, y: bestY }, placed)) {
          const newY = placed.y + placed.h;
          if (newY > bestY) {
            bestY = newY;
            settled = false;
          }
        }
      }
    }
    result.push({ ...item, y: bestY });
  }
  return result;
}

export function cascadePush(items: readonly IdRect[], movedId: string): IdRect[] {
  const result = items.map(i => ({ ...i }));
  const moved = result.find(i => i.id === movedId);
  if (!moved) return result;
  const queue = [moved];
  const processed = new Set([movedId]);
  while (queue.length > 0) {
    const pusher = queue.shift()!;
    for (const item of result) {
      if (processed.has(item.id)) continue;
      if (overlaps(pusher, item)) {
        item.y = pusher.y + pusher.h;
        processed.add(item.id);
        queue.push(item);
      }
    }
  }
  return result;
}

export function compactAll(
  items: readonly IdRect[],
  movedId: string,
  target: Rect,
  pinnedIds?: ReadonlySet<string>,
): IdRect[] {
  const placed = place(items, movedId, target);
  return compactDown(placed, movedId, pinnedIds);
}

export function resizeCompact(
  items: readonly IdRect[],
  movedId: string,
  target: Rect,
): IdRect[] {
  const placed = place(items, movedId, target);
  const cascaded = cascadePush(placed, movedId);
  return compact(cascaded, movedId);
}

export function autoShrinkHeight(items: readonly IdRect[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map(i => i.y + i.h));
}

export function isNestedGrid(item: { component?: { type?: string; grid?: readonly unknown[] } }): boolean {
  return item.component?.type === "grid" && Array.isArray(item.component.grid) && item.component.grid.length > 0;
}
