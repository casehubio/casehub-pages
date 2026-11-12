import { describe, it, expect } from "vitest";
import { resizeItem } from "./grid-resize.js";
import type { IdRect } from "./grid-compaction.js";

describe("resizeItem", () => {
  it("increases width from right edge", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 4, h: 2 }];
    const result = resizeItem(items, "a", "right", 2, 12);
    expect(result[0]).toEqual({ id: "a", x: 0, y: 0, w: 6, h: 2 });
  });

  it("decreases width from right edge", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 6, h: 2 }];
    const result = resizeItem(items, "a", "right", -2, 12);
    expect(result[0]).toEqual({ id: "a", x: 0, y: 0, w: 4, h: 2 });
  });

  it("clamps width to minimum 1", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 2, h: 2 }];
    const result = resizeItem(items, "a", "right", -5, 12);
    expect(result[0]!.w).toBe(1);
  });

  it("clamps width to columns boundary", () => {
    const items: IdRect[] = [{ id: "a", x: 8, y: 0, w: 4, h: 2 }];
    const result = resizeItem(items, "a", "right", 5, 12);
    expect(result[0]!.x + result[0]!.w).toBeLessThanOrEqual(12);
  });

  it("increases height from bottom edge", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 6, h: 2 }];
    const result = resizeItem(items, "a", "bottom", 1, 12);
    expect(result[0]).toEqual({ id: "a", x: 0, y: 0, w: 6, h: 3 });
  });

  it("moves item right when resizing from left edge", () => {
    const items: IdRect[] = [{ id: "a", x: 2, y: 0, w: 6, h: 2 }];
    const result = resizeItem(items, "a", "left", 2, 12);
    expect(result[0]).toEqual({ id: "a", x: 4, y: 0, w: 4, h: 2 });
  });

  it("moves item down when resizing from top edge", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 2, w: 6, h: 4 }];
    const result = resizeItem(items, "a", "top", 1, 12);
    expect(result[0]).toEqual({ id: "a", x: 0, y: 3, w: 6, h: 3 });
  });

  it("preserves other items", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
    ];
    const result = resizeItem(items, "a", "right", 2, 12);
    expect(result.find(i => i.id === "b")).toEqual({ id: "b", x: 6, y: 0, w: 6, h: 2 });
  });
});
