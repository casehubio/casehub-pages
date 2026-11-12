import type { GridItem, GridPlacement } from "../model/types.js";
import type { IdRect, Rect } from "./grid-compaction.js";
import { compactAll, resizeCompact, compact, overlaps } from "./grid-compaction.js";
import { selectItem, extendSelection, clearSelection } from "./grid-selection.js";
import type { GridSelection } from "./grid-selection.js";
import type { GridGeometry, CellCoord, ResizeHandle, RowBounds } from "./grid-drag.js";
import {
  computeGridGeometry,
  snapToCell,
  snapToCellWithRows,
  captureRowPositions,
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
import { getCoordinator } from "./grid-edit-coordinator.js";

export interface GridEditController {
  readonly gridEl: HTMLElement;
  readonly items: readonly GridItem[];
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
  readonly active: boolean;
  readonly mode: EditorMode;
  enter(): void;
  exit(): void;
  dispose(): void;
  releaseItem(index: number): void;
  acceptForeignItem(item: GridItem, placement: GridPlacement): void;
  clearForeignItem(): void;
  setDragGhostVisible(visible: boolean): void;
}

let lastEditDispatchTime = 0;

class GridEditControllerImpl implements GridEditController {
  readonly gridEl: HTMLElement;
  readonly items: readonly GridItem[];
  readonly columns: number;
  private _active = false;
  private _mode: EditorMode = "layout";
  readonly rowHeight: number;
  readonly gap: number;
  private geometry: GridGeometry | null = null;
  private overlay: HTMLDivElement | null = null;
  private modeToggle: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private priorPosition = "";

  private dragging = false;
  private _crossGridActive = false;
  private dragItemId: string | null = null;
  private hoveredId: string | null = null;
  private dragHandle: ResizeHandle | "move" = "move";
  private dragIntent: "displace" | "swap" = "displace";
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginCell: CellCoord = { x: 0, y: 0 };
  private selection: GridSelection = clearSelection();
  private frozenRows: RowBounds[] | null = null;
  private lastSnapCell: CellCoord | null = null;
  private _initialDragPositions: Map<string, DOMRect> | null = null;
  private _priorGridAutoRows = "";
  private _selectedEl: HTMLElement | null = null;
  private _dispatching = false;
  private _dragCursorBadge: HTMLElement | null = null;

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

    const hasPositioned = items.some(i => i.at.mode === "positioned");
    if (hasPositioned) {
      this.enterPassive();
    }
  }

  get active(): boolean { return this._active; }
  get mode(): EditorMode { return this._mode; }

  enterPassive(): void {
    if (this._active) return;
    this._active = true;
    this._mode = "content";

    this.priorPosition = this.gridEl.style.position;
    this.gridEl.style.position = "relative";
    this.gridEl.setAttribute("data-grid-editing", "");

    this._priorGridAutoRows = this.gridEl.style.gridAutoRows;
    this.gridEl.style.gridAutoRows = `${String(this.rowHeight)}px`;

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) {
        el.style.position = "relative";
        el.style.borderRadius = "var(--pages-radius-sm, 4px)";
        el.style.cursor = "grab";
        el.style.userSelect = "none";
        el.style.overflow = "hidden";
      }
    }

    const rect = this.gridEl.getBoundingClientRect();
    this.geometry = computeGridGeometry(rect, this.columns, this.rowHeight, this.gap);

    this.gridEl.addEventListener("pointerdown", this.onPointerDown);
    this.gridEl.addEventListener("pointermove", this.onPointerMove);
    this.gridEl.addEventListener("pointerup", this.onPointerUp);

    this.initLivePlacements();
    this.storeOriginalPlacements();
  }

  enter(): void {
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

    this.gridEl.removeAttribute("data-grid-editing");
    this.gridEl.ownerDocument.body.removeAttribute("data-grid-editing-active");
    this.gridEl.style.position = this.priorPosition;
    this.gridEl.style.gridAutoRows = this._priorGridAutoRows;

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

    if (this.dragging) this.restoreDragStyles();
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

  releaseItem(index: number): void {
    const el = this.gridEl.querySelector(`[data-item-id="${index}"]`) as HTMLElement | null;
    if (el) el.style.display = "none";
  }

  acceptForeignItem(_item: GridItem, placement: GridPlacement): void {
    this.clearForeignItem();
    if (placement.mode === "positioned") {
      showPlaceholder(this.gridEl, placement);
    }
  }

  clearForeignItem(): void {
    hidePlaceholder(this.gridEl);
  }

  setDragGhostVisible(visible: boolean): void {
    if (this._dragCursorBadge) {
      this._dragCursorBadge.style.display = visible ? "" : "none";
    }
  }

  dispose(): void {
    this.exit();
    removeEditButton(this.gridEl);
    this.observer?.disconnect();
    this.observer = null;
    getCoordinator().deregister(this);
  }

  private setMode(m: EditorMode): void {
    this._mode = m;
    this.selection = clearSelection();
    clearSelectionOutlines(this.gridEl);
    this.modeToggle?.remove();
    this.modeToggle = createModeToggle(this.gridEl, this._mode, (m2) => this.setMode(m2));
  }

  private refreshGeometryIfStale(): void {
    const rect = this.gridEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (!this.geometry || rect.x !== this.geometry.gridLeft || rect.y !== this.geometry.gridTop || Math.abs(rect.width - (this.geometry.cellWidth * this.columns + this.geometry.gap * (this.columns - 1))) > 1) {
      this.geometry = computeGridGeometry(rect, this.columns, this.rowHeight, this.gap);
    }
  }

  private originalPlacements = new Map<string, { x: number; y: number; w: number; h: number }>();
  private livePlacements = new Map<string, { x: number; y: number; w: number; h: number }>();

  private initLivePlacements(): void {
    this.livePlacements.clear();
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      if (item.at.mode === "positioned") {
        this.livePlacements.set(String(i), { x: item.at.x, y: item.at.y, w: item.at.w, h: item.at.h });
      }
    }
  }

  private storeOriginalPlacements(): void {
    this.originalPlacements.clear();
    for (const [id, p] of this.livePlacements) {
      this.originalPlacements.set(id, { ...p });
    }
  }

  private restoreOriginalPlacements(): void {
    for (const [id, placement] of this.originalPlacements) {
      this.livePlacements.set(id, { ...placement });
      const el = this.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
      if (el) {
        applyGridPlacement(el, { mode: "positioned", ...placement });
        el.style.display = "";
        el.style.transform = "";
        el.style.transition = "";
      }
    }
  }

  private getIdRects(): IdRect[] {
    return [...this.livePlacements.entries()].map(([id, p]) => ({
      id, x: p.x, y: p.y, w: p.w, h: p.h,
    }));
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.dragging || !this.geometry) return;
    if ((e.target as HTMLElement).dataset.gridEditButton !== undefined) return;
    if ((e.target as HTMLElement).closest("[data-mode-toggle]")) return;

    if (getCoordinator().getParent(this)) {
      e.stopPropagation();
    }

    const target = this.findItemAtPoint(e.clientX, e.clientY);
    if (!target) return;

    const id = target.id;
    const idRects = this.getIdRects();
    const wasSelected = this.selection.items.includes(id);

    if (e.shiftKey && this._mode === "layout") {
      this.selection = extendSelection(this.selection, id, idRects);
    } else {
      this.selection = selectItem(this.selection, id, idRects);
    }
    if (this._mode === "layout") this.applySelectionOutlines();

    this._setSelectedEl(id);

    if (!wasSelected) {
      if (this.hoveredId != null) {
        const hovEl = this.gridEl.querySelector(`[data-item-id="${this.hoveredId}"]`) as HTMLElement | null;
        if (hovEl) this.clearItemHover(hovEl);
      }
      return;
    }

    const dragBtn = (e.target as HTMLElement).closest("[data-drag-mode]") as HTMLElement | null;
    const isDragHandle = dragBtn != null || (e.target as HTMLElement).closest("[data-drag-handle]") != null;
    if (isDragHandle) {
      this.dragHandle = "move";
      this.dragIntent = dragBtn?.dataset.dragMode === "swap" ? "swap" : "displace";
    } else {
      const rect = target.rect;
      const lineCenter = 5;
      const halfZone = 2;
      const nearRight = Math.abs(e.clientX - (rect.right + lineCenter)) <= halfZone;
      const nearBottom = Math.abs(e.clientY - (rect.bottom + lineCenter)) <= halfZone;
      const nearLeft = Math.abs(e.clientX - (rect.left - lineCenter)) <= halfZone;
      const nearTop = Math.abs(e.clientY - (rect.top - lineCenter)) <= halfZone;
      if (nearTop && nearRight) this.dragHandle = "top-right";
      else if (nearTop && nearLeft) this.dragHandle = "top-left";
      else if (nearBottom && nearRight) this.dragHandle = "bottom-right";
      else if (nearBottom && nearLeft) this.dragHandle = "bottom-left";
      else if (nearTop) this.dragHandle = "top";
      else if (nearBottom) this.dragHandle = "bottom";
      else if (nearRight) this.dragHandle = "right";
      else if (nearLeft) this.dragHandle = "left";
      else return;
    }
    this.dragItemId = id;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragOriginCell = snapToCellWithRows(e.clientX, e.clientY, this.geometry, captureRowPositions(this.gridEl));
    this.gridEl.dataset.gridDragging = "";
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this._active) return;
    if (this.dragItemId == null) {
      this.refreshGeometryIfStale();
      if (this.geometry) this.updateHover(e.clientX, e.clientY);
      return;
    }
    if (!this.geometry) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.dragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

    if (!this.dragging) {
      this.dragging = true;
      this.gridEl.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.storeOriginalPlacements();

      if (this.dragHandle === "move" && this.hoveredId != null) {
        const hovEl = this.gridEl.querySelector(`[data-item-id="${this.hoveredId}"]`) as HTMLElement | null;
        if (hovEl) this.clearItemHover(hovEl);
      }
      this.hoveredId = null;

      // Capture frozen row positions for snap calculation
      this.frozenRows = captureRowPositions(this.gridEl);

      // Capture positions before hiding for smooth initial FLIP
      this._initialDragPositions = this.captureItemPositions();

      // For displace move: remove item from flow so others fill its space
      // For swap move: dim the item (stays in flow as visual anchor)
      // For resize: item stays visible and resizes in place
      if (this.dragHandle === "move") {
        const el = this.gridEl.querySelector(`[data-item-id="${this.dragItemId}"]`) as HTMLElement | null;
        if (this.dragIntent === "swap") {
          if (el) el.style.opacity = "0.3";
          this._showDragBadge("⇄");
        } else {
          if (el) el.style.display = "none";
        }
        this.hideBuilderOverlay();
      }
    }

    if (this.dragIntent === "swap" || this.dragHandle === "move") {
      const rect = this.gridEl.getBoundingClientRect();
      const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      const coord = getCoordinator();
      const deepest = coord.deepestGridAt(e.clientX, e.clientY);
      let enteredOtherGrid = deepest != null && deepest !== this;
      if (!enteredOtherGrid && !outside && !this._crossGridActive && this.dragHandle === "move" && this.geometry) {
        const cell = snapToCellWithRows(e.clientX, e.clientY, this.geometry, this.frozenRows);
        for (let i = 0; i < this.items.length; i++) {
          if (String(i) === this.dragItemId) continue;
          const item = this.items[i]!;
          if (item.at.mode !== "positioned") continue;
          const el = this.gridEl.querySelector(`[data-item-id="${i}"]`) as HTMLElement | null;
          if (!el || !el.querySelector('[data-grid-editing]')) continue;
          if (cell.x >= item.at.x && cell.x < item.at.x + item.at.w && cell.y >= item.at.y && cell.y < item.at.y + item.at.h) {
            enteredOtherGrid = true;
            break;
          }
        }
      }
      if (outside || enteredOtherGrid || this._crossGridActive) {
        if (!this._crossGridActive) {
          this._crossGridActive = true;
          this.clearSwapTarget();
          this.restoreOriginalPlacements();
          hidePlaceholder(this.gridEl);
          const itemIndex = Number(this.dragItemId);
          const item = this.items[itemIndex];
          if (item) coord.startCrossGridDrag(this, itemIndex, item, this.dragIntent);
          if (!this._dragCursorBadge) {
            if (this.dragIntent === "swap") {
              this._showDragBadge("⇄");
            } else {
              const itemIdx = Number(this.dragItemId);
              const srcItem = this.items[itemIdx];
              if (srcItem?.at.mode === "positioned" && this.geometry) {
                const pw = srcItem.at.w * (this.geometry.cellWidth + this.geometry.gap) - this.geometry.gap;
                const ph = srcItem.at.h * (this.geometry.cellHeight + this.geometry.gap) - this.geometry.gap;
                const ghost = this.gridEl.ownerDocument.createElement("div");
                ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${pw}px;height:${ph}px;background:var(--pages-accent-3, rgba(59,130,246,0.15));border:2px dashed var(--pages-accent-7, #3b82f6);border-radius:var(--pages-radius-sm, 4px);opacity:0.8;`;
                this.gridEl.ownerDocument.body.appendChild(ghost);
                this._dragCursorBadge = ghost;
              }
            }
          }
        }
        e.stopPropagation();
        coord.handleCrossGridMove(e.clientX, e.clientY);
        this._moveDragBadge(e.clientX, e.clientY);
        return;
      }
      if (this._crossGridActive) {
        this._crossGridActive = false;
        coord.cancelCrossGridDrag();
      }
    }
    if (this.dragIntent === "swap") {
      this.highlightSwapTarget(e.clientX, e.clientY);
      this._moveDragBadge(e.clientX, e.clientY);
      return;
    }

    const cell = snapToCellWithRows(e.clientX, e.clientY, this.geometry, this.frozenRows);

    if (this.lastSnapCell && cell.x === this.lastSnapCell.x && cell.y === this.lastSnapCell.y) return;
    this.lastSnapCell = cell;

    const items = this.getIdRects();
    const current = items.find(i => i.id === this.dragItemId);
    if (!current) return;

    let target: Rect;
    if (this.dragHandle === "move") {
      const offsetX = cell.x - this.dragOriginCell.x;
      const offsetY = cell.y - this.dragOriginCell.y;
      const clamped = clampPlacement(current.x + offsetX, current.y + offsetY, current.w, current.h, this.columns);
      target = { x: clamped.x, y: clamped.y, w: current.w, h: current.h };
    } else {
      const p = this.computeResize(current, cell);
      target = { x: p.x, y: p.y, w: p.w, h: p.h };
    }

    {
      const resolved = this.dragHandle === "move"
        ? compactAll(items, this.dragItemId!, target)
        : resizeCompact(items, this.dragItemId!, target);

      const before = this._initialDragPositions ?? this.captureItemPositions();
      this._initialDragPositions = null;

      if (this.dragHandle === "move") {
        const movedResolved = resolved.find(i => i.id === this.dragItemId);
        showPlaceholder(this.gridEl, movedResolved ?? target);
      } else {
        hidePlaceholder(this.gridEl);
      }

      for (const item of resolved) {
        if (item.id === this.dragItemId && this.dragHandle === "move") continue;
        const el = this.gridEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
        if (el) applyGridPlacement(el, { mode: "positioned", x: item.x, y: item.y, w: item.w, h: item.h });
      }

      this.flipAnimate(before, this.dragItemId!);

      if (this.dragHandle !== "move") {
        this.syncBuilderOverlay(this.dragItemId!);
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this._active || this.dragItemId == null) return;
    e.preventDefault();
    e.stopPropagation();

    if (this._crossGridActive) {
      const coord = getCoordinator();
      const detail = coord.completeCrossGridDrag(e.clientX, e.clientY);
      this._crossGridActive = false;
      this._removeDragBadge();
      this.hideBuilderOverlay();
      this.cancelDrag();
      if (detail) {
        this.gridEl.dispatchEvent(new CustomEvent("pages-grid-cross-edit", { bubbles: true, composed: true, detail }));
      }
      setTimeout(() => { this.showBuilderOverlay(); }, 50);
      return;
    }

    if (this.dragging && this.geometry) {
      const cell = snapToCellWithRows(e.clientX, e.clientY, this.geometry, this.frozenRows);
      const items = this.getIdRects();
      const current = items.find(i => i.id === this.dragItemId);

      if (current) {
        let resolvedItems: IdRect[];

        if (this.dragHandle === "move") {
          const offsetX = cell.x - this.dragOriginCell.x;
          const offsetY = cell.y - this.dragOriginCell.y;
          const clamped = clampPlacement(current.x + offsetX, current.y + offsetY, current.w, current.h, this.columns);
          const target: Rect = { x: clamped.x, y: clamped.y, w: current.w, h: current.h };

          if (this.dragIntent === "swap") {
            const swapHit = this.findItemAtPoint(e.clientX, e.clientY);
            const targetItem = (swapHit && swapHit.id !== this.dragItemId) ? items.find(i => i.id === swapHit.id) : null;
            if (targetItem) {
              resolvedItems = items.map(i => {
                if (i.id === this.dragItemId) return { ...i, x: targetItem.x, y: targetItem.y, w: targetItem.w, h: targetItem.h };
                if (i.id === targetItem.id) return { ...i, x: current.x, y: current.y, w: current.w, h: current.h };
                return { ...i };
              });
            } else {
              resolvedItems = items.map(i => ({ ...i }));
            }
          } else {
            resolvedItems = compactAll(items, this.dragItemId!, target);
          }
        } else {
          const newPlacement = this.computeResize(current, cell);
          const target: Rect = { x: newPlacement.x, y: newPlacement.y, w: newPlacement.w, h: newPlacement.h };
          resolvedItems = resizeCompact(items, this.dragItemId!, target);
        }

        for (const item of resolvedItems) {
          const el = this.gridEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
          if (el) {
            applyGridPlacement(el, { mode: "positioned", x: item.x, y: item.y, w: item.w, h: item.h });
            el.style.display = "";
            el.style.opacity = "";
            el.style.transform = "";
            el.style.transition = "";
            el.style.outline = "";
            el.style.outlineOffset = "";
            el.style.boxShadow = "";
            el.style.cursor = "";
          }
        }

        for (const item of resolvedItems) {
          this.livePlacements.set(item.id, { x: item.x, y: item.y, w: item.w, h: item.h });
        }

        const editType = this.dragHandle === "move" ? "move" : "resize";
        const draggedId = this.dragItemId!;
        const wasResize = this.dragHandle !== "move";
        this.hideBuilderOverlay();
        this.cancelDrag();
        this.dispatchEdit(editType, resolvedItems);
        this.storeOriginalPlacements();
        setTimeout(() => {
          this.showBuilderOverlay();
          this.syncBuilderOverlay(draggedId);
        }, 50);
      }
    }

    if (this.hoveredId != null) {
      const hovEl = this.gridEl.querySelector(`[data-item-id="${this.hoveredId}"]`) as HTMLElement | null;
      if (hovEl) this.clearItemHover(hovEl);
      this.hoveredId = null;
    }
    this.cancelDrag();
    this.updateHover(e.clientX, e.clientY);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this._active) return;
    if (e.key === "Escape") {
      if (this.dragging) {
        this.showBuilderOverlay();
        this.restoreDragStyles();
        this.restoreOriginalPlacements();
        this.cancelDrag();
      } else {
        this.exit();
      }
    }
  }

  private cancelDrag(): void {
    const wasDragging = this.dragging || this.dragItemId != null;
    this._crossGridActive = false;
    this.dragging = false;
    this.dragItemId = null;
    this.dragIntent = "displace";
    this.clearSwapTarget();
    this._removeDragBadge();
    this.lastSnapCell = null;
    this.frozenRows = null;
    this._initialDragPositions = null;
    hidePlaceholder(this.gridEl);
    delete this.gridEl.dataset.gridDragging;
    if (wasDragging) {
      const suppress = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
      this.gridEl.addEventListener("click", suppress, { capture: true, once: true });
    }
  }

  private captureItemPositions(): Map<string, DOMRect> {
    const elements: [string, HTMLElement][] = [];
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      const id = el.dataset.itemId;
      if (id != null) {
        el.style.transition = "none";
        el.style.transform = "";
        elements.push([id, el]);
      }
    }
    const positions = new Map<string, DOMRect>();
    for (const [id, el] of elements) {
      positions.set(id, el.getBoundingClientRect());
    }
    return positions;
  }

  private flipAnimate(before: Map<string, DOMRect>, skipId: string): void {
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      const id = el.dataset.itemId;
      if (id == null || id === skipId) continue;
      const oldRect = before.get(id);
      if (!oldRect) continue;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${String(dx)}px, ${String(dy)}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 200ms ease";
        el.style.transform = "";
      });
    }
  }

  private restoreDragStyles(): void {
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId != null) {
        el.style.display = "";
        el.style.opacity = "";
        el.style.transform = "";
        el.style.transition = "";
        el.style.outline = "";
        el.style.boxShadow = "";
      }
    }
  }

  private _setSelectedEl(id: string): void {
    const el = this.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
    if (el === this._selectedEl) return;
    if (this._selectedEl) {
      this._selectedEl.querySelector("[data-drag-handle]")?.remove();
    }
    this._selectedEl = el;
    if (!el) return;
    el.querySelector("[data-drag-handle]")?.remove();
    const doc = el.ownerDocument;
    const BTN = "width:20px;height:20px;border:1px solid rgba(255,255,255,0.3);border-radius:3px;background:rgba(0,0,0,0.5);color:#fff;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;";
    const bar = doc.createElement("div");
    bar.dataset.dragHandle = "";
    bar.style.cssText = "position:absolute;top:2px;left:2px;display:none;gap:2px;z-index:10;pointer-events:auto;";
    const displaceBtn = doc.createElement("button");
    displaceBtn.title = "Drag to displace";
    displaceBtn.textContent = "⇵";
    displaceBtn.style.cssText = BTN;
    displaceBtn.dataset.dragMode = "displace";
    const swapBtn = doc.createElement("button");
    swapBtn.title = "Drag to swap";
    swapBtn.textContent = "⇄";
    swapBtn.style.cssText = BTN;
    swapBtn.dataset.dragMode = "swap";
    bar.appendChild(displaceBtn);
    bar.appendChild(swapBtn);
    el.appendChild(bar);
    if (this.hoveredId === id) bar.style.display = "flex";
  }

  private _swapTargetId: string | null = null;

  private highlightSwapTarget(clientX: number, clientY: number): void {
    const hit = this.findItemAtPoint(clientX, clientY);
    const newId = (hit && hit.id !== this.dragItemId) ? hit.id : null;
    if (newId === this._swapTargetId) return;
    if (this._swapTargetId != null) {
      const prev = this.gridEl.querySelector(`[data-item-id="${this._swapTargetId}"]`) as HTMLElement | null;
      if (prev) {
        prev.style.outline = "";
        prev.style.outlineOffset = "";
        prev.style.boxShadow = "";
      }
    }
    this._swapTargetId = newId;
    if (newId != null) {
      const el = this.gridEl.querySelector(`[data-item-id="${newId}"]`) as HTMLElement | null;
      if (el) {
        el.style.outline = "2px solid var(--pages-accent-7, #3b82f6)";
        el.style.outlineOffset = "-2px";
        el.style.boxShadow = "inset 0 0 0 100px rgba(59, 130, 246, 0.1)";
      }
    }
  }

  private clearSwapTarget(): void {
    if (this._swapTargetId != null) {
      const el = this.gridEl.querySelector(`[data-item-id="${this._swapTargetId}"]`) as HTMLElement | null;
      if (el) {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.boxShadow = "";
      }
      this._swapTargetId = null;
    }
  }

  private hasBuilderOverlayOver(itemRect: DOMRect): boolean {
    const root = this.gridEl.getRootNode() as Document | ShadowRoot;
    const overlay = root.querySelector(".builder-scope-overlay") as HTMLElement | null;
    if (!overlay || overlay.style.display === "none") return false;
    const or = overlay.getBoundingClientRect();
    return Math.abs(or.left - itemRect.left) < 10 && Math.abs(or.top - itemRect.top) < 10;
  }

  private _showDragBadge(icon: string): void {
    this._removeDragBadge();
    const badge = this.gridEl.ownerDocument.createElement("div");
    badge.textContent = icon;
    badge.style.cssText = "position:fixed;z-index:9999;pointer-events:none;width:24px;height:24px;border-radius:12px;background:var(--pages-accent-9, #2563eb);color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);";
    this.gridEl.ownerDocument.body.appendChild(badge);
    this._dragCursorBadge = badge;
  }

  private _moveDragBadge(clientX: number, clientY: number): void {
    if (this._dragCursorBadge) {
      const w = this._dragCursorBadge.offsetWidth || 24;
      const h = this._dragCursorBadge.offsetHeight || 24;
      this._dragCursorBadge.style.left = `${String(clientX - w / 2)}px`;
      this._dragCursorBadge.style.top = `${String(clientY - h / 2)}px`;
    }
  }

  private _removeDragBadge(): void {
    this._dragCursorBadge?.remove();
    this._dragCursorBadge = null;
  }

  private hideBuilderOverlay(): void {
    const root = this.gridEl.getRootNode() as Document | ShadowRoot;
    const overlay = root.querySelector(".builder-scope-overlay") as HTMLElement | null;
    if (overlay) overlay.style.display = "none";
  }

  private showBuilderOverlay(): void {
    const root = this.gridEl.getRootNode() as Document | ShadowRoot;
    const overlay = root.querySelector(".builder-scope-overlay") as HTMLElement | null;
    if (!overlay) return;
    overlay.style.transition = "none";
    overlay.style.display = "";
  }

  private highlightOverlayEdge(active: boolean): void {
    const root = this.gridEl.getRootNode() as Document | ShadowRoot;
    const overlay = root.querySelector(".builder-scope-overlay") as HTMLElement | null;
    if (!overlay) return;
    if (active) {
      overlay.style.outlineWidth = "3px";
      overlay.style.boxShadow = "0 0 6px 1px var(--pages-accent-7, #3b82f6)";
    } else {
      overlay.style.outlineWidth = "";
      overlay.style.boxShadow = "";
    }
  }

  private syncBuilderOverlay(itemId: string): void {
    const el = this.gridEl.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null;
    if (!el) return;
    const root = this.gridEl.getRootNode() as Document | ShadowRoot;
    const overlay = root.querySelector(".builder-scope-overlay") as HTMLElement | null;
    if (!overlay) return;
    const container = overlay.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const pad = 4;
    overlay.style.left = `${String(elRect.left - containerRect.left - pad)}px`;
    overlay.style.top = `${String(elRect.top - containerRect.top - pad)}px`;
    overlay.style.width = `${String(elRect.width + pad * 2)}px`;
    overlay.style.height = `${String(elRect.height + pad * 2)}px`;
    requestAnimationFrame(() => { overlay.style.transition = ""; });
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

    if (newId !== this.hoveredId) {
      if (this.hoveredId != null) {
        const prev = this.gridEl.querySelector(`[data-item-id="${this.hoveredId}"]`) as HTMLElement | null;
        if (prev) this.clearItemHover(prev);
      }
      this.hoveredId = newId;
      this._toggleDragHandles(newId);
    }

    if (!target) return;
    const el = this.gridEl.querySelector(`[data-item-id="${target.id}"]`) as HTMLElement | null;
    if (!el) return;

    const isSelected = this.selection.items.includes(target.id) || this.hasBuilderOverlayOver(target.rect);

    if (isSelected) {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.boxShadow = "";
      const rect = target.rect;
      const lineCenter = 5;
      const halfZone = 2;
      const nearRight = Math.abs(clientX - (rect.right + lineCenter)) <= halfZone;
      const nearBottom = Math.abs(clientY - (rect.bottom + lineCenter)) <= halfZone;
      const nearLeft = Math.abs(clientX - (rect.left - lineCenter)) <= halfZone;
      const nearTop = Math.abs(clientY - (rect.top - lineCenter)) <= halfZone;
      const isEdge = nearTop || nearRight || nearBottom || nearLeft;

      if (isEdge) {
        let cursor: string;
        if ((nearBottom && nearRight) || (nearTop && nearLeft)) cursor = "nwse-resize";
        else if ((nearTop && nearRight) || (nearBottom && nearLeft)) cursor = "nesw-resize";
        else if (nearTop || nearBottom) cursor = "ns-resize";
        else cursor = "ew-resize";
        this.gridEl.style.cursor = cursor;
        el.style.cursor = cursor;
        this.highlightOverlayEdge(true);
      } else {
        this.gridEl.style.cursor = "";
        el.style.cursor = "";
        this.highlightOverlayEdge(false);
      }
    } else if (el.querySelector("[data-grid-editing]")) {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.boxShadow = "";
    } else {
      el.style.outline = "1px solid var(--pages-neutral-6, #71717a)";
      el.style.outlineOffset = "-1px";
      el.style.boxShadow = "";
      el.style.cursor = "pointer";
    }
  }

  private clearItemHover(el: HTMLElement): void {
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.style.boxShadow = "";
    el.style.cursor = "";
    this.gridEl.style.cursor = "";
    this.highlightOverlayEdge(false);
  }

  private _toggleDragHandles(hoveredId: string | null): void {
    const bar = this._selectedEl?.querySelector("[data-drag-handle]") as HTMLElement | null;
    if (!bar) return;
    const selectedId = this._selectedEl?.dataset.itemId;
    bar.style.display = (hoveredId != null && hoveredId === selectedId) ? "flex" : "none";
  }

  private applySelectionOutlines(): void {
    clearSelectionOutlines(this.gridEl);
    for (const id of this.selection.items) {
      const el = this.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
      if (el) showSelectionOutline(el);
    }
  }

  private findItemAtPoint(px: number, py: number): { id: string; rect: DOMRect } | null {
    const selectedId = this.selection.items[0];
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.itemId == null) continue;
      const rect = el.getBoundingClientRect();
      const pad = el.dataset.itemId === selectedId ? 7 : 0;
      if (px >= rect.left - pad && px <= rect.right + pad && py >= rect.top - pad && py <= rect.bottom + pad) {
        return { id: el.dataset.itemId, rect };
      }
    }
    return null;
  }

  private dispatchEdit(type: string, items: IdRect[]): void {
    const now = performance.now();
    if (now - lastEditDispatchTime < 100) return;
    lastEditDispatchTime = now;
    const sorted = [...items].sort((a, b) => Number(a.id) - Number(b.id));
    const resolved: GridItem[] = sorted.map(rect => {
      const origIndex = Number(rect.id);
      const origItem = this.items[origIndex];
      return {
        at: { mode: "positioned" as const, x: rect.x, y: rect.y, w: rect.w, h: rect.h },
        ...(origItem?.component ? { component: origItem.component } : {}),
      };
    });
    this.gridEl.dispatchEvent(new CustomEvent("pages-grid-edit", {
      bubbles: true,
      composed: true,
      detail: { type, items: resolved, gridPath: getCoordinator().resolveGridPath(this) },
    }));
  }
}

export function attachGridEditController(
  gridEl: HTMLElement,
  items: readonly GridItem[],
  columns: number,
  rowHeight = 60,
): GridEditController {
  const existing = getCoordinator().getControllerForEl(gridEl);
  if (existing) {
    existing.dispose();
  }
  const controller = new GridEditControllerImpl(gridEl, items, columns, rowHeight);
  getCoordinator().register(controller);
  return controller;
}
