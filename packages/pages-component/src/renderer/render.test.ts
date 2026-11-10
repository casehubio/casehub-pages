import { describe, it, expect } from "vitest";
import type { Component, PermissionContext } from "../model/types.js";
import { renderComponent } from "./render.js";

describe("renderComponent — basic rendering", () => {
  it("unknown type produces activation container with all three data attributes", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "bar-chart",
      props: { dataset: "sales" },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.dataset.componentType).toBe("bar-chart");
    expect(el.dataset.componentId).toBeTruthy();
    expect(el.dataset.componentProps).toBe(JSON.stringify({ dataset: "sales" }));
  });

  it("clears target before rendering", () => {
    const target = document.createElement("div");
    target.innerHTML = "<p>old content</p>";
    const component: Component = { type: "html" };
    renderComponent(target, component);
    expect(target.querySelector("p")).toBeNull();
    expect(target.children).toHaveLength(1);
  });

  it("auto-generates deterministic IDs with :: separator", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "rows",
      slots: {
        default: [{ type: "html" }, { type: "html" }],
      },
    };
    renderComponent(target, component);
    const root = target.firstElementChild as HTMLElement;
    expect(root.dataset.componentId).toBe("root");
    const children = root.querySelectorAll("[data-slot='default'] > [data-component-id]");
    expect(children[0]!.getAttribute("data-component-id")).toBe("root::default::0");
    expect(children[1]!.getAttribute("data-component-id")).toBe("root::default::1");
  });

  it("uses explicit ID when provided", () => {
    const target = document.createElement("div");
    const component: Component = { type: "html", id: "my-widget" };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.dataset.componentId).toBe("my-widget");
  });
});

describe("renderComponent — Component.style", () => {
  it("style properties applied as inline CSS", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "html",
      style: { "background-color": "red", padding: "8px" },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe("red");
    expect(el.style.padding).toBe("8px");
  });

  it("author style overrides layout CSS on the same property", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "rows",
      style: { display: "block" },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    // rows sets display:flex, but author override should win
    expect(el.style.display).toBe("block");
  });
});

describe("renderComponent — layout types", () => {
  it("grid with items: correct CSS and grid placement on children", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 12 },
      grid: [
        {
          at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 },
          component: { type: "html" },
        },
        {
          at: { mode: "positioned", x: 6, y: 0, w: 6, h: 1 },
          component: { type: "html" },
        },
      ],
    };
    renderComponent(target, component);
    const gridEl = target.firstElementChild as HTMLElement;
    expect(gridEl.style.display).toBe("grid");
    expect(gridEl.style.gridTemplateColumns).toBe("repeat(12, 1fr)");
    const children = gridEl.querySelectorAll(":scope > [data-component-type]");
    expect(children).toHaveLength(2);
    const child0 = children[0] as HTMLElement;
    expect(child0.style.gridColumn).toBe("1 / span 6");
    expect(child0.style.gridRow).toBe("1 / span 1");
    const child1 = children[1] as HTMLElement;
    expect(child1.style.gridColumn).toBe("7 / span 6");
    expect(child1.style.gridRow).toBe("1 / span 1");
  });

  it("uses GridProps.columns instead of hardcoded 12", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 6 },
      grid: [
        { at: { mode: "positioned", x: 0, y: 0, w: 3, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(6, 1fr)");
  });

  it("adds grid-auto-flow: row when auto items present", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      grid: [
        { at: { mode: "auto", w: 4, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    expect(grid.style.gridAutoFlow).toBe("row");
  });

  it("omits grid-auto-flow when all items are positioned", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      grid: [
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    expect(grid.style.gridAutoFlow).toBe("");
  });

  it("renders positioned items sorted by (y, x) for WCAG DOM order", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      grid: [
        { at: { mode: "positioned", x: 6, y: 1, w: 6, h: 1 }, component: { type: "html", id: "bottom-right" } },
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html", id: "top-left" } },
        { at: { mode: "positioned", x: 6, y: 0, w: 6, h: 1 }, component: { type: "html", id: "top-right" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    const children = grid.querySelectorAll(":scope > [data-component-id]");
    expect(children[0]!.getAttribute("data-component-id")).toBe("top-left");
    expect(children[1]!.getAttribute("data-component-id")).toBe("top-right");
    expect(children[2]!.getAttribute("data-component-id")).toBe("bottom-right");
  });

  it("renders positioned items before auto items in mixed grids", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      grid: [
        { at: { mode: "auto", w: 6, h: 1 }, component: { type: "html", id: "auto-1" } },
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html", id: "pos-1" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    const children = grid.querySelectorAll(":scope > [data-component-id]");
    expect(children[0]!.getAttribute("data-component-id")).toBe("pos-1");
    expect(children[1]!.getAttribute("data-component-id")).toBe("auto-1");
  });

  it("generates auto IDs for auto-placed items", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      grid: [
        { at: { mode: "auto", w: 6, h: 1 }, component: { type: "html" } },
        { at: { mode: "auto", w: 6, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    const children = grid.querySelectorAll(":scope > [data-component-id]");
    expect(children[0]!.getAttribute("data-component-id")).toBe("root::auto::0");
    expect(children[1]!.getAttribute("data-component-id")).toBe("root::auto::1");
  });

  it("applies grid-auto-rows from rowHeight", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 12, rowHeight: 80 },
      grid: [
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    expect(grid.style.gridAutoRows).toBe("80px");
  });

  it("uses min-content when rowHeight absent", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 12 },
      grid: [
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    expect(grid.style.gridAutoRows).toBe("min-content");
  });

  it("sets overflow hidden on items when rowHeight present", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 12, rowHeight: 80 },
      grid: [
        { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html" } },
      ],
    };
    renderComponent(target, component);
    const grid = target.firstElementChild as HTMLElement;
    const item = grid.firstElementChild as HTMLElement;
    expect(item.style.overflow).toBe("hidden");
  });

  it("columns with col-N slots: correct distribution", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "columns",
      props: { distribution: [2, 1] },
      slots: {
        "col-0": [{ type: "html" }],
        "col-1": [{ type: "html" }],
      },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.style.display).toBe("grid");
    expect(el.style.gridTemplateColumns).toBe("2fr 1fr");
    const slots = el.querySelectorAll("[data-slot]");
    expect(slots).toHaveLength(2);
  });

  it("rows with flex column", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "rows",
      slots: { default: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.style.display).toBe("flex");
    expect(el.style.flexDirection).toBe("column");
  });

  it("sidebar with nav and main slots", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "sidebar",
      slots: {
        nav: [{ type: "html" }],
        main: [{ type: "html" }],
      },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.style.display).toBe("grid");
    expect(el.style.gridTemplateColumns).toBe("auto 1fr");
    expect(el.querySelector("[data-slot='nav']")).toBeTruthy();
    expect(el.querySelector("[data-slot='main']")).toBeTruthy();
  });

  it("panel with title header", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "panel",
      props: { title: "My Panel" },
      slots: { default: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    const titleEl = el.querySelector("[data-panel-title]") as HTMLElement;
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toBe("My Panel");
  });
});

