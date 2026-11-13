import { describe, it, expect } from "vitest";
import { computeMergeTargets, computeMergeDirection } from "./grid-merge-targets.js";
import type { IdRect } from "./grid-compaction.js";

describe("computeMergeDirection", () => {
  it("returns null for small movements", () => {
    expect(computeMergeDirection(2, 3)).toBeNull();
  });

  it("returns right for positive horizontal drag", () => {
    expect(computeMergeDirection(20, 5)).toBe("right");
  });

  it("returns left for negative horizontal drag", () => {
    expect(computeMergeDirection(-20, 5)).toBe("left");
  });

  it("returns down for positive vertical drag", () => {
    expect(computeMergeDirection(3, 20)).toBe("down");
  });

  it("returns up for negative vertical drag", () => {
    expect(computeMergeDirection(3, -20)).toBe("up");
  });
});

describe("computeMergeTargets", () => {
  const items: IdRect[] = [
    { id: "0", x: 0, y: 0, w: 4, h: 1 },
    { id: "1", x: 4, y: 0, w: 4, h: 1 },
    { id: "2", x: 8, y: 0, w: 4, h: 1 },
  ];

  it("dragging right from item 0 targets item 1", () => {
    const targets = computeMergeTargets(items, "0", "right", 1);
    expect(targets).toEqual(["1"]);
  });

  it("dragging right from item 0 with distance 2 targets items 1 and 2", () => {
    const targets = computeMergeTargets(items, "0", "right", 2);
    expect(targets).toEqual(["1", "2"]);
  });

  it("dragging left from item 2 targets item 1", () => {
    const targets = computeMergeTargets(items, "2", "left", 1);
    expect(targets).toEqual(["1"]);
  });

  it("does not jump over gaps", () => {
    const gapped: IdRect[] = [
      { id: "0", x: 0, y: 0, w: 4, h: 1 },
      { id: "2", x: 8, y: 0, w: 4, h: 1 },
    ];
    const targets = computeMergeTargets(gapped, "0", "right", 2);
    expect(targets).toEqual([]);
  });

  it("drags down to vertically adjacent items", () => {
    const vertical: IdRect[] = [
      { id: "0", x: 0, y: 0, w: 12, h: 1 },
      { id: "1", x: 0, y: 1, w: 12, h: 1 },
      { id: "2", x: 0, y: 2, w: 12, h: 1 },
    ];
    const targets = computeMergeTargets(vertical, "0", "down", 2);
    expect(targets).toEqual(["1", "2"]);
  });

  it("returns empty for unknown root id", () => {
    const targets = computeMergeTargets(items, "99", "right", 1);
    expect(targets).toEqual([]);
  });

  it("returns empty for zero distance", () => {
    const targets = computeMergeTargets(items, "0", "right", 0);
    expect(targets).toEqual([]);
  });

  it("dragging down from wide root collects all overlapping items", () => {
    const grid: IdRect[] = [
      { id: "0", x: 0, y: 0, w: 12, h: 2 },
      { id: "1", x: 0, y: 2, w: 6, h: 4 },
      { id: "2", x: 6, y: 2, w: 6, h: 4 },
    ];
    const targets = computeMergeTargets(grid, "0", "down", 1);
    expect(targets).toContain("1");
    expect(targets).toContain("2");
    expect(targets).toHaveLength(2);
  });

  it("dragging right from tall root collects all overlapping items", () => {
    const grid: IdRect[] = [
      { id: "0", x: 0, y: 0, w: 4, h: 4 },
      { id: "1", x: 4, y: 0, w: 8, h: 2 },
      { id: "2", x: 4, y: 2, w: 8, h: 2 },
    ];
    const targets = computeMergeTargets(grid, "0", "right", 1);
    expect(targets).toContain("1");
    expect(targets).toContain("2");
    expect(targets).toHaveLength(2);
  });
});
