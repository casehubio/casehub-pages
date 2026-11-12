import { describe, it, expect, beforeEach } from "vitest";
import { getCoordinator } from "./grid-edit-coordinator.js";
import { attachGridEditController } from "./grid-edit-controller.js";
import type { GridItem } from "../model/types.js";

function makePositionedItems(count: number): GridItem[] {
  return Array.from({ length: count }, (_, i) => ({
    at: { mode: "positioned" as const, x: 0, y: i, w: 12, h: 1 },
    component: { type: "html", id: `item-${i}` },
  }));
}

function setupGrid(parent: HTMLElement, items: GridItem[], columns = 12): HTMLElement {
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  parent.appendChild(grid);
  for (let i = 0; i < items.length; i++) {
    const el = document.createElement("div");
    el.dataset.itemId = String(i);
    const item = items[i]!;
    if (item.at.mode === "positioned") {
      el.style.gridColumn = `${item.at.x + 1} / span ${item.at.w}`;
      el.style.gridRow = `${item.at.y + 1} / span ${item.at.h}`;
    }
    grid.appendChild(el);
  }
  return grid;
}

function setupNestedGrids(): { root: HTMLElement; nested: HTMLElement } {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "repeat(12, 1fr)";
  document.body.appendChild(root);

  const item0 = document.createElement("div");
  item0.dataset.itemId = "0";
  item0.dataset.componentType = "panel";
  root.appendChild(item0);

  const nested = document.createElement("div");
  nested.style.display = "grid";
  nested.style.gridTemplateColumns = "repeat(6, 1fr)";
  nested.dataset.componentType = "grid";
  item0.appendChild(nested);

  const nestedItem = document.createElement("div");
  nestedItem.dataset.itemId = "0";
  nested.appendChild(nestedItem);

  return { root, nested };
}

describe("GridEditCoordinator", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const coord = getCoordinator();
    for (const c of [...coord.controllers]) coord.deregister(c);
  });

  it("registers a controller and tracks it", () => {
    const items = makePositionedItems(2);
    const grid = setupGrid(document.body, items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    const coord = getCoordinator();
    expect(coord.getControllerForEl(grid)).toBe(ctrl);
    ctrl.dispose();
  });

  it("builds parent-child tree from DOM containment", () => {
    const { root, nested } = setupNestedGrids();
    const rootItems = makePositionedItems(1);
    const nestedItems = makePositionedItems(1);
    const rootCtrl = attachGridEditController(root, rootItems, 12, 60);
    const nestedCtrl = attachGridEditController(nested, nestedItems, 6, 60);
    const coord = getCoordinator();
    expect(coord.getParent(nestedCtrl)).toBe(rootCtrl);
    expect(coord.getParent(rootCtrl)).toBeNull();
    rootCtrl.dispose();
    nestedCtrl.dispose();
  });

  it("deregisters on dispose", () => {
    const items = makePositionedItems(1);
    const grid = setupGrid(document.body, items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    const coord = getCoordinator();
    expect(coord.getControllerForEl(grid)).toBe(ctrl);
    ctrl.dispose();
    expect(coord.getControllerForEl(grid)).toBeNull();
  });

  it("handles three-level nesting tree", () => {
    const { root, nested } = setupNestedGrids();
    const nestedItem = nested.children[0] as HTMLElement;
    const deep = document.createElement("div");
    deep.style.display = "grid";
    deep.style.gridTemplateColumns = "repeat(3, 1fr)";
    deep.dataset.componentType = "grid";
    nestedItem.appendChild(deep);
    const deepItem = document.createElement("div");
    deepItem.dataset.itemId = "0";
    deep.appendChild(deepItem);

    const rootCtrl = attachGridEditController(root, makePositionedItems(1), 12, 60);
    const nestedCtrl = attachGridEditController(nested, makePositionedItems(1), 6, 60);
    const deepCtrl = attachGridEditController(deep, makePositionedItems(1), 3, 60);
    const coord = getCoordinator();
    expect(coord.getParent(deepCtrl)).toBe(nestedCtrl);
    expect(coord.getParent(nestedCtrl)).toBe(rootCtrl);
    expect(coord.getParent(rootCtrl)).toBeNull();
    rootCtrl.dispose();
    nestedCtrl.dispose();
    deepCtrl.dispose();
  });
});

