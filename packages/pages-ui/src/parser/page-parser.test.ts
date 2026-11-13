import { describe, it, expect } from "vitest";
import { parsePage } from "./page-parser.js";
import { getProps } from "@casehubio/pages-component";


describe("parsePage", () => {
  describe("basic structure", () => {
    it("parses minimal YAML with one component", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "Hello" }] }],
      });
      expect(root.type).toBe("page");
      expect(root.props!["name"]).toBe("root");
      expect(root.slots!["content"]).toBeDefined();
      expect(root.slots!["content"]!.length).toBe(1);
    });

    it("throws on missing pages", () => {
      expect(() => parsePage({})).toThrow("At least one page is required");
    });

    it("throws on empty pages array", () => {
      expect(() => parsePage({ pages: [] })).toThrow("At least one page is required");
    });

    it("throws on non-object input", () => {
      expect(() => parsePage(null)).toThrow("Invalid input");
      expect(() => parsePage("string")).toThrow("Invalid input");
      expect(() => parsePage(42)).toThrow("Invalid input");
    });

    it("accepts layoutTemplates as alias for pages", () => {
      const root = parsePage({
        layoutTemplates: [{ components: [{ html: "Hi" }] }],
      });
      expect(root.type).toBe("page");
      expect(root.slots!["content"]!.length).toBe(1);
    });

    it("root is frozen", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "Hello" }] }],
      });
      expect(Object.isFrozen(root)).toBe(true);
    });
  });

  describe("page names", () => {
    it("parses explicit page name", () => {
      const root = parsePage({
        pages: [{ name: "Overview", components: [{ html: "Hi" }] }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.props!["name"]).toBe("Overview");
    });

    it("auto-generates page names from 1-based index", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "A" }] }, { components: [{ html: "B" }] }],
      });
      expect(root.slots!["content"]![0]!.props!["name"]).toBe("Page 1");
      expect(root.slots!["content"]![1]!.props!["name"]).toBe("Page 2");
    });
  });

  describe("components shorthand → grid items", () => {
    it("desugars flat components list to full-width grid items", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "A" }, { html: "B" }] }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toBeDefined();
      expect(page.grid!.length).toBe(2);
      expect(page.grid![0]!.at).toEqual({ mode: "positioned", x: 0, y: 0, w: 12, h: 1 });
      expect(page.grid![1]!.at).toEqual({ mode: "positioned", x: 0, y: 1, w: 12, h: 1 });
    });

    it("desugars html shorthand to html component", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "<b>Bold</b>" }] }],
      });
      const page = root.slots!["content"]![0]!;
      const comp = page.grid![0]!.component;
      expect(comp!.type).toBe("html");
      expect(comp!.props!["content"]).toBe("<b>Bold</b>");
    });

    it("desugars displayer components", () => {
      const root = parsePage({
        pages: [
          {
            components: [{ displayer: { type: "BARCHART", lookup: { uuid: "sales" } } }],
          },
        ],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid![0]!.component!.type).toBe("bar-chart");
    });
  });

  describe("property substitution", () => {
    it("substitutes ${name} in component content", () => {
      const root = parsePage({
        properties: { name: "World" },
        pages: [{ components: [{ html: "Hello ${name}" }] }],
      });
      const page = root.slots!["content"]![0]!;
      const htmlComp = page.grid![0]!.component;
      expect(htmlComp!.props!["content"]).toBe("Hello World");
    });

    it("preserves properties on root", () => {
      const root = parsePage({
        properties: { greeting: "Hello" },
        pages: [{ components: [{ html: "${greeting}" }] }],
      });
      expect((root.props as Record<string, unknown>)["properties"]).toEqual({
        greeting: "Hello",
      });
    });

    it("does not include properties on root when none defined", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "Hi" }] }],
      });
      expect((root.props as Record<string, unknown>)["properties"]).toBeUndefined();
    });
  });

  describe("ID generation", () => {
    it("generates deterministic IDs for grid items", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "A" }, { html: "B" }] }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid![0]!.component!.id).toBeDefined();
      expect(page.grid![1]!.component!.id).toBeDefined();
      expect(page.grid![0]!.component!.id).not.toBe(page.grid![1]!.component!.id);
    });

    it("IDs include page index for uniqueness across pages", () => {
      const root = parsePage({
        pages: [
          { components: [{ html: "page0" }] },
          { components: [{ html: "page1" }] },
        ],
      });
      const page0 = root.slots!["content"]![0]!;
      const page1 = root.slots!["content"]![1]!;
      expect(page0.grid![0]!.component!.id).not.toBe(page1.grid![0]!.component!.id);
    });
  });

  describe("datasets and global settings", () => {
    it("parses datasets onto root props", () => {
      const root = parsePage({
        datasets: [{ uuid: "test", content: "[['a', 1]]" }],
        pages: [{ components: [{ html: "Hi" }] }],
      });
      expect((root.props as Record<string, unknown>)["datasets"]).toEqual([
        { uuid: "test", content: "[['a', 1]]" },
      ]);
    });

    it("parses global mode as lowercase settings", () => {
      const root = parsePage({
        global: { mode: "DARK" },
        pages: [{ components: [{ html: "Hi" }] }],
      });
      const settings = (root.props as Record<string, unknown>)["settings"] as Record<
        string,
        unknown
      >;
      expect(settings["mode"]).toBe("dark");
    });

    it("parses global allowUrlProperties", () => {
      const root = parsePage({
        global: { allowUrlProperties: "true" },
        pages: [{ components: [{ html: "Hi" }] }],
      });
      const settings = (root.props as Record<string, unknown>)["settings"] as Record<
        string,
        unknown
      >;
      expect(settings["allowUrlProperties"]).toBe(true);
    });

    it("parses global displayer as dataComponentDefaults", () => {
      const root = parsePage({
        global: {
          displayer: { chart: { resizable: true } },
        },
        pages: [{ components: [{ html: "Hi" }] }],
      });
      const settings = (root.props as Record<string, unknown>)["settings"] as Record<
        string,
        unknown
      >;
      expect(settings["dataComponentDefaults"]).toEqual({ chart: { resizable: true } });
    });

    it("parses global settings as dataComponentDefaults (alias)", () => {
      const root = parsePage({
        global: {
          settings: { table: { pageSize: 20 } },
        },
        pages: [{ components: [{ html: "Hi" }] }],
      });
      const settings = (root.props as Record<string, unknown>)["settings"] as Record<
        string,
        unknown
      >;
      expect(settings["dataComponentDefaults"]).toEqual({ table: { pageSize: 20 } });
    });

    it("parses global dataset as datasetDefaults", () => {
      const root = parsePage({
        global: {
          dataset: { cacheMaxRows: 1000 },
        },
        pages: [{ components: [{ html: "Hi" }] }],
      });
      const settings = (root.props as Record<string, unknown>)["settings"] as Record<
        string,
        unknown
      >;
      expect(settings["datasetDefaults"]).toEqual({ cacheMaxRows: 1000 });
    });
  });

  describe("page-level properties", () => {
    it("applies page-level properties as style on the page component", () => {
      const root = parsePage({
        pages: [
          {
            properties: { margin: "10px" },
            components: [{ html: "Hi" }],
          },
        ],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.style).toEqual({ margin: "10px" });
    });
  });

  describe("navigation resolution", () => {
    it("resolves navigation components with navGroupId", () => {
      const root = parsePage({
        pages: [
          {
            name: "Main",
            components: [
              { type: "TABS", properties: { navGroupId: "Group1", targetDivId: "div1" } },
              { div: "div1" },
            ],
          },
          { name: "SubPage1", components: [{ html: "content1" }] },
          { name: "SubPage2", components: [{ html: "content2" }] },
        ],
        navTree: {
          root_items: [
            {
              type: "GROUP",
              id: "Group1",
              children: [{ page: "SubPage1" }, { page: "SubPage2" }],
            },
          ],
        },
      });
      const mainPage = root.slots!["content"]![0]!;
      expect(mainPage).toBeDefined();
      // Nav component (tabs) keeps nav role, content goes to target location
      const navItem = mainPage.grid!.find((item) => item.component!.type === "tabs" && !item.component!.slots);
      expect(navItem).toBeDefined();
      // The slot-target is replaced with a tabs component containing page slots
      const contentItem = mainPage.grid!.find((item) => item.component!.type === "tabs" && item.component!.slots);
      expect(contentItem).toBeDefined();
      expect(contentItem!.component!.slots!["SubPage1"]).toBeDefined();
      expect(contentItem!.component!.slots!["SubPage2"]).toBeDefined();
    });

    it("removes slot-target components from grid items during resolution", () => {
      const root = parsePage({
        pages: [
          {
            name: "Main",
            components: [
              { type: "TABS", properties: { navGroupId: "G1" } },
              { div: "target_div" },
            ],
          },
          { name: "P1", components: [{ html: "hi" }] },
        ],
        navTree: {
          root_items: [{ type: "GROUP", id: "G1", children: [{ page: "P1" }] }],
        },
      });
      const mainPage = root.slots!["content"]![0]!;
      const slotTargets = mainPage.grid!.filter((item) => item.component!.type === "slot-target");
      expect(slotTargets.length).toBe(0);
    });
  });

  describe("nested grid components", () => {
    it("parses nested grid component with recursive items", () => {
      const root = parsePage({
        pages: [{
          items: [{
            placement: { x: 0, y: 0, w: 6, h: 4 },
            component: {
              type: "grid",
              items: [{
                placement: { x: 0, y: 0, w: 6, h: 1 },
                component: { type: "html", properties: { content: "nested" } },
              }],
            },
          }],
        }],
      });
      const page = root.slots!["content"]![0]!;
      const outer = page.grid![0]!;
      expect(outer.component!.type).toBe("grid");
      expect(outer.component!.grid).toHaveLength(1);
      expect(outer.component!.grid![0]!.component!.type).toBe("html");
    });

    it("preserves placement on nested items", () => {
      const root = parsePage({
        pages: [{
          items: [{
            placement: { x: 0, y: 0, w: 12, h: 4 },
            component: {
              type: "grid",
              items: [
                { placement: { x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
                { placement: { x: 6, y: 0, w: 6, h: 1 }, component: { type: "chart" } },
              ],
            },
          }],
        }],
      });
      const nested = root.slots!["content"]![0]!.grid![0]!.component!.grid!;
      expect(nested[0]!.at).toEqual({ mode: "positioned", x: 0, y: 0, w: 6, h: 1 });
      expect(nested[1]!.at).toEqual({ mode: "positioned", x: 6, y: 0, w: 6, h: 1 });
    });
  });

  describe("empty and edge cases", () => {
    it("handles page with no components or rows (empty items)", () => {
      const root = parsePage({
        pages: [{}],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toEqual([]);
    });

    it("handles multiple pages", () => {
      const root = parsePage({
        pages: [
          { name: "Page A", components: [{ html: "A" }] },
          { name: "Page B", components: [{ html: "B" }] },
          { name: "Page C", components: [{ html: "C" }] },
        ],
      });
      expect(root.slots!["content"]!.length).toBe(3);
    });
  });

  describe("global.dataset merging", () => {
    it("merges global.dataset into root datasets", () => {
      const root = parsePage({
        global: {
          dataset: { uuid: "global-ds", content: "[1,2,3]" },
        },
        pages: [{ components: [{ html: "test" }] }],
      });
      const pageProps = getProps(root, "page");
      const datasets = pageProps.datasets!;
      expect(datasets).toBeDefined();
      expect(datasets).toHaveLength(1);
      expect((datasets[0] as { uuid: string }).uuid).toBe("global-ds");
    });

    it("merges global.dataset alongside existing datasets", () => {
      const root = parsePage({
        global: {
          dataset: { uuid: "global-ds", content: "[1]" },
        },
        datasets: [{ uuid: "explicit-ds", content: "[2]" }],
        pages: [{ components: [{ html: "test" }] }],
      });
      const pageProps = getProps(root, "page");
      const datasets = pageProps.datasets!;
      expect(datasets).toHaveLength(2);
    });

    it("passes global displayer defaults to component desugaring", () => {
      const root = parsePage({
        global: {
          displayer: { chart: { resizable: true }, lookup: { uuid: "ds" } },
        },
        datasets: [{ uuid: "ds", content: '[[1,2]]' }],
        pages: [{ components: [{ displayer: { type: "BARCHART" } }] }],
      });
      const page = root.slots!["content"]![0]!;
      const chart = page.grid![0]!.component;
      expect(chart!.props?.["resizable"]).toBe(true);
      const chartProps = getProps(chart!, "bar-chart");
      expect(chartProps.lookup.dataSetId).toBe("ds");
    });
  });

  describe("page-ref and panel deduplication", () => {
    it("pages embedded via screen are excluded from top-level content", () => {
      const root = parsePage({
        pages: [
          { name: "index", components: [{ screen: "Cards" }] },
          { name: "Cards", components: [{ html: "card content" }] },
          { name: "Other", components: [{ html: "other" }] },
        ],
      });
      const pageNames = root.slots!["content"]!.map(p => getProps(p, "page").name);
      expect(pageNames).toContain("index");
      expect(pageNames).toContain("Other");
      expect(pageNames).not.toContain("Cards");
    });

    it("pages embedded via panel are excluded from top-level content", () => {
      const root = parsePage({
        pages: [
          { name: "index", components: [{ panel: "Charts" }] },
          { name: "Charts", components: [{ html: "charts" }] },
        ],
      });
      const pageNames = root.slots!["content"]!.map(p => getProps(p, "page").name);
      expect(pageNames).toContain("index");
      expect(pageNames).not.toContain("Charts");
    });

    it("only root page is top-level when navTree is present", () => {
      const root = parsePage({
        pages: [
          {
            name: "index",
            components: [
              { type: "TABS", properties: { navGroupId: "Main", targetDivId: "d1" } },
              { div: "d1" },
            ],
          },
          { name: "Charts", components: [{ html: "charts" }] },
          { name: "Carousel", components: [{ type: "CAROUSEL", properties: { navGroupId: "Main" } }] },
          { name: "Orphan", components: [{ html: "orphan content" }] },
        ],
        navTree: {
          root_items: [
            { type: "GROUP", id: "Main", children: [{ page: "Charts" }] },
          ],
        },
      });
      const pageNames = root.slots!["content"]!.map(p => getProps(p, "page").name);
      expect(pageNames).toEqual(["index"]);
    });

    it("panel reference resolves to page content with title", () => {
      const root = parsePage({
        pages: [
          { name: "index", components: [{ panel: "Charts" }] },
          { name: "Charts", components: [{ html: "charts content" }] },
        ],
      });
      const indexPage = root.slots!["content"]![0]!;
      const panelItem = indexPage.grid![0]!.component;
      expect(panelItem!.type).toBe("panel");
      expect(panelItem!.props?.["title"]).toBe("Charts");
    });
  });

  describe("yaml-core expansion", () => {
    it("passes through plain page YAML unchanged", () => {
      const root = parsePage({
        pages: [{ name: "test", components: [{ html: "Hello" }] }],
      });
      expect(root.slots!["content"]![0]!.props!["name"]).toBe("test");
    });

    it("resolves yaml-core variables before parsing", () => {
      const root = parsePage({
        variables: { app: { title: "My Dashboard" } },
        pages: [
          {
            name: "${app.title}",
            components: [{ title: "${app.title}" }],
          },
        ],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.props!["name"]).toBe("My Dashboard");
    });

    it("coexists with page-level properties substitution", () => {
      const root = parsePage({
        variables: { app: { env: "production" } },
        properties: { title: "Dashboard" },
        pages: [
          {
            name: "${title}",
            components: [{ html: "${app.env}" }],
          },
        ],
      });
      const page = root.slots!["content"]![0]!;
      // ${title} resolved by page properties (no dot separator)
      expect(page.props!["name"]).toBe("Dashboard");
      // ${app.env} resolved by yaml-core (dot-separated prefix)
      const comp = page.grid![0]!.component;
      expect(comp!.props!["content"]).toBe("production");
    });

    it("strips yaml-core keys from output", () => {
      const root = parsePage({
        variables: { app: { name: "test" } },
        pages: [{ name: "test", components: [{ html: "Hi" }] }],
      });
      // The root should not contain yaml-core keys
      expect(root.props!["variables"]).toBeUndefined();
    });
  });

  describe("items format", () => {
    it("parses positioned items with explicit placement", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 }, component: { type: "metric" } },
            { placement: { mode: "positioned", x: 6, y: 0, w: 6, h: 1 }, component: { type: "html" } },
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toHaveLength(2);
      expect(page.grid![0]!.at).toEqual({ mode: "positioned", x: 0, y: 0, w: 6, h: 2 });
      expect(page.grid![1]!.at).toEqual({ mode: "positioned", x: 6, y: 0, w: 6, h: 1 });
    });

    it("parses auto items with span only", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { mode: "auto", w: 4, h: 1 }, component: { type: "metric" } },
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toHaveLength(1);
      expect(page.grid![0]!.at).toEqual({ mode: "auto", w: 4, h: 1 });
    });

    it("parses mixed positioned and auto items", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 }, component: { type: "metric" } },
            { placement: { mode: "auto", w: 6, h: 1 }, component: { type: "html" } },
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toHaveLength(2);
      expect(page.grid![0]!.at.mode).toBe("positioned");
      expect(page.grid![1]!.at.mode).toBe("auto");
    });

    it("treats placement without mode as positioned (backward compat)", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid![0]!.at.mode).toBe("positioned");
    });

    it("items format takes priority over components format", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { mode: "auto", w: 12, h: 1 }, component: { type: "metric" } },
          ],
          components: [{ html: "ignored" }],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid).toHaveLength(1);
      expect(page.grid![0]!.at.mode).toBe("auto");
    });

    it("clamps w to 12 columns by default", () => {
      const root = parsePage({
        pages: [{
          items: [
            { placement: { mode: "auto", w: 15, h: 1 }, component: { type: "html" } },
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid![0]!.at.w).toBe(12);
    });
  });

  describe("existing formats produce mode: positioned", () => {
    it("components format adds mode: positioned", () => {
      const root = parsePage({
        pages: [{ components: [{ html: "Hello" }] }],
      });
      const page = root.slots!["content"]![0]!;
      expect(page.grid![0]!.at.mode).toBe("positioned");
    });

    it("type: columns desugar produces mode: positioned", () => {
      const root = parsePage({
        pages: [{
          components: [
            { type: "columns", columns: [
              { components: [{ html: "A" }] },
              { components: [{ html: "B" }] },
            ]},
          ],
        }],
      });
      const page = root.slots!["content"]![0]!;
      const gridItem = page.grid![0]!;
      const nestedGrid = gridItem.component;
      expect(nestedGrid!.type).toBe("grid");
      expect(nestedGrid!.grid![0]!.at.mode).toBe("positioned");
    });
  });
});
