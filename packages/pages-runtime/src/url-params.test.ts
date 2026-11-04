import { describe, it, expect } from "vitest";
import { extractUrlParams } from "./url-params.js";
import type { ParamDef } from "./url-params.js";

describe("extractUrlParams", () => {
  it("extracts matching params from URL search string", () => {
    const defs: ParamDef[] = [
      { name: "ticketId", type: "string", required: false },
      { name: "view", type: "string", required: false, default: "summary" },
    ];

    const result = extractUrlParams("?ticketId=123&view=detail&extra=ignored", defs);

    expect(result).toEqual({ ticketId: "123", view: "detail" });
  });

  it("applies defaults for missing params", () => {
    const defs: ParamDef[] = [
      { name: "view", type: "string", required: false, default: "summary" },
    ];

    const result = extractUrlParams("", defs);
    expect(result).toEqual({ view: "summary" });
  });

  it("passes through all params when no defs provided", () => {
    const result = extractUrlParams("?a=1&b=2");
    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("ignores undeclared params when defs are provided", () => {
    const defs: ParamDef[] = [
      { name: "known", type: "string", required: false },
    ];

    const result = extractUrlParams("?known=yes&unknown=no", defs);
    expect(result).toEqual({ known: "yes" });
  });
});
