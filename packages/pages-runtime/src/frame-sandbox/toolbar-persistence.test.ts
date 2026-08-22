import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createContainer } from "./container.js";
import type { Entry, Layout } from "./types.js";

function stubFactory(entry: Entry) {
  const el = document.createElement("div");
  el.textContent = entry.label;
  el.setAttribute("data-stub", entry.key);
  return { element: el };
}

describe("Container toolbar and tab strip integration", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("toolbar is present after mount", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    expect(host.querySelector("[data-container-toolbar]")).not.toBeNull();
  });

  it("toolbar survives tab activation via simulated click", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    const btn = host.querySelector('[data-tab-key="b"]') as HTMLElement;
    btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup"));
    expect(host.querySelector("[data-container-toolbar]")).not.toBeNull();
  });

  it("addEntry inserts tab before toolbar-actions in strip", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    const strip = host.querySelector("[data-tab-strip]") as HTMLElement;
    const actions = document.createElement("span");
    actions.setAttribute("data-toolbar-actions", "");
    strip.appendChild(actions);

    c.addEntry({ key: "b", label: "B" });

    const children = [...strip.children];
    const bIdx = children.findIndex(el => el.getAttribute("data-tab-key") === "b");
    const actIdx = children.findIndex(el => el.hasAttribute("data-toolbar-actions"));
    expect(bIdx).toBeLessThan(actIdx);
  });

  it("multiple addEntry calls keep all tabs before actions", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    const strip = host.querySelector("[data-tab-strip]") as HTMLElement;
    const actions = document.createElement("span");
    actions.setAttribute("data-toolbar-actions", "");
    strip.appendChild(actions);

    c.addEntry({ key: "b", label: "B" });
    c.addEntry({ key: "c", label: "C" });
    c.addEntry({ key: "d", label: "D" });

    const children = [...strip.children];
    const actIdx = children.findIndex(el => el.hasAttribute("data-toolbar-actions"));
    const tabKeys = children.slice(0, actIdx).map(el => el.getAttribute("data-tab-key"));
    expect(tabKeys).toEqual(["a", "b", "c", "d"]);
    expect(actIdx).toBe(4);
  });

  it("onAdd callback fires when + is clicked on container toolbar", () => {
    let addFired = false;
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
      onAdd: () => { addFired = true; },
    });
    c.mount(host);
    const addBtn = host.querySelector("[data-toolbar-add]") as HTMLElement;
    addBtn.click();
    expect(addFired).toBe(true);
  });

  it("onLayoutChange fires when layout cycles via setLayout", () => {
    let changedTo: Layout | null = null;
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
      onLayoutChange: (type) => { changedTo = type; },
    });
    c.mount(host);
    c.setLayout("accordion");
    expect(changedTo).toBe("accordion");
  });

  it("setLayout to accordion replaces tab strip with accordion sections", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    expect(host.querySelector("[data-tab-strip]")).not.toBeNull();

    c.setLayout("accordion");

    expect(host.querySelector("[data-tab-strip]")).toBeNull();
    expect(host.querySelectorAll("[data-section-key]").length).toBe(2);
  });

  it("setLayout accordion→tabbed round-trip preserves content DOM identity", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
      layout: "tabbed",
      contentFactory: stubFactory,
    });
    c.mount(host);
    const contentBefore = host.querySelector('[data-stub="a"]');
    expect(contentBefore).not.toBeNull();

    c.setLayout("accordion");
    c.setLayout("tabbed");

    const contentAfter = host.querySelector('[data-stub="a"]');
    expect(contentAfter).toBe(contentBefore);
  });
});

describe("Container + button adds child for current layout", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("+ in tabbed mode adds a tab", () => {
    let addedKey: string | null = null;
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
      onAdd: () => {
        const key = `new-${String(Date.now())}`;
        addedKey = key;
        c.addEntry({ key, label: "New" });
      },
    });
    c.mount(host);

    const addBtn = host.querySelector("[data-toolbar-add]") as HTMLElement;
    addBtn.click();

    expect(addedKey).not.toBeNull();
    const tabs = host.querySelectorAll("[data-tab-key]");
    expect(tabs.length).toBe(2);
    expect(tabs[1]!.getAttribute("data-tab-key")).toBe(addedKey);
  });

  it("+ in accordion mode adds a section, not a tab", () => {
    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: stubFactory,
      onAdd: () => {
        c.addEntry({ key: `new-${String(Date.now())}`, label: "New Section" });
      },
    });
    c.mount(host);

    c.setLayout("accordion");

    const sectionsBefore = host.querySelectorAll("[data-section-key]").length;
    const addBtn = host.querySelector("[data-toolbar-add]") as HTMLElement;
    addBtn.click();

    const sectionsAfter = host.querySelectorAll("[data-section-key]").length;
    expect(sectionsAfter).toBe(sectionsBefore + 1);
    expect(host.querySelector("[data-tab-strip]")).toBeNull();
  });

  it("content factory is called for new entries in any layout mode", () => {
    const factoryCalls: string[] = [];
    const trackingFactory = (entry: Entry) => {
      factoryCalls.push(entry.key);
      return stubFactory(entry);
    };

    const c = createContainer({
      entries: [{ key: "a", label: "A" }],
      layout: "tabbed",
      contentFactory: trackingFactory,
      onAdd: () => {
        c.addEntry({ key: "tab-new", label: "New" });
      },
    });
    c.mount(host);

    factoryCalls.length = 0;
    c.setLayout("accordion");

    const addBtn = host.querySelector("[data-toolbar-add]") as HTMLElement;
    addBtn.click();

    expect(factoryCalls).toContain("tab-new");
  });
});
