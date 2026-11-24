// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachGridEditController } from "./grid-edit-controller.js";
import type { GridItem } from "../model/types.js";

function makeItems(): GridItem[] {
  return [
    { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 }, component: { type: "html", id: "a" } },
    { at: { mode: "positioned", x: 6, y: 0, w: 6, h: 2 }, component: { type: "html", id: "b" } },
  ];
}

function makeItemsWithEmpty(): GridItem[] {
  return [
    { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 2 }, component: { type: "html", id: "a" } },
    { at: { mode: "positioned", x: 6, y: 0, w: 6, h: 2 } },
    { at: { mode: "positioned", x: 0, y: 2, w: 12, h: 1 }, component: { type: "html", id: "c" } },
  ];
}

function setupGrid(items: GridItem[]): HTMLElement {
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(12, 1fr)";
  document.body.appendChild(grid);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const el = document.createElement("div");
    el.dataset.itemId = String(i);
    if (item.component?.id) {
      el.dataset.componentId = item.component.id;
    }
    if (item.at.mode === "positioned") {
      el.style.gridColumn = `${item.at.x + 1} / span ${item.at.w}`;
      el.style.gridRow = `${item.at.y + 1} / span ${item.at.h}`;
    }
    const content = document.createElement("div");
    content.textContent = "content";
    el.appendChild(content);
    grid.appendChild(el);
  }
  return grid;
}

