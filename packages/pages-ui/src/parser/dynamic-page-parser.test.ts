import { describe, it, expect } from "vitest";
import { parseDynamicPage } from "./dynamic-page-parser.js";

describe("parseDynamicPage", () => {
  it("parses a single page with components", () => {
    const raw = {
      name: "test-page",
      components: [
        { type: "title", properties: { text: "Hello" } },
      ],
    };

    const result = parseDynamicPage(raw);

    expect(result.type).toBe("page");
    expect(result.props?.name).toBe("test-page");
    expect(result.items).toHaveLength(1);
    expect(result.items![0].component.type).toBe("title");
  });

  it("applies property substitution", () => {
    const raw = {
      name: "test-page",
      properties: { greeting: "World" },
      components: [
        { type: "title", properties: { text: "Hello ${greeting}" } },
      ],
    };

    const result = parseDynamicPage(raw);
    const titleProps = result.items![0].component.props as Record<string, unknown>;
    expect(titleProps.text).toBe("Hello World");
  });

  it("does NOT apply yaml-core expansion", () => {
    const raw = {
      name: "test-page",
      variables: { x: 1 },
      components: [
        { type: "title", properties: { text: "Test" } },
      ],
    };

    const result = parseDynamicPage(raw);
    expect(result.type).toBe("page");
  });

  it("parses rows layout", () => {
    const raw = {
      name: "dashboard",
      rows: [
        {
          columns: [
            { span: 6, components: [{ type: "title", properties: { text: "A" } }] },
            { span: 6, components: [{ type: "title", properties: { text: "B" } }] },
          ],
        },
      ],
    };

    const result = parseDynamicPage(raw);
    expect(result.type).toBe("page");
    expect(result.items!.length).toBeGreaterThanOrEqual(2);
  });

  it("passes global displayer defaults", () => {
    const raw = {
      name: "chart-page",
      components: [
        { type: "displayer", properties: { type: "BARCHART" } },
      ],
    };

    const globalDefaults = { width: "100%" };
    const result = parseDynamicPage(raw, globalDefaults);
    expect(result.type).toBe("page");
  });
});
