import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  hasTemplateVars,
  allTemplateVarsResolved,
} from "./template-parser.js";
import type { RuntimeContext } from "./types.js";

describe("template-parser", () => {
  describe("resolveTemplate", () => {
    it("returns plain text unchanged", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("plain text", ctx, "none")).toBe("plain text");
    });

    it("resolves basic param interpolation", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: { name: "Alice" },
      };
      expect(resolveTemplate("Hello #{params.name}", ctx, "none")).toBe(
        "Hello Alice"
      );
    });

    it("resolves filter first element", () => {
      const ctx: RuntimeContext = {
        filter: { ward: ["ICU", "CCU"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.ward}", ctx, "none")).toBe("ICU");
    });

    it("resolves empty filter to empty string", () => {
      const ctx: RuntimeContext = {
        filter: { ward: [] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.ward}", ctx, "none")).toBe("");
    });

    it("resolves nested dataset path", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {
          patients: {
            rowCount: 10,
            columns: ["name"],
            first: { name: "John Doe", age: 45, ward: null },
          },
        },
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(
        resolveTemplate("#{datasets.patients.first.name}", ctx, "none")
      ).toBe("John Doe");
    });

    it("resolves dataset rowCount", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {
          patients: {
            rowCount: 25,
            columns: [],
          },
        },
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{datasets.patients.rowCount}", ctx, "none")).toBe(
        "25"
      );
    });

    it("resolves missing path to empty string", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.missing}", ctx, "none")).toBe("");
    });

    it("resolves multiple templates", () => {
      const ctx: RuntimeContext = {
        filter: { a: ["A"], b: ["B"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.a} and #{filter.b}", ctx, "none")).toBe(
        "A and B"
      );
    });

    it("escapes HTML entities in html mode", () => {
      const ctx: RuntimeContext = {
        filter: { name: ["<script>alert('XSS')</script>"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.name}", ctx, "html")).toBe(
        "&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;"
      );
    });

    it("escapes markdown then HTML in markdown mode", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: { text: "*bold* <tag>" },
      };
      expect(resolveTemplate("#{params.text}", ctx, "markdown")).toBe(
        "\\*bold\\* &lt;tag&gt;"
      );
    });

    it("escapes URL components in url mode", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: { query: "hello world" },
      };
      expect(resolveTemplate("#{params.query}", ctx, "url")).toBe(
        "hello%20world"
      );
    });

    it("passes through raw value in none mode", () => {
      const ctx: RuntimeContext = {
        filter: { html: ["<b>test</b>"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{filter.html}", ctx, "none")).toBe(
        "<b>test</b>"
      );
    });

    it("resolves page properties", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "Dashboard", path: "/dashboards/icu" },
        params: {},
      };
      expect(resolveTemplate("#{page.name}", ctx, "none")).toBe("Dashboard");
      expect(resolveTemplate("#{page.path}", ctx, "none")).toBe(
        "/dashboards/icu"
      );
    });

    it("resolves row properties when present", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
        row: { status: "Critical", score: 95 },
      };
      expect(resolveTemplate("#{row.status}", ctx, "none")).toBe("Critical");
      expect(resolveTemplate("#{row.score}", ctx, "none")).toBe("95");
    });

    it("handles null values in data", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {
          data: {
            rowCount: 1,
            columns: ["value"],
            first: { value: null },
          },
        },
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(resolveTemplate("#{datasets.data.first.value}", ctx, "none")).toBe(
        ""
      );
    });
  });

  describe("hasTemplateVars", () => {
    it("returns true for strings with template vars", () => {
      expect(hasTemplateVars("Hello #{name}")).toBe(true);
      expect(hasTemplateVars("#{a} and #{b}")).toBe(true);
    });

    it("returns false for strings without template vars", () => {
      expect(hasTemplateVars("plain text")).toBe(false);
      expect(hasTemplateVars("")).toBe(false);
      expect(hasTemplateVars("# not a template")).toBe(false);
    });
  });

  describe("allTemplateVarsResolved", () => {
    it("returns true when all vars resolve to non-empty values", () => {
      const ctx: RuntimeContext = {
        filter: { a: ["A"], b: ["B"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(allTemplateVarsResolved("#{filter.a} and #{filter.b}", ctx)).toBe(
        true
      );
    });

    it("returns false when any var resolves to empty", () => {
      const ctx: RuntimeContext = {
        filter: { a: ["A"], b: [] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(allTemplateVarsResolved("#{filter.a} and #{filter.b}", ctx)).toBe(
        false
      );
    });

    it("returns false when any var is missing", () => {
      const ctx: RuntimeContext = {
        filter: { a: ["A"] },
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(allTemplateVarsResolved("#{filter.a} and #{filter.b}", ctx)).toBe(
        false
      );
    });

    it("returns true for strings with no template vars", () => {
      const ctx: RuntimeContext = {
        filter: {},
        datasets: {},
        page: { name: "test", path: "/test" },
        params: {},
      };
      expect(allTemplateVarsResolved("plain text", ctx)).toBe(true);
    });
  });
});
