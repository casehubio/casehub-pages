import { describe, it, expect } from "vitest";
import {
  canSplit,
  splitItem,
  mergeItems,
  validSplitDirections,
} from "./grid-split-merge.js";
import type { IdRect } from "./grid-compaction.js";

describe("canSplit", () => {
  it("allows horizontal split when h >= 2", () => {
    expect(canSplit({ id: "a", x: 0, y: 0, w: 6, h: 2 }, "horizontal")).toBe(true);
  });

  it("allows vertical split when w >= 2", () => {
    expect(canSplit({ id: "a", x: 0, y: 0, w: 6, h: 1 }, "vertical")).toBe(true);
  });

  it("disallows horizontal split when h === 1", () => {
    expect(canSplit({ id: "a", x: 0, y: 0, w: 6, h: 1 }, "horizontal")).toBe(false);
  });

  it("disallows vertical split when w === 1", () => {
    expect(canSplit({ id: "a", x: 0, y: 0, w: 1, h: 2 }, "vertical")).toBe(false);
  });

  it("disallows both for 1x1 cell", () => {
    expect(canSplit({ id: "a", x: 0, y: 0, w: 1, h: 1 }, "horizontal")).toBe(false);
    expect(canSplit({ id: "a", x: 0, y: 0, w: 1, h: 1 }, "vertical")).toBe(false);
  });
});

describe("validSplitDirections", () => {
  it("returns both for 4x2", () => {
    expect(validSplitDirections({ id: "a", x: 0, y: 0, w: 4, h: 2 }).sort()).toEqual(["horizontal", "vertical"]);
  });

  it("returns vertical only for 4x1", () => {
    expect(validSplitDirections({ id: "a", x: 0, y: 0, w: 4, h: 1 })).toEqual(["vertical"]);
  });

  it("returns empty for 1x1", () => {
    expect(validSplitDirections({ id: "a", x: 0, y: 0, w: 1, h: 1 })).toEqual([]);
  });
});

describe("splitItem", () => {
  it("horizontal split divides height in half", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 6, h: 4 }];
    const result = splitItem(items, "a", "horizontal", "b");
    expect(result).toEqual([
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 0, y: 2, w: 6, h: 2 },
    ]);
  });

  it("vertical split divides width in half", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 6, h: 2 }];
    const result = splitItem(items, "a", "vertical", "b");
    expect(result).toEqual([
      { id: "a", x: 0, y: 0, w: 3, h: 2 },
      { id: "b", x: 3, y: 0, w: 3, h: 2 },
    ]);
  });

  it("horizontal split of odd height gives floor/ceil", () => {
    const items: IdRect[] = [{ id: "a", x: 0, y: 0, w: 6, h: 3 }];
    const result = splitItem(items, "a", "horizontal", "b");
    expect(result[0]!.h + result[1]!.h).toBe(3);
  });

  it("preserves other items", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 4 },
      { id: "c", x: 6, y: 0, w: 6, h: 2 },
    ];
    const result = splitItem(items, "a", "horizontal", "b");
    expect(result.find(i => i.id === "c")).toEqual({ id: "c", x: 6, y: 0, w: 6, h: 2 });
  });
});

describe("mergeItems", () => {
  it("merges two adjacent items into bounding rect", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
    ];
    const result = mergeItems(items, ["a", "b"], "a");
    expect(result).toEqual([{ id: "a", x: 0, y: 0, w: 12, h: 2 }]);
  });

  it("merges vertically stacked items", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 0, y: 2, w: 6, h: 2 },
    ];
    const result = mergeItems(items, ["a", "b"], "a");
    expect(result).toEqual([{ id: "a", x: 0, y: 0, w: 6, h: 4 }]);
  });

  it("preserves items not in the merge set", () => {
    const items: IdRect[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
      { id: "c", x: 0, y: 2, w: 12, h: 1 },
    ];
    const result = mergeItems(items, ["a", "b"], "a");
    expect(result.find(i => i.id === "c")).toEqual({ id: "c", x: 0, y: 2, w: 12, h: 1 });
  });
});
