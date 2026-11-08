import type { GridItem } from "../model/types.js";
import type { IdRect, Rect } from "./grid-compaction.js";
import { compactAll, overlaps } from "./grid-compaction.js";
import { selectItem, extendSelection, clearSelection } from "./grid-selection.js";
import type { GridSelection } from "./grid-selection.js";
import type { GridGeometry, CellCoord, ResizeHandle } from "./grid-drag.js";
import {
  computeGridGeometry,
  snapToCell,
  clampPlacement,
  hitTestHandle,
  DRAG_THRESHOLD,
} from "./grid-drag.js";
import { applyGridPlacement } from "./grid.js";
import {
  createGridOverlay,
  removeGridOverlay,
  showPlaceholder,
  hidePlaceholder,
  clearSelectionOutlines,
  showSelectionOutline,
  createModeToggle,
  removeEditButton,
} from "./grid-overlay.js";
import type { EditorMode } from "./grid-overlay.js";

export interface GridEditController {
  readonly gridEl: HTMLElement;
  readonly items: readonly GridItem[];
  readonly columns: number;
  readonly active: boolean;
  readonly mode: EditorMode;
  enter(): void;
  exit(): void;
  dispose(): void;
}

let activeController: GridEditControllerImpl | null = null;

class GridEditControllerImpl implements GridEditController {
  readonly gridEl: HTMLElement;
  readonly items: readonly GridItem[];
  readonly columns: number;
  private _active = false;
  private _mode: EditorMode = "layout";
  private readonly rowHeight: number;
  private readonly gap: number;
  private geometry: GridGeometry | null = null;
  private overlay: HTMLDivElement | null = null;
  private modeToggle: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private priorPosition = "";

  private dragging = false;
  private dragItemId: string | null = null;
  private hoveredId: string | null = null;
  private dragHandle: ResizeHandle | "move" = "move";
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginCell: CellCoord = { x: 0, y: 0 };
  private selection: GridSelection = clearSelection();

  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(gridEl: HTMLElement, items: readonly GridItem[], columns: number, rowHeight: number) {
    this.gridEl = gridEl;
    this.items = items;
    this.columns = columns;
    this.rowHeight = rowHeight;
    this.gap = 12;

    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);

