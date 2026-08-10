import { describe, it, expect } from "vitest";
import { clampPosition, nextFramePosition } from "./frame-boundaries.js";

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
