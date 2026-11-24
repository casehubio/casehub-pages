import { describe, it, expect } from "vitest";
import { computeEffectiveWidth } from "./grid-fixed-width.js";

describe("computeEffectiveWidth", () => {
  it("returns 1 when fixedWidth fits in a single column", () => {
    expect(computeEffectiveWidth(80, 100, 12, 4)).toBe(1);
  });

  it("returns 2 when fixedWidth exceeds one column", () => {
    expect(computeEffectiveWidth(160, 100, 12, 4)).toBe(2);
  });

  it("accounts for inter-column gap in span calculation", () => {
    // 2 cols = 100+12+100 = 212px; fixedWidth=210 fits in 2
    expect(computeEffectiveWidth(210, 100, 12, 4)).toBe(2);
  });

  it("clamps to declared w as upper bound", () => {
    // needs ceil((500+12)/(100+12))=5 cols, but declaredW=3
    expect(computeEffectiveWidth(500, 100, 12, 3)).toBe(3);
  });

  it("returns 1 when fixedWidth equals cellWidth exactly", () => {
    expect(computeEffectiveWidth(100, 100, 12, 4)).toBe(1);
  });

  it("returns 1 when fixedWidth is 0", () => {
    expect(computeEffectiveWidth(0, 100, 12, 4)).toBe(1);
  });

  it("clamps to 1 minimum", () => {
    expect(computeEffectiveWidth(10, 200, 12, 4)).toBe(1);
  });

  it("clamps to declaredW when cellWidth is very small", () => {
    // ceil((160+12)/(5+12))=11, but declaredW=4
    expect(computeEffectiveWidth(160, 5, 12, 4)).toBe(4);
  });
});
