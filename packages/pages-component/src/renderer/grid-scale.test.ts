import { describe, it, expect } from "vitest";
import { scaleWidth } from "./grid-scale.js";

describe("scaleWidth", () => {
  it("scales proportionally: 6 in 12-col → 3 in 6-col", () => {
    expect(scaleWidth(6, 12, 6)).toBe(3);
  });

  it("rounds: 5 in 12-col → 3 in 6-col (2.5 rounds to 3)", () => {
    expect(scaleWidth(5, 12, 6)).toBe(3);
  });

  it("scales up: 1 in 6-col → 2 in 12-col", () => {
    expect(scaleWidth(1, 6, 12)).toBe(2);
  });

  it("clamps minimum to 1: 1 in 12-col → 1 in 6-col (0.5 clamps to 1)", () => {
    expect(scaleWidth(1, 12, 6)).toBe(1);
  });

  it("clamps maximum to targetColumns", () => {
    expect(scaleWidth(12, 12, 6)).toBe(6);
  });

  it("same column count returns same width", () => {
    expect(scaleWidth(4, 12, 12)).toBe(4);
  });
});
