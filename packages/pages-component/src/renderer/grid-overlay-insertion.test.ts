import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createInsertionZones, removeInsertionZones } from "./grid-overlay.js";
import type { GridGeometry } from "./grid-drag.js";
import type { GridItem } from "../model/types.js";

const GEO: GridGeometry = {
  columns: 12,
  cellWidth: 100,
  cellHeight: 60,
  gap: 0,
  gridLeft: 0,
  gridTop: 0,
};

describe("insertion zones", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders + button at empty cells", () => {
    const items: GridItem[] = [
      { placement: { mode: "positioned", x: 0, y: 0, w: 6, h: 1 }, component: { type: "chart" } },
    ];
    const zones = createInsertionZones(container, GEO, items);
    expect(zones.length).toBeGreaterThan(0);
    zones.forEach(z => expect(z.textContent).toBe("+"));
  });

  it("zones have pointer-events auto", () => {
    const zones = createInsertionZones(container, GEO, []);
    zones.forEach(z => {
      expect(z.style.pointerEvents).toBe("auto");
    });
  });

  it("renders trailing edge zone after last occupied row", () => {
    const items: GridItem[] = [
      { placement: { mode: "positioned", x: 0, y: 0, w: 12, h: 1 }, component: { type: "chart" } },
    ];
    const zones = createInsertionZones(container, GEO, items);
    const trailingZone = zones.find(z => z.dataset.y === "1");
    expect(trailingZone).toBeDefined();
  });

  it("click dispatches pages-grid-edit with insert type", () => {
    const zones = createInsertionZones(container, GEO, []);
    const zone = zones[0]!;
    let detail: any;
    container.addEventListener("pages-grid-edit", (e: Event) => {
      detail = (e as CustomEvent).detail;
    });
    zone.click();
    expect(detail).toBeDefined();
    expect(detail.type).toBe("insert");
    expect(detail.componentType).toBe("placeholder");
    expect(detail.placement.mode).toBe("positioned");
  });

  it("removeInsertionZones cleans up DOM", () => {
    const zones = createInsertionZones(container, GEO, []);
    expect(container.querySelectorAll("[data-insertion-zone]").length).toBeGreaterThan(0);
    removeInsertionZones(zones);
    expect(container.querySelectorAll("[data-insertion-zone]").length).toBe(0);
  });
});
