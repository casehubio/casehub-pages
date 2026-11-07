import { describe, it, expect } from "vitest";
import { resolveAndCompact } from "./grid-compaction.js";
import type { IdentifiedPlacement } from "./grid-collision.js";

function p(x: number, y: number, w: number, h: number) {
  return { mode: "positioned" as const, x, y, w, h };
}

function item(id: string, x: number, y: number, w: number, h: number): IdentifiedPlacement {
  return { id, placement: p(x, y, w, h) };
}

function find(result: IdentifiedPlacement[], id: string) {
  return result.find(i => i.id === id)!.placement;
}

describe("resolveAndCompact", () => {
  it("returns items unchanged when no overlap and no gaps", () => {
    const items = [item("a", 0, 0, 6, 1), item("b", 6, 0, 6, 1)];
    const result = resolveAndCompact(items, "a", p(0, 0, 6, 1));
    expect(find(result, "a")).toEqual(p(0, 0, 6, 1));
    expect(find(result, "b")).toEqual(p(6, 0, 6, 1));
  });

  it("pushes overlapping item below the moved item", () => {
    const items = [item("a", 0, 0, 6, 1), item("b", 0, 1, 6, 1)];
    const result = resolveAndCompact(items, "a", p(0, 0, 6, 2));
    expect(find(result, "a").y).toBe(0);
    expect(find(result, "a").h).toBe(2);
    expect(find(result, "b").y).toBe(2);
  });

  it("compacts gaps upward", () => {
    const items = [item("a", 0, 0, 4, 1), item("b", 0, 5, 4, 1)];
    const result = resolveAndCompact(items, "a", p(0, 0, 4, 1));
    expect(find(result, "b").y).toBe(1);
  });

  it("items in non-overlapping columns compact independently", () => {
    const items = [item("a", 0, 0, 4, 2), item("b", 6, 5, 4, 1)];
    const result = resolveAndCompact(items, "a", p(0, 0, 4, 2));
    expect(find(result, "b").y).toBe(0);
  });

  it("does not compact horizontally — column positions preserved", () => {
    const items = [item("a", 8, 0, 4, 1)];
    const result = resolveAndCompact(items, "a", p(8, 0, 4, 1));
    expect(find(result, "a").x).toBe(8);
  });

  it("is idempotent", () => {
    const items = [item("a", 0, 0, 6, 2), item("b", 0, 1, 6, 2)];
    const placement = p(0, 0, 6, 2);
    const first = resolveAndCompact(items, "a", placement);
    const second = resolveAndCompact(first, "a", placement);
    expect(second).toEqual(first);
  });

  describe("resize expand — displaced items go to next row, not bottom", () => {
    // Layout:
    // Row 0: A(4x3), B(8x1)
    // Row 1: A cont, C(4x2), D(2x1), E(2x1)
    // Row 2: A cont, C cont, F(4x1)
    // Row 3: G(6x2), H(6x2)
    // Row 4: G cont, H cont
    const layout = () => [
      item("A", 0, 0, 4, 3),
      item("B", 4, 0, 8, 1),
      item("C", 4, 1, 4, 2),
      item("D", 8, 1, 2, 1),
      item("E", 10, 1, 2, 1),
      item("F", 8, 2, 4, 1),
      item("G", 0, 3, 6, 2),
      item("H", 6, 3, 6, 2),
    ];

    it("expanding C right displaces D and F, G compacts up next to them", () => {
      const result = resolveAndCompact(layout(), "C", p(4, 1, 6, 2));
      const g = find(result, "G");
      const d = find(result, "D");
      // G should compact up alongside D (different columns)
      expect(g.y).toBeLessThanOrEqual(d.y + 1);
      // D should be right below C, not at the bottom
      expect(d.y).toBe(3);
    });
  });

  describe("resize shrink — items compact back into freed space", () => {
    it("shrinking restores layout after expand+shrink cycle", () => {
      const original = [
        item("a", 0, 0, 6, 1),
        item("b", 6, 0, 6, 1),
        item("c", 0, 1, 12, 1),
      ];

      // Expand a to 12 wide — displaces b
      const expanded = resolveAndCompact(original, "a", p(0, 0, 12, 1));
      expect(find(expanded, "b").y).toBeGreaterThan(0);

      // Shrink a back to 6 wide — b should compact back to row 0
      const shrunk = resolveAndCompact(expanded, "a", p(0, 0, 6, 1));
      expect(find(shrunk, "b")).toEqual(p(6, 0, 6, 1));
    });

    it("shrinking panel allows displaced items to float back up", () => {
      // Two items side by side, third below
      const items = [
        item("a", 0, 0, 4, 1),
        item("b", 4, 0, 4, 1),
        item("c", 0, 1, 8, 1),
      ];

      // Expand a to 8 wide — pushes b down
      const expanded = resolveAndCompact(items, "a", p(0, 0, 8, 1));
      const bAfterExpand = find(expanded, "b");
      expect(bAfterExpand.y).toBeGreaterThan(0);

      // Shrink a back to 4 wide — b should float back to row 0
      const shrunk = resolveAndCompact(expanded, "a", p(0, 0, 4, 1));
      expect(find(shrunk, "b").y).toBe(0);
      expect(find(shrunk, "b").x).toBe(4);
    });

    it("partial shrink allows some items to compact up", () => {
      const items = [
        item("a", 0, 0, 6, 2),
        item("b", 6, 0, 6, 1),
        item("c", 0, 2, 6, 1),
      ];

      // Expand a height from 2 to 4 — pushes c down (same columns)
      const expanded = resolveAndCompact(items, "a", p(0, 0, 6, 4));
      expect(find(expanded, "c").y).toBeGreaterThanOrEqual(4);

      // Shrink a height from 4 to 2 — c should float back up to row 2
      const shrunk = resolveAndCompact(expanded, "a", p(0, 0, 6, 2));
      expect(find(shrunk, "c").y).toBe(2);
    });
  });

  describe("move — displace and compact", () => {
    it("move displaces overlapping item, compact fills freed space", () => {
      const items = [
        item("a", 0, 0, 6, 2),
        item("b", 0, 2, 6, 1),
      ];
      // Move a down to y:1 — overlaps b. b displaced then compacts to y:0 (freed by a moving down)
      const result = resolveAndCompact(items, "a", p(0, 1, 6, 2));
      expect(find(result, "a").y).toBe(1);
      expect(find(result, "b").y).toBe(0);
    });

    it("move frees space — displaced items compact into it", () => {
      const items = [
        item("a", 0, 0, 6, 2),
        item("b", 0, 3, 6, 1),
      ];
      // Move a to y:2 — b was at y:3, a now covers y:2-3, pushes b to y:4
      // But compact pulls b up: b at y:0 doesn't overlap a at y:2. b goes to y:0.
      const result = resolveAndCompact(items, "a", p(0, 2, 6, 2));
      expect(find(result, "a").y).toBe(2);
      expect(find(result, "b").y).toBe(0);
    });
  });
});
