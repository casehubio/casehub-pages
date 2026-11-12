import { describe, it, expect } from "vitest";
import { overlaps, compact, place, push, compactAll, autoShrinkHeight, isNestedGrid } from "./grid-compaction.js";
import type { Rect, IdRect } from "./grid-compaction.js";

describe("overlaps", () => {
  it("returns true for intersecting rectangles", () => {
    expect(overlaps({ x: 0, y: 0, w: 4, h: 2 }, { x: 2, y: 1, w: 4, h: 2 })).toBe(true);
  });

  it("returns false for adjacent rectangles (touching edges)", () => {
    expect(overlaps({ x: 0, y: 0, w: 4, h: 2 }, { x: 4, y: 0, w: 4, h: 2 })).toBe(false);
  });

  it("returns false for non-overlapping rectangles", () => {
    expect(overlaps({ x: 0, y: 0, w: 4, h: 2 }, { x: 6, y: 4, w: 2, h: 1 })).toBe(false);
  });

  it("returns true for fully contained rectangle", () => {
    expect(overlaps({ x: 0, y: 0, w: 8, h: 4 }, { x: 2, y: 1, w: 2, h: 1 })).toBe(true);
  });

  it("returns false for same-column vertically adjacent", () => {
    expect(overlaps({ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 6, h: 2 })).toBe(false);
  });
});

describe("place", () => {
  it("updates the moved item's position", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
    ];
    const result = place(items, "a", { x: 0, y: 3, w: 6, h: 2 });
    expect(result.find(i => i.id === "a")).toEqual({ id: "a", x: 0, y: 3, w: 6, h: 2 });
    expect(result.find(i => i.id === "b")).toEqual({ id: "b", x: 6, y: 0, w: 6, h: 2 });
  });
});

describe("push", () => {
  it("pushes overlapping items below the moved item", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 0, y: 1, w: 6, h: 2 },
    ];
    const result = push(items, "a");
    expect(result.find(i => i.id === "b")!.y).toBe(2);
  });

  it("does not push items in non-overlapping columns", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 4, h: 4 },
      { id: "b", x: 6, y: 1, w: 4, h: 2 },
    ];
    const result = push(items, "a");
    expect(result.find(i => i.id === "b")!.y).toBe(1);
  });
});

describe("compact", () => {
  it("moves items up to fill gaps", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 1 },
      { id: "b", x: 0, y: 5, w: 6, h: 1 },
    ];
    const result = compact(items);
    expect(result.find(i => i.id === "b")!.y).toBe(1);
  });

  it("preserves horizontal gaps (does not compact columns)", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 4, h: 1 },
      { id: "b", x: 8, y: 0, w: 4, h: 1 },
    ];
    const result = compact(items);
    expect(result.find(i => i.id === "a")!.x).toBe(0);
    expect(result.find(i => i.id === "b")!.x).toBe(8);
  });

  it("handles items that can compact into the same row (different columns)", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 1 },
      { id: "b", x: 6, y: 3, w: 6, h: 1 },
    ];
    const result = compact(items);
    expect(result.find(i => i.id === "b")!.y).toBe(0);
  });

  it("does not move items above other items they overlap with", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 12, h: 2 },
      { id: "b", x: 0, y: 5, w: 6, h: 1 },
    ];
    const result = compact(items);
    expect(result.find(i => i.id === "b")!.y).toBe(2);
  });
});

describe("compactAll", () => {
  it("place + push + compact in one call", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 0, y: 4, w: 6, h: 2 },
      { id: "c", x: 0, y: 6, w: 6, h: 2 },
    ];
    const result = compactAll(items, "a", { x: 0, y: 3, w: 6, h: 2 });
    const a = result.find(i => i.id === "a")!;
    const b = result.find(i => i.id === "b")!;
    const c = result.find(i => i.id === "c")!;
    expect(a.y).toBe(3);
    expect(b.y).toBe(0);
    expect(c.y).toBe(5);
  });

  it("is idempotent", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 0, y: 1, w: 6, h: 2 },
    ];
    const first = compactAll(items, "a", { x: 0, y: 0, w: 6, h: 2 });
    const second = compactAll(first, "a", { x: 0, y: 0, w: 6, h: 2 });
    expect(second).toEqual(first);
  });
});

describe("autoShrinkHeight", () => {
  it("returns the max y+h across all items", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 3 },
    ];
    expect(autoShrinkHeight(items)).toBe(3);
  });

  it("returns 0 for empty items", () => {
    expect(autoShrinkHeight([])).toBe(0);
  });
});

describe("nested compaction independence", () => {
  it("compacting inner items does not affect outer items", () => {
    const outer: IdRect[] = [
      { id: "container", x: 0, y: 0, w: 6, h: 4 },
      { id: "sibling", x: 6, y: 0, w: 6, h: 2 },
    ];
    const inner: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 1 },
      { id: "b", x: 0, y: 3, w: 6, h: 1 },
    ];
    const compactedInner = compact(inner);
    expect(compactedInner.find(i => i.id === "b")!.y).toBe(1);
    expect(autoShrinkHeight(compactedInner)).toBe(2);
    expect(outer.find(i => i.id === "sibling")!.y).toBe(0);
  });

  it("auto-shrink reflects compacted content height", () => {
    const inner: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 12, h: 1 },
      { id: "b", x: 0, y: 5, w: 12, h: 1 },
    ];
    const compacted = compact(inner);
    expect(autoShrinkHeight(compacted)).toBe(2);
  });
});

describe("isNestedGrid", () => {
  it("returns true for grid component with grid items", () => {
    expect(isNestedGrid({ component: { type: "grid", grid: [{ placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 } }] } })).toBe(true);
  });

  it("returns false for non-grid component", () => {
    expect(isNestedGrid({ component: { type: "html" } })).toBe(false);
  });

  it("returns false for grid component with empty grid", () => {
    expect(isNestedGrid({ component: { type: "grid", grid: [] } })).toBe(false);
  });

  it("returns false for item without component", () => {
    expect(isNestedGrid({})).toBe(false);
  });
});