describe("resolveGridPath", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const coord = getCoordinator();
    for (const c of [...coord.controllers]) coord.deregister(c);
  });

  it("returns root path for top-level grid", () => {
    const items = makePositionedItems(1);
    const grid = setupGrid(document.body, items);
    const ctrl = attachGridEditController(grid, items, 12, 60);
    const coord = getCoordinator();
    expect(coord.resolveGridPath(ctrl)).toEqual(["pages", 0, "grid"]);
    ctrl.dispose();
  });

  it("returns nested path for grid inside item 0", () => {
    const { root, nested } = setupNestedGrids();
    const rootCtrl = attachGridEditController(root, makePositionedItems(1), 12, 60);
    const nestedCtrl = attachGridEditController(nested, makePositionedItems(1), 6, 60);
    const coord = getCoordinator();
    expect(coord.resolveGridPath(nestedCtrl)).toEqual(["pages", 0, "grid", 0, "grid"]);
    rootCtrl.dispose();
    nestedCtrl.dispose();
  });

  it("handles three-level nesting", () => {
    const { root, nested } = setupNestedGrids();
    const nestedItem = nested.children[0] as HTMLElement;
    const deep = document.createElement("div");
    deep.style.display = "grid";
    deep.style.gridTemplateColumns = "repeat(3, 1fr)";
    deep.dataset.componentType = "grid";
    nestedItem.appendChild(deep);
    const deepItem = document.createElement("div");
    deepItem.dataset.itemId = "0";
    deep.appendChild(deepItem);

    const rootCtrl = attachGridEditController(root, makePositionedItems(1), 12, 60);
    const nestedCtrl = attachGridEditController(nested, makePositionedItems(1), 6, 60);
    const deepCtrl = attachGridEditController(deep, makePositionedItems(1), 3, 60);
    const coord = getCoordinator();
    expect(coord.resolveGridPath(deepCtrl)).toEqual(["pages", 0, "grid", 0, "grid", 0, "grid"]);
    rootCtrl.dispose();
    nestedCtrl.dispose();
    deepCtrl.dispose();
  });
});

describe("cross-grid drag lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const coord = getCoordinator();
    for (const c of [...coord.controllers]) coord.deregister(c);
  });

  function setupTwoGrids() {
    const root = document.createElement("div");
    root.style.display = "grid";
    root.style.gridTemplateColumns = "repeat(12, 1fr)";
    document.body.appendChild(root);
    root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1200, bottom: 400, width: 1200, height: 400, x: 0, y: 0, toJSON: () => ({}) });

    const item0 = document.createElement("div");
    item0.dataset.itemId = "0";
    root.appendChild(item0);

    const nested = document.createElement("div");
    nested.style.display = "grid";
    nested.style.gridTemplateColumns = "repeat(6, 1fr)";
    item0.appendChild(nested);
    nested.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 200, width: 600, height: 200, x: 0, y: 0, toJSON: () => ({}) });

    const nestedItem = document.createElement("div");
    nestedItem.dataset.itemId = "0";
    nested.appendChild(nestedItem);

    const rootItems: GridItem[] = [
      { at: { mode: "positioned", x: 0, y: 0, w: 12, h: 4 }, component: { type: "panel" } },
    ];
    const nestedItems: GridItem[] = [
      { at: { mode: "positioned", x: 0, y: 0, w: 3, h: 2 }, component: { type: "chart", id: "c1" } },
    ];

    const rootCtrl = attachGridEditController(root, rootItems, 12, 60);
    const nestedCtrl = attachGridEditController(nested, nestedItems, 6, 60);
    return { root, nested, rootCtrl, nestedCtrl, rootItems, nestedItems };
  }

  it("completeCrossGridDrag returns detail with source and target paths", () => {
    const { rootCtrl, nestedCtrl, nestedItems } = setupTwoGrids();
    const coord = getCoordinator();
    coord.startCrossGridDrag(nestedCtrl, 0, nestedItems[0]!);
    const detail = coord.completeCrossGridDrag(800, 300);
    expect(detail).not.toBeNull();
    expect(detail!.sourceGridPath).toEqual(coord.resolveGridPath(nestedCtrl));
    expect(detail!.targetGridPath).toEqual(coord.resolveGridPath(rootCtrl));
    expect(detail!.sourceIndex).toBe(0);
    rootCtrl.dispose();
    nestedCtrl.dispose();
  });

  it("cancelCrossGridDrag restores source item visibility", () => {
    const { nested, nestedCtrl, nestedItems } = setupTwoGrids();
    const coord = getCoordinator();
    coord.startCrossGridDrag(nestedCtrl, 0, nestedItems[0]!);
    coord.cancelCrossGridDrag();
    const el = nested.querySelector('[data-item-id="0"]') as HTMLElement;
    expect(el.style.display).not.toBe("none");
  });

  it("completeCrossGridDrag returns null when target is source grid", () => {
    const { nestedCtrl, nestedItems } = setupTwoGrids();
    const coord = getCoordinator();
    coord.startCrossGridDrag(nestedCtrl, 0, nestedItems[0]!);
    const detail = coord.completeCrossGridDrag(100, 100);
    expect(detail).toBeNull();
    nestedCtrl.dispose();
  });
});