    if (gridEl.parentElement) {
      this.observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node === gridEl || (node instanceof HTMLElement && node.contains(gridEl))) {
              this.dispose();
              return;
            }
          }
        }
      });
      this.observer.observe(gridEl.parentElement, { childList: true });
    }

    const hasPositioned = items.some(i => i.placement.mode === "positioned");
    if (hasPositioned) {
      requestAnimationFrame(() => this.enterPassive());
    }
  }

  get active(): boolean { return this._active; }
  get mode(): EditorMode { return this._mode; }

  enterPassive(): void {
    if (this._active) return;
    this._active = true;
    activeController = this;

    this.priorPosition = this.gridEl.style.position;
    this.gridEl.style.position = "relative";
    this.gridEl.setAttribute("data-grid-editing", "");

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) {
        el.style.position = "relative";
        el.style.outline = "1px dashed var(--pages-neutral-6, #71717a)";
        el.style.outlineOffset = "-1px";
        el.style.borderRadius = "var(--pages-radius-sm, 4px)";
        el.style.cursor = "grab";
        this._addItemHandles(el);
      }
    }

    const rect = this.gridEl.getBoundingClientRect();
    this.geometry = computeGridGeometry(rect, this.columns, this.rowHeight, this.gap);
    const hasFixedRows = getComputedStyle(this.gridEl).gridAutoRows !== "min-content";
    if (hasFixedRows) {
      this.overlay = createGridOverlay(this.gridEl, this.geometry);
    }

    this.gridEl.addEventListener("pointerdown", this.onPointerDown);
    this.gridEl.addEventListener("pointermove", this.onPointerMove);
    this.gridEl.addEventListener("pointerup", this.onPointerUp);

    this.storeOriginalPlacements();
  }

  private _addItemHandles(el: HTMLElement): void {
    const doc = el.ownerDocument;
    const HANDLE_BTN = "width:16px;height:16px;border:1px solid #dadce0;border-radius:3px;background:#fff;color:#5f6368;cursor:pointer;font-size:9px;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;";
    const RESIZE_EDGE = "position:absolute;pointer-events:auto;z-index:5;";

    // Drag buttons container — top-left, visible on hover
    const dragBar = doc.createElement("div");
    dragBar.dataset.dragHandle = "";
    dragBar.style.cssText = "position:absolute;top:4px;left:4px;display:flex;gap:2px;z-index:10;pointer-events:auto;opacity:0;transition:opacity 150ms ease;";
    el.addEventListener("mouseenter", function() { dragBar.style.opacity = "1"; });
    el.addEventListener("mouseleave", function() { dragBar.style.opacity = "0"; });

    const displaceBtn = doc.createElement("button");
    displaceBtn.title = "Drag to displace";
    displaceBtn.textContent = "⇵";
    displaceBtn.style.cssText = HANDLE_BTN;
    displaceBtn.dataset.dragMode = "displace";

    const swapBtn = doc.createElement("button");
    swapBtn.title = "Drag to swap";
    swapBtn.textContent = "⇄";
    swapBtn.style.cssText = HANDLE_BTN;
    swapBtn.dataset.dragMode = "swap";

    dragBar.appendChild(displaceBtn);
    dragBar.appendChild(swapBtn);
    el.appendChild(dragBar);

    // Resize handles — edges
    const edges = [
      { name: "top", css: "top:-3px;left:8px;right:8px;height:6px;cursor:ns-resize;" },
      { name: "bottom", css: "bottom:-3px;left:8px;right:8px;height:6px;cursor:ns-resize;" },
      { name: "left", css: "left:-3px;top:8px;bottom:8px;width:6px;cursor:ew-resize;" },
      { name: "right", css: "right:-3px;top:8px;bottom:8px;width:6px;cursor:ew-resize;" },
    ];
    for (const edge of edges) {
      const handle = doc.createElement("div");
      handle.dataset.resizeHandle = edge.name;
      handle.style.cssText = RESIZE_EDGE + edge.css + "background:transparent;";
      handle.addEventListener("mouseenter", function() { handle.style.background = "rgba(66,133,244,0.4)"; });
      handle.addEventListener("mouseleave", function() { handle.style.background = "transparent"; });
      el.appendChild(handle);
    }
  }

  enter(): void {
    if (activeController && activeController !== this) {
      activeController.exit();
    }
    activeController = this;
    this._active = true;

    this.priorPosition = this.gridEl.style.position;
    this.gridEl.style.position = "relative";
    this.gridEl.setAttribute("data-grid-editing", "");
    this.gridEl.ownerDocument.body.setAttribute("data-grid-editing-active", "");

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) {
        if (el.firstElementChild) {
          (el.firstElementChild as HTMLElement).style.pointerEvents = "none";
        }
        el.style.outline = "1px dashed var(--pages-neutral-6, #71717a)";
        el.style.outlineOffset = "-1px";
        el.style.borderRadius = "var(--pages-radius-sm, 4px)";
        el.style.cursor = "grab";
      }
    }

    const rect = this.gridEl.getBoundingClientRect();
    this.geometry = computeGridGeometry(rect, this.columns, this.rowHeight, this.gap);
    const hasFixedRows = getComputedStyle(this.gridEl).gridAutoRows !== "min-content";
    if (hasFixedRows) {
      this.overlay = createGridOverlay(this.gridEl, this.geometry);
    }

    this.modeToggle = createModeToggle(this.gridEl, this._mode, (m) => this.setMode(m));

    this.gridEl.addEventListener("pointerdown", this.onPointerDown);
    this.gridEl.addEventListener("pointermove", this.onPointerMove);
    this.gridEl.addEventListener("pointerup", this.onPointerUp);
    this.gridEl.ownerDocument.addEventListener("keydown", this.onKeyDown);

    this.storeOriginalPlacements();
  }

  exit(): void {
    if (!this._active) return;
    this._active = false;
    if (activeController === this) activeController = null;

    this.gridEl.removeAttribute("data-grid-editing");
    this.gridEl.ownerDocument.body.removeAttribute("data-grid-editing-active");
    this.gridEl.style.position = this.priorPosition;

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) {
        if (el.firstElementChild) {
          (el.firstElementChild as HTMLElement).style.pointerEvents = "";
        }
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.cursor = "";
      }
    }
    this.hoveredId = null;

    this.cancelDrag();
    clearSelectionOutlines(this.gridEl);
    this.selection = clearSelection();
    removeGridOverlay(this.gridEl);
    this.overlay = null;
    this.modeToggle?.remove();
    this.modeToggle = null;

    this.gridEl.removeEventListener("pointerdown", this.onPointerDown);
    this.gridEl.removeEventListener("pointermove", this.onPointerMove);
    this.gridEl.removeEventListener("pointerup", this.onPointerUp);
    this.gridEl.ownerDocument.removeEventListener("keydown", this.onKeyDown);

    this.restoreOriginalPlacements();
  }

  dispose(): void {
    this.exit();
    removeEditButton(this.gridEl);
    this.observer?.disconnect();
    this.observer = null;
  }

  private setMode(m: EditorMode): void {
    this._mode = m;
    this.selection = clearSelection();
    clearSelectionOutlines(this.gridEl);
    this.modeToggle?.remove();
    this.modeToggle = createModeToggle(this.gridEl, this._mode, (m2) => this.setMode(m2));
  }

  private originalPlacements = new Map<string, { x: number; y: number; w: number; h: number }>();

  private storeOriginalPlacements(): void {
    this.originalPlacements.clear();
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      if (item.placement.mode === "positioned") {
        this.originalPlacements.set(String(i), { ...item.placement });
      }
    }
  }

  private restoreOriginalPlacements(): void {
    for (const [id, placement] of this.originalPlacements) {
      const el = this.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
      if (el) {
        applyGridPlacement(el, { mode: "positioned", ...placement });
        el.style.opacity = "";
      }
    }
  }

  private getIdRects(): IdRect[] {
    return this.items
      .map((item, i) => {
        if (item.placement.mode !== "positioned") return null;
        return { id: String(i), x: item.placement.x, y: item.placement.y, w: item.placement.w, h: item.placement.h };
      })
      .filter((r): r is IdRect => r !== null);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.dragging || !this.geometry) return;
    if ((e.target as HTMLElement).dataset.gridEditButton !== undefined) return;
    if ((e.target as HTMLElement).closest("[data-mode-toggle]")) return;

    const target = this.findItemAtPoint(e.clientX, e.clientY);
    if (!target) return;

    const id = target.id;
    const idRects = this.getIdRects();

    if (e.shiftKey && this._mode === "layout") {
      this.selection = extendSelection(this.selection, id, idRects);
      this.applySelectionOutlines();
    } else {
      this.selection = selectItem(this.selection, id, idRects);
      this.applySelectionOutlines();
    }

    const handle = hitTestHandle(e.clientX, e.clientY, target.rect, e.pointerType) ?? "move";
    this.dragItemId = id;
    this.dragHandle = handle;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragOriginCell = snapToCell(e.clientX, e.clientY, this.geometry);

    this.gridEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this._active) return;
    if (this.dragItemId == null) {
      if (this.geometry) this.updateHover(e.clientX, e.clientY);
      return;
    }
    if (!this.geometry) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.dragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

    if (!this.dragging) {
      this.dragging = true;
      this.storeOriginalPlacements();
      this.setAllOutlines("1px solid var(--pages-neutral-6, #71717a)");
      const el = this.gridEl.querySelector(`[data-item-id="${this.dragItemId}"]`) as HTMLElement | null;
      if (el) {
        el.style.opacity = "0.4";
        el.style.outline = "2px solid var(--pages-accent-7, #3b82f6)";
      }
    }

    const cell = snapToCell(e.clientX, e.clientY, this.geometry);
    const items = this.getIdRects();
    const current = items.find(i => i.id === this.dragItemId);
    if (!current) return;

    if (this.dragHandle === "move") {
      const offsetX = cell.x - this.dragOriginCell.x;
      const offsetY = cell.y - this.dragOriginCell.y;
      const clamped = clampPlacement(current.x + offsetX, current.y + offsetY, current.w, current.h, this.columns);
      showPlaceholder(this.gridEl, { x: clamped.x, y: clamped.y, w: current.w, h: current.h });

      if (this._mode === "content") {
        const target: Rect = { x: clamped.x, y: clamped.y, w: current.w, h: current.h };
        const resolved = compactAll(items, this.dragItemId, target);
        for (const item of resolved) {
          if (item.id === this.dragItemId) continue;
          const el = this.gridEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
          if (el) applyGridPlacement(el, { mode: "positioned", x: item.x, y: item.y, w: item.w, h: item.h });
        }
      }
    } else {
      const newPlacement = this.computeResize(current, cell);
      showPlaceholder(this.gridEl, { x: newPlacement.x, y: newPlacement.y, w: newPlacement.w, h: newPlacement.h });
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this._active || this.dragItemId == null) return;

    if (this.dragging && this.geometry) {
      const cell = snapToCell(e.clientX, e.clientY, this.geometry);
      const items = this.getIdRects();
      const current = items.find(i => i.id === this.dragItemId);

      if (current) {
        let resolvedItems: IdRect[];

        if (this.dragHandle === "move") {
          const offsetX = cell.x - this.dragOriginCell.x;
          const offsetY = cell.y - this.dragOriginCell.y;
          const clamped = clampPlacement(current.x + offsetX, current.y + offsetY, current.w, current.h, this.columns);
          const target: Rect = { x: clamped.x, y: clamped.y, w: current.w, h: current.h };

          if (this._mode === "layout") {
            const targetItem = items.find(i => i.id !== this.dragItemId && overlaps(i, target));
            if (targetItem) {
              resolvedItems = items.map(i => {
                if (i.id === this.dragItemId) return { ...i, x: targetItem.x, y: targetItem.y, w: targetItem.w, h: targetItem.h };
                if (i.id === targetItem.id) return { ...i, x: current.x, y: current.y, w: current.w, h: current.h };
                return { ...i };
              });
            } else {
              resolvedItems = items.map(i => i.id === this.dragItemId ? { ...i, ...target } : { ...i });
            }
          } else {
            resolvedItems = compactAll(items, this.dragItemId, target);
          }
        } else {
          const newPlacement = this.computeResize(current, cell);
          resolvedItems = items.map(i => i.id === this.dragItemId ? { ...i, x: newPlacement.x, y: newPlacement.y, w: newPlacement.w, h: newPlacement.h } : { ...i });
        }

        for (const item of resolvedItems) {
          const el = this.gridEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
          if (el) {
            applyGridPlacement(el, { mode: "positioned", x: item.x, y: item.y, w: item.w, h: item.h });
            el.style.opacity = "";
          }
        }

        this.setAllOutlines("1px dashed var(--pages-neutral-6, #71717a)");
        this.dispatchEdit(this.dragHandle === "move" ? "move" : "resize", resolvedItems);
        this.storeOriginalPlacements();
      }
    }

    this.cancelDrag();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this._active) return;
    if (e.key === "Escape") {
      if (this.dragging) {
        this.restoreOriginalPlacements();
        this.cancelDrag();
        this.setAllOutlines("1px dashed var(--pages-neutral-6, #71717a)");
      } else {
        this.exit();
      }
    }
  }

  private cancelDrag(): void {
    this.dragging = false;
    this.dragItemId = null;
    hidePlaceholder(this.gridEl);
  }

  private computeResize(original: IdRect, cell: CellCoord): { x: number; y: number; w: number; h: number } {
    let { x, y, w, h } = original;
    const handle = this.dragHandle as ResizeHandle;

    if (handle.includes("right")) w = Math.max(1, cell.x - x + 1);
    if (handle.includes("bottom")) h = Math.max(1, cell.y - y + 1);
    if (handle === "left" || handle === "top-left" || handle === "bottom-left") {
      const newX = Math.min(cell.x, x + w - 1);
      w = x + w - newX;
      x = newX;
    }
    if (handle === "top" || handle === "top-left" || handle === "top-right") {
      const newY = Math.min(cell.y, y + h - 1);
      h = y + h - newY;
      y = newY;
    }

    w = Math.min(w, this.columns);
    const clamped = clampPlacement(x, y, w, h, this.columns);
    return { x: clamped.x, y: clamped.y, w, h };
  }

  private updateHover(clientX: number, clientY: number): void {
    const target = this.findItemAtPoint(clientX, clientY);
    const newId = target?.id ?? null;
    if (newId === this.hoveredId) return;
    if (this.hoveredId != null) {
      const prev = this.gridEl.querySelector(`[data-item-id="${this.hoveredId}"]`) as HTMLElement | null;
      if (prev && !this.selection.items.includes(this.hoveredId)) {
        prev.style.outline = "1px dashed var(--pages-neutral-6, #71717a)";
      }
    }
    this.hoveredId = newId;
    if (newId != null) {
      const el = this.gridEl.querySelector(`[data-item-id="${newId}"]`) as HTMLElement | null;
      if (el) el.style.outline = "2px solid var(--pages-accent-7, #3b82f6)";
    }
  }

  private setAllOutlines(style: string): void {
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) el.style.outline = style;
    }
  }

  private applySelectionOutlines(): void {
    clearSelectionOutlines(this.gridEl);
    for (const id of this.selection.items) {
      const el = this.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
      if (el) showSelectionOutline(el);
    }
  }

  private findItemAtPoint(px: number, py: number): { id: string; rect: DOMRect } | null {
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId == null) continue;
      const rect = el.getBoundingClientRect();
      if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
        return { id: el.dataset.itemId, rect };
      }
    }
    return null;
  }

  private dispatchEdit(type: string, items: IdRect[]): void {
    const resolved: GridItem[] = items.map(rect => {
      const origIndex = Number(rect.id);
      const origItem = this.items[origIndex];
      return {
        placement: { mode: "positioned" as const, x: rect.x, y: rect.y, w: rect.w, h: rect.h },
        ...(origItem?.component ? { component: origItem.component } : {}),
      };
    });
    this.gridEl.dispatchEvent(new CustomEvent("pages-grid-edit", {
      bubbles: true,
      composed: true,
      detail: { type, items: resolved },
    }));
  }
}

export function attachGridEditController(
  gridEl: HTMLElement,
  items: readonly GridItem[],
  columns: number,
  rowHeight = 60,
): GridEditController {
  return new GridEditControllerImpl(gridEl, items, columns, rowHeight);
}
