import { describe, it, expect } from "vitest";
import * as dsl from "./index.js";
import * as root from "../index.js";

describe("dsl public exports", () => {
  it("exports the rows() and columns() layout helpers", () => {
    expect(typeof dsl.rows).toBe("function");
    expect(typeof dsl.columns).toBe("function");
  });

  it("re-exports rows() and columns() from the package root", () => {
    expect(root.rows).toBe(dsl.rows);
    expect(root.columns).toBe(dsl.columns);
  });

  it("rows() stacks children vertically in a panel", () => {
    const a = dsl.html("a");
    const b = dsl.html("b");

    const result = dsl.rows(a, b);

    expect(result.type).toBe("panel");
    expect(result.style).toEqual({ display: "flex", "flex-direction": "column" });
    expect(result.slots).toEqual({ default: [a, b] });
  });

  it("columns() lays slot contents out by distribution", () => {
    const left = [dsl.html("left")];
    const right = [dsl.html("right")];

    const result = dsl.columns([6, 6], left, right);

    expect(result.type).toBe("panel");
    expect(result.style?.["grid-template-columns"]).toBe("6fr 6fr");
    expect(result.slots).toEqual({ "col-0": left, "col-1": right });
  });
});