describe("renderComponent — access control", () => {
  it("component with denied role not rendered", () => {
    const target = document.createElement("div");
    const permissions: PermissionContext = {
      hasRole: () => false,
      hasPermission: () => false,
    };
    const component: Component = {
      type: "html",
      access: { roles: ["admin"] },
    };
    renderComponent(target, component, { permissions });
    expect(target.children).toHaveLength(0);
  });

  it("denied parent skips entire subtree", () => {
    const target = document.createElement("div");
    const permissions: PermissionContext = {
      hasRole: () => false,
      hasPermission: () => false,
    };
    const component: Component = {
      type: "rows",
      access: { roles: ["admin"] },
      slots: {
        default: [{ type: "html" }, { type: "html" }],
      },
    };
    renderComponent(target, component, { permissions });
    expect(target.children).toHaveLength(0);
    expect(target.querySelectorAll("[data-component-type]")).toHaveLength(0);
  });

  it("no permissions provided defaults to ALLOW_ALL", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "html",
      access: { roles: ["admin"] },
    };
    renderComponent(target, component);
    expect(target.children).toHaveLength(1);
  });
});

describe("renderComponent — page handling", () => {
  it("page is an activation container but slot children render recursively", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "page",
      slots: {
        default: [{ type: "html" }, { type: "rows" }],
      },
    };
    renderComponent(target, component);
    const pageEl = target.firstElementChild as HTMLElement;
    expect(pageEl.dataset.componentType).toBe("page");
    // Slots render children recursively even for non-layout types
    const slotEl = pageEl.querySelector("[data-slot='default']");
    expect(slotEl).toBeTruthy();
    const children = slotEl!.querySelectorAll("[data-component-type]");
    expect(children).toHaveLength(2);
  });
});

describe("renderComponent — DOM attributes on layout types", () => {
  it("layout types carry all three data attributes", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 6 },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.dataset.componentType).toBe("grid");
    expect(el.dataset.componentId).toBeTruthy();
    expect(el.dataset.componentProps).toBe(JSON.stringify({ columns: 6 }));
  });
});

describe("renderComponent — items vs slots precedence", () => {
  it("when both present, items take precedence", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "grid",
      props: { columns: 12 },
      grid: [
        {
          at: { mode: "positioned", x: 0, y: 0, w: 12, h: 1 },
          component: { type: "html" },
        },
      ],
      slots: {
        default: [{ type: "html" }, { type: "html" }],
      },
    };
    renderComponent(target, component);
    const gridEl = target.firstElementChild as HTMLElement;
    // Items rendered — one child with grid placement
    const gridChildren = gridEl.querySelectorAll(":scope > [data-component-type]");
    expect(gridChildren).toHaveLength(1);
    // No slot containers
    expect(gridEl.querySelector("[data-slot]")).toBeNull();
  });
});