describe("GridEditController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-grid-editing-active");
  });

  it("starts active for positioned items (enterPassive runs synchronously)", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    expect(ctrl.active).toBe(true);
    ctrl.dispose();
  });

  it("has data-grid-editing attribute when grid has positioned items", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    expect(grid.hasAttribute("data-grid-editing")).toBe(true);
    ctrl.dispose();
  });

  it("does not create edit button when grid has no positioned items", () => {
    const items: GridItem[] = [
      { at: { mode: "auto", w: 6, h: 1 }, component: { type: "html", id: "c" } },
    ];
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    expect(grid.querySelector("[data-grid-edit-button]")).toBeNull();
    ctrl.dispose();
  });

  it("has mode property defaulting to content (passive)", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    expect(ctrl.mode).toBe("content");
    ctrl.dispose();
  });

  it("enter sets data-grid-editing and data-grid-editing-active on body", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    expect(grid.hasAttribute("data-grid-editing")).toBe(true);
    expect(document.body.hasAttribute("data-grid-editing-active")).toBe(true);
    expect(ctrl.active).toBe(true);
    ctrl.dispose();
  });

  it("enter sets position: relative on grid element", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    expect(grid.style.position).toBe("relative");
    ctrl.dispose();
  });

  it("enter creates grid overlay", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    expect(grid.querySelector("[data-grid-overlay]")).not.toBeNull();
    ctrl.dispose();
  });

  it("enter creates mode toggle", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    expect(grid.querySelector("[data-mode-toggle]")).not.toBeNull();
    ctrl.dispose();
  });

  it("enter sets pointer-events none on item content", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    const itemEl = grid.querySelector("[data-item-id='0']") as HTMLElement;
    const content = itemEl.firstElementChild as HTMLElement;
    expect(content.style.pointerEvents).toBe("none");
    ctrl.dispose();
  });

  it("exit removes attributes and restores state", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.exit();
    expect(grid.hasAttribute("data-grid-editing")).toBe(false);
    expect(document.body.hasAttribute("data-grid-editing-active")).toBe(false);
    expect(ctrl.active).toBe(false);
    ctrl.dispose();
  });

  it("exit restores position to passive state (relative)", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.exit();
    expect(grid.style.position).toBe("relative");
    ctrl.dispose();
  });

  it("exit removes grid overlay and mode toggle", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.exit();
    expect(grid.querySelector("[data-grid-overlay]")).toBeNull();
    expect(grid.querySelector("[data-mode-toggle]")).toBeNull();
    ctrl.dispose();
  });

  it("exit restores pointer-events on item content", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.exit();
    const itemEl = grid.querySelector("[data-item-id='0']") as HTMLElement;
    const content = itemEl.firstElementChild as HTMLElement;
    expect(content.style.pointerEvents).toBe("");
    ctrl.dispose();
  });

  it("multiple controllers can be active simultaneously", () => {
    const itemsA = makeItems();
    const gridA = setupGrid(itemsA);
    const ctrlA = attachGridEditController(gridA, itemsA, 12, 60);
    const itemsB: GridItem[] = [
      { at: { mode: "positioned", x: 0, y: 0, w: 12, h: 1 }, component: { type: "html", id: "d" } },
    ];
    const gridB = setupGrid(itemsB);
    const ctrlB = attachGridEditController(gridB, itemsB, 12, 60);
    ctrlA.enter();
    expect(ctrlA.active).toBe(true);
    ctrlB.enter();
    expect(ctrlA.active).toBe(true);
    expect(ctrlB.active).toBe(true);
    ctrlA.dispose();
    ctrlB.dispose();
  });

  it("escape in edit mode (no drag) exits edit mode", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(ctrl.active).toBe(false);
    ctrl.dispose();
  });

  it("dispose removes all DOM artifacts", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.dispose();
    expect(grid.hasAttribute("data-grid-editing")).toBe(false);
    expect(grid.querySelector("[data-grid-overlay]")).toBeNull();
    expect(grid.querySelector("[data-grid-edit-button]")).toBeNull();
    expect(grid.querySelector("[data-mode-toggle]")).toBeNull();
    expect(ctrl.active).toBe(false);
  });

  it("disconnect observer auto-disposes when grid is removed from DOM", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    grid.remove();
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(ctrl.active).toBe(false);
        resolve();
      }, 0);
    });
  });

  it("handles items with empty containers (no component)", () => {
    const items = makeItemsWithEmpty();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    expect(ctrl.active).toBe(true);
    const emptyEl = grid.querySelector("[data-item-id='1']") as HTMLElement;
    expect(emptyEl).not.toBeNull();
    ctrl.dispose();
  });

  it("exposes correct API surface", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    expect(typeof ctrl.enter).toBe("function");
    expect(typeof ctrl.exit).toBe("function");
    expect(typeof ctrl.dispose).toBe("function");
    expect(ctrl.gridEl).toBe(grid);
    expect(ctrl.items).toBe(items);
    expect(ctrl.columns).toBe(12);
    expect(ctrl.mode).toBe("content");
    ctrl.dispose();
  });

  it("nested controller stopPropagation prevents parent pointerdown", () => {
    const root = document.createElement("div");
    root.style.display = "grid";
    root.style.gridTemplateColumns = "repeat(12, 1fr)";
    document.body.appendChild(root);
    const rootItem = document.createElement("div");
    rootItem.dataset.itemId = "0";
    root.appendChild(rootItem);

    const nested = document.createElement("div");
    nested.style.display = "grid";
    nested.style.gridTemplateColumns = "repeat(6, 1fr)";
    rootItem.appendChild(nested);
    const nestedItem = document.createElement("div");
    nestedItem.dataset.itemId = "0";
    nested.appendChild(nestedItem);

    const rootItems: GridItem[] = [
      { at: { mode: "positioned", x: 0, y: 0, w: 12, h: 2 }, component: { type: "html", id: "r0" } },
    ];
    const nestedItems: GridItem[] = [
      { at: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "html", id: "n0" } },
    ];
    vi.spyOn(nestedItem, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 60, 60),
    );
    const rootCtrl = attachGridEditController(root, rootItems, 12, 60);
    const nestedCtrl = attachGridEditController(nested, nestedItems, 6, 60);

    const parentSpy = vi.fn();
    root.addEventListener("pointerdown", parentSpy);

    const pe = new Event("pointerdown", { bubbles: true }) as any;
    pe.clientX = 10;
    pe.clientY = 10;
    nested.dispatchEvent(pe);

    expect(parentSpy).not.toHaveBeenCalled();

    rootCtrl.dispose();
    nestedCtrl.dispose();
  });

  describe("cross-grid API", () => {
    it("releaseItem hides the element", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      ctrl.releaseItem(0);
      const el = grid.querySelector('[data-item-id="0"]') as HTMLElement;
      expect(el.style.display).toBe("none");
      ctrl.dispose();
    });

    it("acceptForeignItem shows a placeholder", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      ctrl.acceptForeignItem(
        { at: { mode: "positioned", x: 0, y: 4, w: 6, h: 1 }, component: { type: "html" } },
        { mode: "positioned", x: 0, y: 4, w: 6, h: 1 },
      );
      const placeholder = grid.querySelector("[data-grid-placeholder]");
      expect(placeholder).not.toBeNull();
      ctrl.dispose();
    });

    it("clearForeignItem removes the placeholder", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      ctrl.acceptForeignItem(
        { at: { mode: "positioned", x: 0, y: 4, w: 6, h: 1 }, component: { type: "html" } },
        { mode: "positioned", x: 0, y: 4, w: 6, h: 1 },
      );
      ctrl.clearForeignItem();
      const placeholder = grid.querySelector("[data-grid-placeholder]");
      expect(placeholder).toBeNull();
      ctrl.dispose();
    });
  });

  it("pages-grid-select creates handle bar on the targeted item", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    grid.dispatchEvent(new CustomEvent("pages-grid-select", { detail: { itemId: "0" } }));
    const bar = grid.querySelector("[data-item-id='0'] [data-drag-handle]");
    expect(bar).not.toBeNull();
    ctrl.dispose();
  });

  describe("hover bar action buttons", () => {
    function selectItem(grid: HTMLElement, itemId: string): void {
      grid.dispatchEvent(new CustomEvent("pages-grid-select", { detail: { itemId } }));
    }

    function clickAction(grid: HTMLElement, itemId: string, title: string): void {
      const bar = grid.querySelector(`[data-item-id='${itemId}'] [data-drag-handle]`);
      const btn = bar?.querySelector(`button[title='${title}']`) as HTMLElement | null;
      btn?.click();
    }

    it("split-h dispatches pages-grid-edit with type split and direction horizontal", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const events: CustomEvent[] = [];
      grid.addEventListener("pages-grid-edit", (e) => events.push(e as CustomEvent));
      clickAction(grid, "0", "Split horizontally");

      expect(events).toHaveLength(1);
      expect(events[0]!.detail).toEqual({ type: "split", targetIndex: 0, direction: "horizontal" });
      ctrl.dispose();
    });

    it("split-v dispatches pages-grid-edit with type split and direction vertical", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "1");

      const events: CustomEvent[] = [];
      grid.addEventListener("pages-grid-edit", (e) => events.push(e as CustomEvent));
      clickAction(grid, "1", "Split vertically");

      expect(events).toHaveLength(1);
      expect(events[0]!.detail).toEqual({ type: "split", targetIndex: 1, direction: "vertical" });
      ctrl.dispose();
    });

    it("delete dispatches pages-grid-edit with type remove", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const events: CustomEvent[] = [];
      grid.addEventListener("pages-grid-edit", (e) => events.push(e as CustomEvent));
      clickAction(grid, "0", "Delete");

      expect(events).toHaveLength(1);
      expect(events[0]!.detail).toEqual({ type: "remove", index: 0 });
      ctrl.dispose();
    });

    it("merge dispatches pages-grid-merge with rootId", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const events: CustomEvent[] = [];
      grid.addEventListener("pages-grid-merge", (e) => events.push(e as CustomEvent));
      clickAction(grid, "0", "Merge");

      expect(events).toHaveLength(1);
      expect(events[0]!.detail).toEqual({ rootId: "0" });
      ctrl.dispose();
    });

    it("add-empty dispatches pages-grid-edit with placement below existing items", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const events: CustomEvent[] = [];
      grid.addEventListener("pages-grid-edit", (e) => events.push(e as CustomEvent));
      clickAction(grid, "0", "Add empty");

      expect(events).toHaveLength(1);
      const detail = events[0]!.detail;
      expect(detail.type).toBe("add-empty");
      expect(detail.placement.mode).toBe("positioned");
      expect(detail.placement.x).toBe(0);
      expect(detail.placement.y).toBe(2);
      expect(detail.placement.w).toBe(12);
      expect(detail.placement.h).toBe(1);
      ctrl.dispose();
    });

    it("pages-grid-edit events bubble and are composed", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const events: CustomEvent[] = [];
      document.body.addEventListener("pages-grid-edit", (e) => events.push(e as CustomEvent));
      clickAction(grid, "0", "Delete");

      expect(events).toHaveLength(1);
      expect(events[0]!.bubbles).toBe(true);
      expect(events[0]!.composed).toBe(true);
      ctrl.dispose();
    });

    it("pages-grid-merge does not bubble", () => {
      const items = makeItems();
      const grid = setupGrid(items);
      const ctrl = attachGridEditController(grid, items, 12, 60);
      selectItem(grid, "0");

      const gridEvents: CustomEvent[] = [];
      const bodyEvents: CustomEvent[] = [];
      grid.addEventListener("pages-grid-merge", (e) => gridEvents.push(e as CustomEvent));
      document.body.addEventListener("pages-grid-merge", (e) => bodyEvents.push(e as CustomEvent));
      clickAction(grid, "0", "Merge");

      expect(gridEvents).toHaveLength(1);
      expect(bodyEvents).toHaveLength(0);
      ctrl.dispose();
    });
  });
});
