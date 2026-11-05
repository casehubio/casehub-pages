import { describe, it, expect } from "vitest";
import { overlaps, resolveCollisions } from "./grid-collision.js";
import type { IdentifiedPlacement } from "./grid-collision.js";

describe("overlaps", () => {
  it("returns true for intersecting rectangles", () => {
    const a = { mode: "positioned" as const, x: 0, y: 0, w: 4, h: 2 };
    const b = { mode: "positioned" as const, x: 2, y: 1, w: 4, h: 2 };
    expect(overlaps(a, b)).toBe(true);
  });

  it("returns false for adjacent rectangles (touching edges)", () => {
    const a = { mode: "positioned" as const, x: 0, y: 0, w: 4, h: 2 };
    const b = { mode: "positioned" as const, x: 4, y: 0, w: 4, h: 2 };
    expect(overlaps(a, b)).toBe(false);
  });

  it("returns false for non-overlapping rectangles", () => {
    const a = { mode: "positioned" as const, x: 0, y: 0, w: 4, h: 2 };
    const b = { mode: "positioned" as const, x: 6, y: 4, w: 2, h: 1 };
    expect(overlaps(a, b)).toBe(false);
  });

  it("returns true for fully contained rectangle", () => {
    const a = { mode: "positioned" as const, x: 0, y: 0, w: 8, h: 4 };
    const b = { mode: "positioned" as const, x: 2, y: 1, w: 2, h: 1 };
    expect(overlaps(a, b)).toBe(true);
  });
});

describe("resolveCollisions", () => {
  it("returns items unchanged when no overlap exists", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 6, y: 0, w: 6, h: 2 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 0, w: 6, h: 2 });
    expect(result).toEqual(items);
  });

  it("pushes overlapping item down", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 4, w: 6, h: 2 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 3, w: 6, h: 2 });
    const b = result.find(i => i.id === "b")!;
    expect(b.placement.y).toBe(5);
  });

  it("handles backward overlap — item dragged above existing item", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 1, w: 4, h: 3 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 5, w: 4, h: 1 } },
    ];
    const result = resolveCollisions(items, "b", { mode: "positioned", x: 0, y: 2, w: 4, h: 1 });
    const a = result.find(i => i.id === "a")!;
    expect(a.placement.y).toBe(3);
  });

  it("cascades displacement when pushing B causes overlap with C", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 4, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 3, w: 4, h: 2 } },
      { id: "c", placement: { mode: "positioned", x: 0, y: 5, w: 4, h: 2 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 2, w: 4, h: 2 });
    const b = result.find(i => i.id === "b")!;
    const c = result.find(i => i.id === "c")!;
    expect(b.placement.y).toBe(4);
    expect(c.placement.y).toBe(6);
  });

  it("does not displace edge-adjacent items (touching but not overlapping)", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 4, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 2, w: 4, h: 2 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 0, w: 4, h: 2 });
    const b = result.find(i => i.id === "b")!;
    expect(b.placement.y).toBe(2);
  });

  it("is idempotent — applying resolution twice gives same result", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 1, w: 6, h: 2 } },
    ];
    const newA = { mode: "positioned" as const, x: 0, y: 0, w: 6, h: 2 };
    const first = resolveCollisions(items, "a", newA);
    const second = resolveCollisions(first, "a", newA);
    expect(second).toEqual(first);
  });

  it("handles resize causing overlap", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 4, h: 1 } },
      { id: "b", placement: { mode: "positioned", x: 0, y: 1, w: 4, h: 1 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 0, w: 4, h: 3 });
    const b = result.find(i => i.id === "b")!;
    expect(b.placement.y).toBe(3);
  });

  it("does not move items in non-overlapping columns", () => {
    const items: IdentifiedPlacement[] = [
      { id: "a", placement: { mode: "positioned", x: 0, y: 0, w: 4, h: 2 } },
      { id: "b", placement: { mode: "positioned", x: 6, y: 1, w: 4, h: 2 } },
    ];
    const result = resolveCollisions(items, "a", { mode: "positioned", x: 0, y: 0, w: 4, h: 4 });
    const b = result.find(i => i.id === "b")!;
    expect(b.placement.y).toBe(1);
  });
});
