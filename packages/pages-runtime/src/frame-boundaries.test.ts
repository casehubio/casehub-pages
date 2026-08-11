import { describe, it, expect } from "vitest";
import { clampPosition, nextFramePosition, snapToZone, zoneToRect } from "./frame-boundaries.js";

describe("clampPosition", () => {
  it("clamps negative to zero", () => {
    const pos = clampPosition({ x: -50, y: -20 }, { width: 400, height: 300 }, { width: 1200, height: 800 });
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it("clamps right/bottom overflow", () => {
    const pos = clampPosition({ x: 1000, y: 700 }, { width: 400, height: 300 }, { width: 1200, height: 800 });
    expect(pos).toEqual({ x: 800, y: 500 });
  });

  it("passes through valid positions", () => {
    const pos = clampPosition({ x: 100, y: 100 }, { width: 400, height: 300 }, { width: 1200, height: 800 });
    expect(pos).toEqual({ x: 100, y: 100 });
  });

  it("handles frame larger than container", () => {
    const pos = clampPosition({ x: 100, y: 100 }, { width: 1400, height: 900 }, { width: 1200, height: 800 });
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

describe("nextFramePosition", () => {
  it("centers first frame", () => {
    const pos = nextFramePosition({ width: 1200, height: 800 }, { width: 400, height: 300 }, []);
    expect(pos).toEqual({ x: 400, y: 250 });
  });

  it("offsets subsequent frames", () => {
    const existing = [{ x: 400, y: 250 }];
    const pos = nextFramePosition({ width: 1200, height: 800 }, { width: 400, height: 300 }, existing);
    expect(pos.x).not.toBe(400);
    expect(pos.y).not.toBe(250);
  });

  it("avoids collision with existing positions", () => {
    const existing = [{ x: 400, y: 250 }, { x: 430, y: 280 }];
    const pos = nextFramePosition({ width: 1200, height: 800 }, { width: 400, height: 300 }, existing);
    const collides = existing.some(e => Math.abs(e.x - pos.x) < 10 && Math.abs(e.y - pos.y) < 10);
    expect(collides).toBe(false);
  });

  it("clamps to container bounds", () => {
    const existing = [{ x: 750, y: 450 }];
    const pos = nextFramePosition({ width: 1200, height: 800 }, { width: 400, height: 300 }, existing);
    expect(pos.x).toBeLessThanOrEqual(800);
    expect(pos.y).toBeLessThanOrEqual(500);
  });
});

describe("snapToZone", () => {
  const container = { width: 1000, height: 800 };

  it("returns null when far from edges", () => {
    expect(snapToZone({ x: 500, y: 400 }, container)).toBeNull();
  });

  it("detects left edge", () => {
    expect(snapToZone({ x: 10, y: 400 }, container)).toBe("left");
  });

  it("detects right edge", () => {
    expect(snapToZone({ x: 990, y: 400 }, container)).toBe("right");
  });

  it("detects top edge", () => {
    expect(snapToZone({ x: 500, y: 10 }, container)).toBe("top");
  });

  it("detects bottom edge", () => {
    expect(snapToZone({ x: 500, y: 790 }, container)).toBe("bottom");
  });

  it("detects top-left corner (corner priority over edge)", () => {
    expect(snapToZone({ x: 10, y: 10 }, container)).toBe("top-left");
  });

  it("detects top-right corner", () => {
    expect(snapToZone({ x: 990, y: 10 }, container)).toBe("top-right");
  });

  it("detects bottom-left corner", () => {
    expect(snapToZone({ x: 10, y: 790 }, container)).toBe("bottom-left");
  });

  it("detects bottom-right corner", () => {
    expect(snapToZone({ x: 990, y: 790 }, container)).toBe("bottom-right");
  });

  it("respects custom threshold", () => {
    expect(snapToZone({ x: 50, y: 400 }, container, 20)).toBeNull();
    expect(snapToZone({ x: 10, y: 400 }, container, 20)).toBe("left");
  });
});

describe("zoneToRect", () => {
  const container = { width: 1000, height: 800 };

  it("computes left half", () => {
    const r = zoneToRect("left", container);
    expect(r.position).toEqual({ x: 0, y: 0 });
    expect(r.size).toEqual({ width: 496, height: 800 });
  });

  it("computes right half", () => {
    const r = zoneToRect("right", container);
    expect(r.position).toEqual({ x: 504, y: 0 });
    expect(r.size).toEqual({ width: 496, height: 800 });
  });

  it("computes top half", () => {
    const r = zoneToRect("top", container);
    expect(r.position).toEqual({ x: 0, y: 0 });
    expect(r.size).toEqual({ width: 1000, height: 396 });
  });

  it("computes bottom half", () => {
    const r = zoneToRect("bottom", container);
    expect(r.position).toEqual({ x: 0, y: 404 });
    expect(r.size).toEqual({ width: 1000, height: 396 });
  });

  it("computes full", () => {
    const r = zoneToRect("full", container);
    expect(r.position).toEqual({ x: 0, y: 0 });
    expect(r.size).toEqual({ width: 1000, height: 800 });
  });

  it("computes top-left quarter", () => {
    const r = zoneToRect("top-left", container);
    expect(r.position).toEqual({ x: 0, y: 0 });
    expect(r.size).toEqual({ width: 496, height: 396 });
  });

  it("computes bottom-right quarter", () => {
    const r = zoneToRect("bottom-right", container);
    expect(r.position).toEqual({ x: 504, y: 404 });
    expect(r.size).toEqual({ width: 496, height: 396 });
  });

  it("respects custom gap", () => {
    const r = zoneToRect("left", container, 16);
    expect(r.size).toEqual({ width: 492, height: 800 });
  });
});
