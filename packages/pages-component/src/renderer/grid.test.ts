import { describe, it, expect } from "vitest";
import { applyGridPlacement } from "./grid.js";

describe("applyGridPlacement", () => {
  it("applies positioned mode with explicit coordinates", () => {
    const el = document.createElement("div");
    applyGridPlacement(el, { mode: "positioned", x: 0, y: 0, w: 6, h: 2 });
    expect(el.style.gridColumn).toBe("1 / span 6");
    expect(el.style.gridRow).toBe("1 / span 2");
  });

  it("handles offset positions in positioned mode", () => {
    const el = document.createElement("div");
    applyGridPlacement(el, { mode: "positioned", x: 8, y: 3, w: 4, h: 1 });
    expect(el.style.gridColumn).toBe("9 / span 4");
    expect(el.style.gridRow).toBe("4 / span 1");
  });

  it("applies auto mode with span only — no position", () => {
    const el = document.createElement("div");
    applyGridPlacement(el, { mode: "auto", w: 4, h: 3 });
    expect(el.style.gridColumn).toBe("span 4");
    expect(el.style.gridRow).toBe("span 3");
  });
});
