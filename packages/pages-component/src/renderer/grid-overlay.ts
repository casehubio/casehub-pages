import type { GridGeometry } from "./grid-drag.js";
import type { GridItem } from "../model/types.js";
import { cellRectToPixel } from "./grid-drag.js";

export function createGridOverlay(
  gridEl: HTMLElement,
  geometry: GridGeometry,
): HTMLDivElement {
  const overlay = gridEl.ownerDocument.createElement("div");
  overlay.dataset.gridOverlay = "";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "10";

  const hStep = geometry.cellWidth + geometry.gap;
  const vStep = geometry.cellHeight + geometry.gap;
  overlay.style.backgroundImage = [
    `repeating-linear-gradient(90deg, var(--pages-neutral-4, #d4d4d8) 0px, var(--pages-neutral-4, #d4d4d8) 1px, transparent 1px, transparent ${String(hStep)}px)`,
    `repeating-linear-gradient(0deg, var(--pages-neutral-4, #d4d4d8) 0px, var(--pages-neutral-4, #d4d4d8) 1px, transparent 1px, transparent ${String(vStep)}px)`,
  ].join(", ");
  overlay.style.opacity = "0.4";

  gridEl.appendChild(overlay);
  return overlay;
}

export function removeGridOverlay(gridEl: HTMLElement): void {
  const overlay = gridEl.querySelector("[data-grid-overlay]");
  overlay?.remove();
}

export function showGhost(
  overlay: HTMLDivElement,
  x: number,
  y: number,
  w: number,
  h: number,
  geometry: GridGeometry,
): HTMLDivElement {
  hideGhost(overlay);
  const ghost = overlay.ownerDocument.createElement("div");
  ghost.dataset.gridGhost = "";
  const rect = cellRectToPixel(x, y, w, h, geometry);
  ghost.style.position = "absolute";
  ghost.style.left = `${String(rect.left)}px`;
  ghost.style.top = `${String(rect.top)}px`;
  ghost.style.width = `${String(rect.width)}px`;
  ghost.style.height = `${String(rect.height)}px`;
  ghost.style.background = "var(--pages-accent-3, rgba(59, 130, 246, 0.5))";
  ghost.style.border = "2px solid var(--pages-accent-7, #3b82f6)";
  ghost.style.borderRadius = "var(--pages-radius-md, 6px)";
  ghost.style.pointerEvents = "none";
  overlay.appendChild(ghost);
  return ghost;
}

export function hideGhost(overlay: HTMLDivElement): void {
  const ghost = overlay.querySelector("[data-grid-ghost]");
  ghost?.remove();
}

export function createEditButton(
  gridEl: HTMLElement,
  onClick: () => void,
): HTMLButtonElement {
  const btn = gridEl.ownerDocument.createElement("button");
  btn.dataset.gridEditButton = "";
  btn.textContent = "Edit layout";
  btn.style.position = "absolute";
  btn.style.top = "8px";
  btn.style.right = "8px";
  btn.style.zIndex = "20";
  btn.style.padding = "4px 12px";
  btn.style.fontSize = "12px";
  btn.style.fontWeight = "500";
  btn.style.cursor = "pointer";
  btn.style.background = "var(--pages-accent-9, #2563eb)";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "var(--pages-radius-sm, 4px)";
  btn.style.boxShadow = "var(--pages-shadow-2, 0 1px 3px rgba(0,0,0,.1))";
  btn.addEventListener("click", onClick);
  gridEl.appendChild(btn);
  return btn;
}

export function removeEditButton(gridEl: HTMLElement): void {
  const btn = gridEl.querySelector("[data-grid-edit-button]");
  btn?.remove();
}

export function createInsertionZones(
  gridEl: HTMLElement,
  geometry: GridGeometry,
  items: readonly GridItem[],
): HTMLElement[] {
  const occupied = new Set<string>();
  for (const item of items) {
    if (item.placement.mode !== "positioned") continue;
    const p = item.placement;
    for (let dx = 0; dx < p.w; dx++) {
      for (let dy = 0; dy < p.h; dy++) {
        occupied.add(`${String(p.x + dx)},${String(p.y + dy)}`);
      }
    }
  }

  const maxY = items.reduce((max, item) => {
    if (item.placement.mode !== "positioned") return max;
    return Math.max(max, item.placement.y + item.placement.h);
  }, 0);

  const zones: HTMLElement[] = [];

  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x < geometry.columns; x++) {
      if (!occupied.has(`${String(x)},${String(y)}`)) {
        zones.push(createZoneButton(gridEl, geometry, x, y));
      }
    }
  }

  for (let x = 0; x < geometry.columns; x++) {
    zones.push(createZoneButton(gridEl, geometry, x, maxY));
  }

  return zones;
}

function createZoneButton(
  gridEl: HTMLElement,
  geometry: GridGeometry,
  x: number,
  y: number,
): HTMLElement {
  const btn = gridEl.ownerDocument.createElement("button");
  btn.textContent = "+";
  btn.dataset.insertionZone = "true";
  btn.dataset.x = String(x);
  btn.dataset.y = String(y);
  const rect = cellRectToPixel(x, y, 1, 1, geometry);
  btn.style.position = "absolute";
  btn.style.left = `${String(rect.left)}px`;
  btn.style.top = `${String(rect.top)}px`;
  btn.style.width = `${String(rect.width)}px`;
  btn.style.height = `${String(rect.height)}px`;
  btn.style.pointerEvents = "auto";
  btn.style.opacity = "0.6";
  btn.style.cursor = "pointer";
  btn.style.border = "none";
  btn.style.background = "transparent";
  btn.style.fontSize = "24px";
  btn.style.color = "var(--pages-neutral-5)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";

  btn.addEventListener("click", () => {
    gridEl.dispatchEvent(new CustomEvent("pages-grid-edit", {
      bubbles: true,
      composed: true,
      detail: {
        type: "insert",
        placement: { mode: "positioned", x, y, w: 1, h: 1 },
        componentType: "placeholder",
      },
    }));
  });

  gridEl.appendChild(btn);
  return btn;
}

export function removeInsertionZones(zones: HTMLElement[]): void {
  for (const z of zones) z.remove();
  zones.length = 0;
}
