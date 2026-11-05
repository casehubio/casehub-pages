import type { GridItem } from "../model/types.js";
import type { PositionedPlacement, IdentifiedPlacement } from "./grid-collision.js";
import { resolveCollisions } from "./grid-collision.js";
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
  showGhost,
  hideGhost,
  createEditButton,
  removeEditButton,
  createInsertionZones,
  removeInsertionZones,
} from "./grid-overlay.js";

export interface GridEditController {
  readonly gridEl: HTMLElement;
  readonly items: readonly GridItem[];
  readonly columns: number;
  readonly active: boolean;
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
  private readonly rowHeight: number;
  private readonly gap: number;
  private geometry: GridGeometry | null = null;
  private overlay: HTMLDivElement | null = null;
  private observer: MutationObserver | null = null;
  private priorPosition = "";
  private _insertionZones: HTMLElement[] = [];

  private dragging = false;
  private dragItemId: string | null = null;
  private dragHandle: ResizeHandle | "move" = "move";
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginCell: CellCoord = { x: 0, y: 0 };
  private originalPlacements = new Map<string, PositionedPlacement>();

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
      createEditButton(gridEl, () => {
        if (this._active) this.exit();
        else this.enter();
      });
    }
  }

  get active(): boolean {
    return this._active;
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
    document.body.setAttribute("data-grid-editing-active", "");

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.componentId && el.firstElementChild) {
        (el.firstElementChild as HTMLElement).style.pointerEvents = "none";
      }
    }

    const rect = this.gridEl.getBoundingClientRect();
    this.geometry = computeGridGeometry(rect, this.columns, this.rowHeight, this.gap);
    this.overlay = createGridOverlay(this.gridEl, this.geometry);
    this._insertionZones = createInsertionZones(this.gridEl, this.geometry, this.items);

    this.gridEl.addEventListener("pointerdown", this.onPointerDown);
    this.gridEl.addEventListener("pointermove", this.onPointerMove);
    this.gridEl.addEventListener("pointerup", this.onPointerUp);
    this.gridEl.addEventListener("keydown", this.onKeyDown);

    this.storeOriginalPlacements();
  }

  exit(): void {
    if (!this._active) return;
    this._active = false;
    if (activeController === this) activeController = null;

    this.gridEl.removeAttribute("data-grid-editing");
    document.body.removeAttribute("data-grid-editing-active");
    this.gridEl.style.position = this.priorPosition;

    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (el.dataset.componentId && el.firstElementChild) {
        (el.firstElementChild as HTMLElement).style.pointerEvents = "";
      }
    }

    removeInsertionZones(this._insertionZones);
    removeGridOverlay(this.gridEl);
    this.overlay = null;

    this.gridEl.removeEventListener("pointerdown", this.onPointerDown);
    this.gridEl.removeEventListener("pointermove", this.onPointerMove);
    this.gridEl.removeEventListener("pointerup", this.onPointerUp);
    this.gridEl.removeEventListener("keydown", this.onKeyDown);

    this.restoreOriginalPlacements();
    this.dragging = false;
  }

  dispose(): void {
    this.exit();
    removeInsertionZones(this._insertionZones);
    removeEditButton(this.gridEl);
    this.observer?.disconnect();
    this.observer = null;
  }

  private storeOriginalPlacements(): void {
    this.originalPlacements.clear();
    for (const item of this.items) {
      if (item.placement.mode === "positioned") {
        const id = item.component.id ?? "";
        this.originalPlacements.set(id, { ...item.placement });
      }
    }
  }

  private restoreOriginalPlacements(): void {
    for (const [id, placement] of this.originalPlacements) {
      const el = this.gridEl.querySelector(`[data-component-id="${id}"]`) as HTMLElement | null;
      if (el) {
        applyGridPlacement(el, placement);
        el.style.opacity = "";
      }
    }
  }

  private getPositionedItems(): IdentifiedPlacement[] {
    return this.items
      .filter(i => i.placement.mode === "positioned")
      .map(i => ({
        id: i.component.id ?? "",
        placement: i.placement as PositionedPlacement,
      }));
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.dragging || !this.geometry) return;
    if ((e.target as HTMLElement).dataset.gridEditButton !== undefined) return;

    const target = this.findItemAtPoint(e.clientX, e.clientY);
    if (!target) return;

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragItemId = target.id;
    this.dragHandle = hitTestHandle(e.clientX, e.clientY, target.rect, e.pointerType) ?? "move";
    this.dragOriginCell = snapToCell(e.clientX, e.clientY, this.geometry);

    this.gridEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragItemId || !this.geometry) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;

    if (!this.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.storeOriginalPlacements();
      const el = this.gridEl.querySelector(`[data-component-id="${this.dragItemId}"]`) as HTMLElement | null;
      if (el) el.style.opacity = "0.4";
    }

    const cell = snapToCell(e.clientX, e.clientY, this.geometry);
    const items = this.getPositionedItems();
    const current = items.find(i => i.id === this.dragItemId);
    if (!current) return;

    const newPlacement = this.computeNewPlacement(current.placement, cell);
    const resolved = resolveCollisions(items, this.dragItemId, newPlacement);

    if (this.overlay) {
      showGhost(this.overlay, newPlacement.x, newPlacement.y, newPlacement.w, newPlacement.h, this.geometry);
    }

    for (const item of resolved) {
      if (item.id === this.dragItemId) continue;
      const el = this.gridEl.querySelector(`[data-component-id="${item.id}"]`) as HTMLElement | null;
      if (el) applyGridPlacement(el, item.placement);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.dragging || !this.dragItemId || !this.geometry) {
      this.dragItemId = null;
      return;
    }

    const cell = snapToCell(e.clientX, e.clientY, this.geometry);
    const items = this.getPositionedItems();
    const current = items.find(i => i.id === this.dragItemId);
    if (!current) {
      this.cancelDrag();
      return;
    }

    const newPlacement = this.computeNewPlacement(current.placement, cell);
    const resolved = resolveCollisions(items, this.dragItemId, newPlacement);

    for (const item of resolved) {
      const el = this.gridEl.querySelector(`[data-component-id="${item.id}"]`) as HTMLElement | null;
      if (el) {
        applyGridPlacement(el, item.placement);
        el.style.opacity = "";
      }
    }

    if (this.overlay) hideGhost(this.overlay);

    const resolvedItems: GridItem[] = this.items.map(gi => {
      if (gi.placement.mode !== "positioned") return gi;
      const id = gi.component.id ?? "";
      const updated = resolved.find(r => r.id === id);
      return updated ? { ...gi, placement: updated.placement } : gi;
    });

    const editType = this.dragHandle === "move" ? "move" : "resize";
    this.gridEl.dispatchEvent(new CustomEvent("pages-grid-edit", {
      bubbles: true,
      composed: true,
      detail: { type: editType, items: resolvedItems },
    }));

    this.dragging = false;
    this.dragItemId = null;
    this.storeOriginalPlacements();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (this.dragging) {
        this.cancelDrag();
      } else {
        this.exit();
      }
    }
  }

  private cancelDrag(): void {
    this.restoreOriginalPlacements();
    if (this.overlay) hideGhost(this.overlay);
    this.dragging = false;
    this.dragItemId = null;
  }

  private computeNewPlacement(original: PositionedPlacement, cell: CellCoord): PositionedPlacement {
    if (this.dragHandle === "move") {
      const offsetX = cell.x - this.dragOriginCell.x;
      const offsetY = cell.y - this.dragOriginCell.y;
      const clamped = clampPlacement(
        original.x + offsetX,
        original.y + offsetY,
        original.w,
        original.h,
        this.columns,
      );
      return { ...original, x: clamped.x, y: clamped.y };
    }
    return this.computeResize(original, cell);
  }

  private computeResize(original: PositionedPlacement, cell: CellCoord): PositionedPlacement {
    let { x, y, w, h } = original;
    const handle = this.dragHandle as ResizeHandle;

    if (handle.includes("right")) {
      w = Math.max(1, cell.x - x + 1);
    }
    if (handle.includes("bottom")) {
      h = Math.max(1, cell.y - y + 1);
    }
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
    return { mode: "positioned", x: clamped.x, y: clamped.y, w, h };
  }

  private findItemAtPoint(px: number, py: number): { id: string; rect: DOMRect } | null {
    for (const child of this.gridEl.children) {
      const el = child as HTMLElement;
      if (!el.dataset.componentId) continue;
      const rect = el.getBoundingClientRect();
      if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
        const id = el.dataset.componentId;
        const item = this.items.find(i => (i.component.id ?? "") === id);
        if (item?.placement.mode === "positioned") {
          return { id, rect };
        }
      }
    }
    return null;
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
