import { describe, it, expect } from "vitest";
import { computeGridGeometry, snapToCell, clampPlacement, hitTestHandle, cellRectToPixel } from "./grid-drag.js";

describe("computeGridGeometry", () => {
  it("computes cell dimensions for a 12-column grid with gap", () => {
    const rect = { x: 0, y: 0, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 12);
    expect(geo.columns).toBe(12);
    expect(geo.cellWidth).toBeCloseTo((1200 - 11 * 12) / 12);
    expect(geo.cellHeight).toBe(60);
    expect(geo.gap).toBe(12);
  });

  it("computes cell dimensions with zero gap", () => {
    const rect = { x: 0, y: 0, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 0);
    expect(geo.cellWidth).toBe(100);
  });
});

describe("snapToCell", () => {
  it("snaps pointer at top-left to cell (0, 0)", () => {
    const rect = { x: 100, y: 50, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 12);
    const cell = snapToCell(105, 55, geo);
    expect(cell.x).toBe(0);
    expect(cell.y).toBe(0);
  });

  it("snaps pointer in middle of grid to correct cell", () => {
    const rect = { x: 0, y: 0, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 0);
    const cell = snapToCell(500, 130, geo);
    expect(cell.x).toBe(5);
    expect(cell.y).toBe(2);
  });

  it("clamps negative positions to zero", () => {
    const rect = { x: 100, y: 100, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 12);
    const cell = snapToCell(50, 50, geo);
    expect(cell.x).toBe(0);
    expect(cell.y).toBe(0);
  });
});

describe("clampPlacement", () => {
  it("clamps x so item does not exceed grid columns", () => {
    const result = clampPlacement(11, 0, 4, 1, 12);
    expect(result.x).toBe(8);
  });

  it("clamps negative y to zero", () => {
    const result = clampPlacement(0, -2, 4, 1, 12);
    expect(result.y).toBe(0);
  });

  it("does not clamp valid positions", () => {
    const result = clampPlacement(4, 3, 4, 2, 12);
    expect(result.x).toBe(4);
    expect(result.y).toBe(3);
  });
});

describe("cellRectToPixel", () => {
  it("converts cell coordinates to pixel rect with gap", () => {
    const rect = { x: 0, y: 0, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 12);
    const pixel = cellRectToPixel(0, 0, 1, 1, geo);
    expect(pixel.left).toBe(0);
    expect(pixel.top).toBe(0);
    expect(pixel.width).toBeCloseTo(geo.cellWidth);
    expect(pixel.height).toBe(60);
  });

  it("accounts for gap in multi-cell rects", () => {
    const rect = { x: 0, y: 0, width: 1200, height: 600 } as DOMRect;
    const geo = computeGridGeometry(rect, 12, 60, 12);
    const pixel = cellRectToPixel(0, 0, 2, 2, geo);
    expect(pixel.width).toBeCloseTo(geo.cellWidth * 2 + 12);
    expect(pixel.height).toBe(60 * 2 + 12);
  });
});

describe("hitTestHandle", () => {
  const rect = {
    x: 100, y: 100, width: 200, height: 150,
    left: 100, top: 100, right: 300, bottom: 250,
  } as DOMRect;

  it("returns 'bottom-right' when pointer is near SE corner", () => {
    expect(hitTestHandle(297, 247, rect, "mouse")).toBe("bottom-right");
  });

  it("returns 'top-left' when pointer is near NW corner", () => {
    expect(hitTestHandle(103, 103, rect, "mouse")).toBe("top-left");
  });

  it("returns 'top' when pointer is near top edge centre", () => {
    expect(hitTestHandle(200, 103, rect, "mouse")).toBe("top");
  });

  it("returns 'right' when pointer is near right edge centre", () => {
    expect(hitTestHandle(297, 175, rect, "mouse")).toBe("right");
  });

  it("returns 'move' when pointer is in centre of item", () => {
    expect(hitTestHandle(200, 175, rect, "mouse")).toBe("move");
  });

  it("returns null when pointer is outside item", () => {
    expect(hitTestHandle(50, 50, rect, "mouse")).toBeNull();
  });

  it("uses larger inset for touch pointer type", () => {
    expect(hitTestHandle(115, 115, rect, "touch")).toBe("top-left");
    expect(hitTestHandle(115, 115, rect, "mouse")).toBe("move");
  });

  it("uses larger inset for pen pointer type", () => {
    expect(hitTestHandle(115, 115, rect, "pen")).toBe("top-left");
  });
});
