import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import {
  showPlaceholder,
  hidePlaceholder,
  renderEmptyContainer,
} from "./grid-overlay.js";

let gridEl: HTMLElement;

beforeEach(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  gridEl = dom.window.document.createElement("div");
  gridEl.style.display = "grid";
  gridEl.style.gridTemplateColumns = "repeat(12, 1fr)";
  dom.window.document.body.appendChild(gridEl);
});

describe("showPlaceholder", () => {
  it("creates a structural grid item with correct placement", () => {
    const ph = showPlaceholder(gridEl, { x: 2, y: 1, w: 4, h: 2 });
    expect(ph.style.gridColumn).toBe("3 / span 4");
    expect(ph.style.gridRow).toBe("2 / span 2");
    expect(ph.dataset.gridPlaceholder).toBeDefined();
  });

  it("removes previous placeholder before creating new one", () => {
    showPlaceholder(gridEl, { x: 0, y: 0, w: 6, h: 1 });
    showPlaceholder(gridEl, { x: 6, y: 0, w: 6, h: 1 });
    const placeholders = gridEl.querySelectorAll("[data-grid-placeholder]");
    expect(placeholders.length).toBe(1);
  });
});

describe("hidePlaceholder", () => {
  it("removes the placeholder element", () => {
    showPlaceholder(gridEl, { x: 0, y: 0, w: 6, h: 1 });
    hidePlaceholder(gridEl);
    expect(gridEl.querySelector("[data-grid-placeholder]")).toBeNull();
  });
});

describe("renderEmptyContainer", () => {
  it("adds empty-container styling to element", () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    const el = dom.window.document.createElement("div");
    renderEmptyContainer(el);
    expect(el.dataset.emptyContainer).toBeDefined();
  });
});
