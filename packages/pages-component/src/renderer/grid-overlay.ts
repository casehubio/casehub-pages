import type { GridGeometry } from "./grid-drag.js";
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