describe("renderComponent — onNode callback", () => {
  it("fires onNode for each component with element and component model", () => {
    const target = document.createElement("div");
    const calls: Array<{ type: string; id: string }> = [];
    const component: Component = {
      type: "rows",
      slots: {
        default: [
          { type: "bar-chart", props: { title: "Revenue" } },
          { type: "table", props: { title: "Sales" } },
        ],
      },
    };
    renderComponent(target, component, {
      onNode: (el, comp) => {
        calls.push({ type: comp.type, id: el.dataset.componentId! });
      },
    });
    expect(calls).toHaveLength(3); // rows + bar-chart + table
    expect(calls[0]!.type).toBe("rows");
    expect(calls[1]!.type).toBe("bar-chart");
    expect(calls[2]!.type).toBe("table");
  });

  it("element is connected to DOM when onNode fires", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    let connected = false;
    const component: Component = { type: "bar-chart" };
    renderComponent(target, component, {
      onNode: (el) => {
        connected = el.isConnected;
      },
    });
    expect(connected).toBe(true);
    document.body.removeChild(target);
  });

  it("children not yet rendered when onNode fires for parent", () => {
    const target = document.createElement("div");
    let childCount = -1;
    const component: Component = {
      type: "tabs",
      slots: { A: [{ type: "bar-chart" }], B: [{ type: "table" }] },
    };
    renderComponent(target, component, {
      onNode: (el, comp) => {
        if (comp.type === "tabs") {
          childCount = el.children.length;
        }
      },
    });
    expect(childCount).toBe(0);
  });
});

describe("renderComponent — lazy rendering for one-at-a-time containers", () => {
  it("tabs: only first slot children rendered, other slots empty", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "tabs",
      slots: {
        A: [{ type: "html" }, { type: "html" }],
        B: [{ type: "html" }],
        C: [{ type: "html" }],
      },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots).toHaveLength(3);
    // Slot A (active) has children
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(2);
    // Slots B and C are empty
    expect(slots[1]!.children).toHaveLength(0);
    expect(slots[2]!.children).toHaveLength(0);
  });

  it("pills: only first slot children rendered", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "pills",
      slots: { X: [{ type: "html" }], Y: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("sidebar: only first slot children rendered", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "sidebar",
      slots: { Nav: [{ type: "html" }], Main: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("carousel: only first slot children rendered", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "carousel",
      slots: { S1: [{ type: "html" }], S2: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > [data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("stack: only first slot children rendered", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "stack",
      slots: { L1: [{ type: "html" }], L2: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > [data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("tree: only first slot children rendered (lazy)", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "tree",
      slots: { A: [{ type: "html" }], B: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("menu: only first slot children rendered (lazy)", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "menu",
      slots: { A: [{ type: "html" }], B: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("tiles: only first slot children rendered (lazy)", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "tiles",
      slots: { A: [{ type: "html" }], B: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>(":scope > div[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.children).toHaveLength(0);
  });

  it("accordion: all slot children rendered (eager)", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "accordion",
      slots: { S1: [{ type: "html" }], S2: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const container = target.firstElementChild as HTMLElement;
    const slots = container.querySelectorAll<HTMLElement>("[data-slot]");
    expect(slots[0]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
    expect(slots[1]!.querySelectorAll("[data-component-type]")).toHaveLength(1);
  });

  it("onNode fires only for active slot children on initial render", () => {
    const target = document.createElement("div");
    const calls: string[] = [];
    const component: Component = {
      type: "tabs",
      slots: {
        Active: [{ type: "bar-chart" }],
        Hidden: [{ type: "table" }],
      },
    };
    renderComponent(target, component, {
      onNode: (_el, comp) => { calls.push(comp.type); },
    });
    expect(calls).toContain("tabs");
    expect(calls).toContain("bar-chart");
    expect(calls).not.toContain("table");
  });
});

describe("renderComponent — page padding", () => {
  it("page container gets default padding", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "page",
      props: { name: "main" },
      slots: { content: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.dataset.componentType).toBe("page");
    expect(el.style.padding).toBe("var(--pages-space-4, 16px)");
  });

  it("author style overrides page padding", () => {
    const target = document.createElement("div");
    const component: Component = {
      type: "page",
      props: { name: "main" },
      style: { padding: "0" },
      slots: { content: [{ type: "html" }] },
    };
    renderComponent(target, component);
    const el = target.firstElementChild as HTMLElement;
    expect(el.style.padding).toBe("0px");
  });
});

describe("deferred component type", () => {
  it("creates container but does not render children", () => {
    const child: Component = { type: "html", props: { content: "hello" } };
    const root: Component = {
      type: "deferred",
      slots: { default: [child] },
    };
    const target = document.createElement("div");
    renderComponent(target, root);

    const deferredEl = target.querySelector('[data-component-type="deferred"]');
    expect(deferredEl).toBeTruthy();
    const childEl = target.querySelector('[data-component-type="html"]');
    expect(childEl).toBeNull();
  });
});
