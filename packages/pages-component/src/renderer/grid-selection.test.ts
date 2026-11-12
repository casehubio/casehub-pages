import { describe, it, expect } from "vitest";
import {
  selectItem,
  extendSelection,
  clearSelection,
  computeBounds,
} from "./grid-selection.js";
import type { IdRect } from "./grid-compaction.js";

const items: IdRect[] = [
  { id: "a", x: 0, y: 0, w: 4, h: 2 },
  { id: "b", x: 4, y: 0, w: 4, h: 2 },
  { id: "c", x: 8, y: 0, w: 4, h: 2 },
  { id: "d", x: 0, y: 2, w: 6, h: 2 },
  { id: "e", x: 6, y: 2, w: 6, h: 2 },
];

describe("selectItem", () => {
  it("selects a single item, clearing previous selection", () => {
    const sel = selectItem(clearSelection(), "b", items);
    expect(sel.items).toEqual(["b"]);
    expect(sel.bounds).toEqual({ x: 4, y: 0, w: 4, h: 2 });
  });
});

describe("extendSelection", () => {
  it("extends selection to bounding rect of first and new item", () => {
    const sel = selectItem(clearSelection(), "a", items);
    const extended = extendSelection(sel, "c", items);
    expect([...extended.items].sort()).toEqual(["a", "b", "c"]);
    expect(extended.bounds).toEqual({ x: 0, y: 0, w: 12, h: 2 });
  });

  it("extends to include items in the bounding rectangle", () => {
    const sel = selectItem(clearSelection(), "a", items);
    const extended = extendSelection(sel, "e", items);
    expect([...extended.items].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("computeBounds", () => {
  it("returns null for empty selection", () => {
    expect(computeBounds([], items)).toBeNull();
  });

  it("returns the item's rect for single selection", () => {
    expect(computeBounds(["d"], items)).toEqual({ x: 0, y: 2, w: 6, h: 2 });
  });

  it("returns bounding rect for multiple items", () => {
    expect(computeBounds(["a", "e"], items)).toEqual({ x: 0, y: 0, w: 12, h: 4 });
  });
});
