import type { Rect } from "./grid-compaction.js";
import type { GridGeometry } from "./grid-drag.js";

export type EditorMode = "layout" | "content";

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
  gridEl.querySelector("[data-grid-overlay]")?.remove();
}

export function showPlaceholder(gridEl: HTMLElement, placement: Rect): HTMLDivElement {
  hidePlaceholder(gridEl);
  const ph = gridEl.ownerDocument.createElement("div");
  ph.dataset.gridPlaceholder = "";
  ph.style.gridColumn = `${String(placement.x + 1)} / span ${String(placement.w)}`;
  ph.style.gridRow = `${String(placement.y + 1)} / span ${String(placement.h)}`;
  ph.style.border = "2px dashed var(--pages-accent-7, #3b82f6)";
  ph.style.background = "var(--pages-accent-3, rgba(59, 130, 246, 0.15))";
  ph.style.borderRadius = "var(--pages-radius-md, 6px)";
  ph.style.pointerEvents = "none";
  ph.style.minHeight = "40px";
  gridEl.appendChild(ph);
  return ph;
}

export function hidePlaceholder(gridEl: HTMLElement): void {
  gridEl.querySelector("[data-grid-placeholder]")?.remove();
}

export function showSelectionOutline(el: HTMLElement): void {
  el.style.outline = "2px solid var(--pages-warning-7, #f59e0b)";
  el.style.outlineOffset = "-1px";
  el.dataset.gridSelected = "";
}

export function clearSelectionOutlines(gridEl: HTMLElement): void {
  for (const el of gridEl.querySelectorAll("[data-grid-selected]")) {
    (el as HTMLElement).style.outline = "";
    (el as HTMLElement).style.outlineOffset = "";
    delete (el as HTMLElement).dataset.gridSelected;
  }
}

export function renderEmptyContainer(el: HTMLElement): void {
  el.dataset.emptyContainer = "";
  el.style.border = "2px dashed var(--pages-neutral-5, #a1a1aa)";
  el.style.background = "var(--pages-neutral-2, rgba(244, 244, 245, 0.5))";
  el.style.borderRadius = "var(--pages-radius-md, 6px)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.color = "var(--pages-neutral-6, #71717a)";
  el.style.fontSize = "13px";
  el.textContent = "Drop component";
}

export function createModeToggle(
  gridEl: HTMLElement,
  mode: EditorMode,
  onChange: (mode: EditorMode) => void,
): HTMLElement {
  const toggle = gridEl.ownerDocument.createElement("div");
  toggle.dataset.modeToggle = "";
  toggle.setAttribute("role", "radiogroup");
  toggle.setAttribute("aria-label", "Editor mode");
  toggle.style.position = "absolute";
  toggle.style.top = "8px";
  toggle.style.right = "8px";
  toggle.style.zIndex = "20";
  toggle.style.display = "flex";
  toggle.style.gap = "0";
  toggle.style.borderRadius = "var(--pages-radius-sm, 4px)";
  toggle.style.overflow = "hidden";
  toggle.style.boxShadow = "var(--pages-shadow-2, 0 1px 3px rgba(0,0,0,.1))";

  for (const m of ["layout", "content"] as EditorMode[]) {
    const btn = gridEl.ownerDocument.createElement("button");
    btn.textContent = m.charAt(0).toUpperCase() + m.slice(1);
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(m === mode));
    btn.setAttribute("aria-label", `${m} mode`);
    btn.style.padding = "4px 12px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "500";
    btn.style.cursor = "pointer";
    btn.style.border = "none";
    btn.style.background = m === mode
      ? "var(--pages-accent-9, #2563eb)"
      : "var(--pages-neutral-3, #e4e4e7)";
    btn.style.color = m === mode ? "white" : "var(--pages-neutral-8, #27272a)";
    btn.addEventListener("click", () => onChange(m));
    toggle.appendChild(btn);
  }

  gridEl.appendChild(toggle);
  return toggle;
}

export function createEditButton(gridEl: HTMLElement, onClick: () => void): HTMLButtonElement {
  const btn = gridEl.ownerDocument.createElement("button");
  btn.dataset.gridEditButton = "";
  btn.textContent = "Edit layout";
  btn.addEventListener("click", onClick);
  gridEl.appendChild(btn);
  return btn;
}
export function removeEditButton(gridEl: HTMLElement): void {
  gridEl.querySelector("[data-grid-edit-button]")?.remove();
}

export function applyMergeStyles(gridEl: HTMLElement): void {
  if (gridEl.querySelector("[data-merge-styles]")) return;
  const style = gridEl.ownerDocument.createElement("style");
  style.dataset.mergeStyles = "";
  style.textContent = `
    [data-merge-active] > [data-item-id] {
      opacity: 0.4;
      pointer-events: none;
      transition: opacity 150ms ease;
    }
    [data-merge-active] > [data-merge-root] {
      opacity: 1;
      outline: 2px solid var(--pages-accent-9, #2563eb);
      outline-offset: -1px;
      pointer-events: auto;
      cursor: grab;
    }
    [data-merge-active] > [data-merge-target] {
      opacity: 0.8;
      outline: 2px dashed var(--pages-warning-7, #f59e0b);
      outline-offset: -1px;
      pointer-events: none;
    }
  `;
  gridEl.appendChild(style);
}

export function removeMergeStyles(gridEl: HTMLElement): void {
  gridEl.querySelector("[data-merge-styles]")?.remove();
}

