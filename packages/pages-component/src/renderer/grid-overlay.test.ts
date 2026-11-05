import { describe, it, expect } from "vitest";
import { createGridOverlay, removeGridOverlay, showGhost, hideGhost, createEditButton, removeEditButton } from "./grid-overlay.js";
import type { GridGeometry } from "./grid-drag.js";

const GEO: GridGeometry = {
  columns: 12,
  cellWidth: 89,
  cellHeight: 60,
  gap: 12,
  gridLeft: 0,
  gridTop: 0,
};

describe("createGridOverlay", () => {
  it("creates overlay div with pointer-events none", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    expect(overlay.style.pointerEvents).toBe("none");
    expect(overlay.style.position).toBe("absolute");
    expect(overlay.dataset.gridOverlay).toBeDefined();
    expect(grid.contains(overlay)).toBe(true);
  });

  it("sets background with repeating-linear-gradient", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    expect(overlay.style.backgroundImage).toContain("repeating-linear-gradient");
  });
});

describe("removeGridOverlay", () => {
  it("removes the overlay from the grid", () => {
    const grid = document.createElement("div");
    createGridOverlay(grid, GEO);
    expect(grid.querySelector("[data-grid-overlay]")).not.toBeNull();
    removeGridOverlay(grid);
    expect(grid.querySelector("[data-grid-overlay]")).toBeNull();
  });

  it("does nothing when no overlay exists", () => {
    const grid = document.createElement("div");
    removeGridOverlay(grid);
    expect(grid.children).toHaveLength(0);
  });
});

describe("showGhost / hideGhost", () => {
  it("adds ghost div inside overlay", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    const ghost = showGhost(overlay, 2, 1, 4, 2, GEO);
    expect(ghost.dataset.gridGhost).toBeDefined();
    expect(overlay.contains(ghost)).toBe(true);
  });

  it("positions ghost based on cell coordinates", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    const ghost = showGhost(overlay, 0, 0, 1, 1, GEO);
    expect(ghost.style.left).toBe("0px");
    expect(ghost.style.top).toBe("0px");
  });

  it("replaces existing ghost on re-show", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    showGhost(overlay, 0, 0, 1, 1, GEO);
    showGhost(overlay, 2, 2, 1, 1, GEO);
    const ghosts = overlay.querySelectorAll("[data-grid-ghost]");
    expect(ghosts).toHaveLength(1);
  });

  it("removes ghost on hideGhost", () => {
    const grid = document.createElement("div");
    const overlay = createGridOverlay(grid, GEO);
    showGhost(overlay, 0, 0, 1, 1, GEO);
    hideGhost(overlay);
    expect(overlay.querySelector("[data-grid-ghost]")).toBeNull();
  });
});

describe("createEditButton", () => {
  it("creates button appended to grid element", () => {
    const grid = document.createElement("div");
    let clicked = false;
    createEditButton(grid, () => { clicked = true; });
    const btn = grid.querySelector("[data-grid-edit-button]") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(clicked).toBe(true);
  });

  it("positions button absolutely", () => {
    const grid = document.createElement("div");
    createEditButton(grid, () => {});
    const btn = grid.querySelector("[data-grid-edit-button]") as HTMLElement;
    expect(btn.style.position).toBe("absolute");
  });
});

describe("removeEditButton", () => {
  it("removes the edit button", () => {
    const grid = document.createElement("div");
    createEditButton(grid, () => {});
    removeEditButton(grid);
    expect(grid.querySelector("[data-grid-edit-button]")).toBeNull();
  });

  it("does nothing when no button exists", () => {
    const grid = document.createElement("div");
    removeEditButton(grid);
    expect(grid.children).toHaveLength(0);
  });
});
