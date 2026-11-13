import { describe, it, expect, beforeEach } from "vitest";
import { attachGridEditController } from "./grid-edit-controller.js";
import type { GridItem } from "../model/types.js";

function makeItems(): GridItem[] {
  return [
    { at: { mode: "positioned", x: 0, y: 0, w: 4, h: 1 }, component: { type: "html", id: "a" } },
    { at: { mode: "positioned", x: 4, y: 0, w: 4, h: 1 }, component: { type: "html", id: "b" } },
    { at: { mode: "positioned", x: 8, y: 0, w: 4, h: 1 }, component: { type: "html", id: "c" } },
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
    if (item.at.mode === "positioned") {
      el.style.gridColumn = `${item.at.x + 1} / span ${item.at.w}`;
      el.style.gridRow = `${item.at.y + 1} / span ${item.at.h}`;
    }
    grid.appendChild(el);
  }
  return grid;
}

describe("GridEditController merge state", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-grid-editing-active");
  });

  it("enterMerge sets data-merge-active on grid and data-merge-root on root item", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enterMerge("0");

    expect(grid.dataset.mergeActive).toBeDefined();
    const rootEl = grid.querySelector('[data-item-id="0"]') as HTMLElement;
    expect(rootEl.dataset.mergeRoot).toBeDefined();
    ctrl.dispose();
  });

  it("exitMerge removes all merge data attributes", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enterMerge("0");
    ctrl.exitMerge();

    expect(grid.dataset.mergeActive).toBeUndefined();
    expect(grid.querySelector("[data-merge-root]")).toBeNull();
    ctrl.dispose();
  });

  it("Escape exits merge state", () => {
    const items = makeItems();
    const grid = setupGrid(items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    ctrl.enter();
    ctrl.enterMerge("0");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(grid.dataset.mergeActive).toBeUndefined();
    ctrl.dispose();
  });
});
