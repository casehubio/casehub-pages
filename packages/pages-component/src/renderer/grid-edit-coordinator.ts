import type { GridEditController } from "./grid-edit-controller.js";
import type { GridItem, GridPlacement, Component } from "../model/types.js";
import { scaleWidth } from "./grid-scale.js";
import { computeGridGeometry, snapToCell, clampPlacement } from "./grid-drag.js";
import type { IdRect } from "./grid-compaction.js";
import { compactAll } from "./grid-compaction.js";
import { applyGridPlacement } from "./grid.js";
import { showPlaceholder, hidePlaceholder } from "./grid-overlay.js";

const VIRTUAL_INCOMING_ID = "__incoming__";

export interface CrossGridEditDetail {
  type: "cross-move";
  sourceGridPath: (string | number)[];
  targetGridPath: (string | number)[];
  sourceIndex: number;
  targetPlacement: GridPlacement;
  component: Component;
  swapTargetIndex?: number;
  targetItemPlacements?: Array<{ index: number; x: number; y: number; w: number; h: number }>;
}

export class GridEditCoordinator {
  private _controllers = new Set<GridEditController>();
  private _parents = new Map<GridEditController, GridEditController | null>();
  private _dirty = true;
  private _unpinnedByPath = new Map<string, Set<string>>();
  private _crossGridState: {
    source: GridEditController;
    itemIndex: number;
    item: GridItem;
    intent: "displace" | "swap";
    currentTarget: GridEditController | null;
    displaceOriginals: Map<string, { x: number; y: number; w: number; h: number }> | null;
    displaceLastCell: { x: number; y: number } | null;
  } | null = null;

  get controllers(): ReadonlySet<GridEditController> {
    return this._controllers;
  }

  register(controller: GridEditController): void {
    this._controllers.add(controller);
    this._dirty = true;
  }

  deregister(controller: GridEditController): void {
    this._controllers.delete(controller);
    this._parents.delete(controller);
    this._dirty = true;
  }

  getControllerForEl(gridEl: HTMLElement): GridEditController | null {
    for (const c of this._controllers) {
      if (c.gridEl === gridEl) return c;
    }
    return null;
  }

  getParent(controller: GridEditController): GridEditController | null {
    this._rebuildIfDirty();
    return this._parents.get(controller) ?? null;
  }

  deepestGridAt(clientX: number, clientY: number): GridEditController | null {
    this._rebuildIfDirty();
    let deepest: GridEditController | null = null;
    let deepestDepth = -1;
    for (const c of this._controllers) {
      if (!c.active) continue;
      const rect = c.gridEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        const depth = this._depth(c);
        if (depth > deepestDepth) {
          deepestDepth = depth;
          deepest = c;
        }
      }
    }
    return deepest;
  }

  resolveGridPath(controller: GridEditController): (string | number)[] {
    const segments: (string | number)[] = [];
    let el: HTMLElement | null = controller.gridEl;
    while (el && el !== document.body) {
      if (el.dataset.itemId != null) {
        segments.unshift("grid", Number(el.dataset.itemId));
      }
      el = el.parentElement;
    }
    if (segments.length === 0) {
      return ["pages", 0, "grid"];
    }
    return ["pages", 0, ...segments, "grid"];
  }

  isPinned(controller: GridEditController, itemId: string): boolean {
    const key = this.resolveGridPath(controller).join(".");
    return !(this._unpinnedByPath.get(key)?.has(itemId) ?? false);
  }

  isChildOfUnpinnedItem(parent: GridEditController, child: GridEditController): boolean {
    this._rebuildIfDirty();
    if (this._parents.get(child) !== parent) return false;
    const itemEl = child.gridEl.closest("[data-item-id]") as HTMLElement | null;
    if (!itemEl) return false;
    return !this.isPinned(parent, itemEl.dataset.itemId!);
  }

  togglePin(controller: GridEditController, itemId: string): boolean {
    const key = this.resolveGridPath(controller).join(".");
    let set = this._unpinnedByPath.get(key);
    if (!set) { set = new Set(); this._unpinnedByPath.set(key, set); }
    if (set.has(itemId)) { set.delete(itemId); return true; }
    set.add(itemId);
    return false;
  }

  startCrossGridDrag(source: GridEditController, itemIndex: number, item: GridItem, intent: "displace" | "swap" = "swap"): void {
    this._crossGridState = { source, itemIndex, item, intent, currentTarget: null, displaceOriginals: null, displaceLastCell: null };
    source.releaseItem(itemIndex);
  }

  handleCrossGridMove(clientX: number, clientY: number): void {
    if (!this._crossGridState) return;
    const target = this.deepestGridAt(clientX, clientY);
    if (target === this._crossGridState.source) return;

    if (target !== this._crossGridState.currentTarget) {
      this._clearCrossGridHighlight();
      this._restoreDisplacement();
      this._crossGridState.currentTarget?.clearForeignItem();
      this._crossGridState.currentTarget = target;
    }

    if (target && target !== this._crossGridState.source) {
      const sourceAt = this._crossGridState.item.at;
      if (sourceAt.mode !== "positioned") return;
      const scaledW = scaleWidth(sourceAt.w, this._crossGridState.source.columns, target.columns);
      if (this._crossGridState.intent === "swap") {
        const hitEl = this._findItemElAt(target, clientX, clientY);
        this._highlightCrossGridTarget(target, hitEl);
        if (!hitEl) {
          const nextRow = this._nextAvailableRow(target);
          target.acceptForeignItem(this._crossGridState.item, {
            mode: "positioned", x: 0, y: nextRow, w: scaledW, h: sourceAt.h,
          });
        } else {
          target.clearForeignItem();
        }
      } else {
        this._handleDisplacePreview(target, clientX, clientY, scaledW, sourceAt.h);
      }
    }
  }

  private _handleDisplacePreview(target: GridEditController, clientX: number, clientY: number, scaledW: number, h: number): void {
    const state = this._crossGridState!;
    const geometry = computeGridGeometry(target.gridEl.getBoundingClientRect(), target.columns, target.rowHeight, target.gap);
    const cell = snapToCell(clientX, clientY, geometry);
    const clamped = clampPlacement(cell.x, cell.y, scaledW, h, target.columns);

    if (state.displaceLastCell && state.displaceLastCell.x === clamped.x && state.displaceLastCell.y === clamped.y) return;

    if (!state.displaceOriginals) {
      state.displaceOriginals = new Map();
      for (let i = 0; i < target.items.length; i++) {
        const item = target.items[i]!;
        if (item.at.mode === "positioned") {
          state.displaceOriginals.set(String(i), { x: item.at.x, y: item.at.y, w: item.at.w, h: item.at.h });
        }
      }
      state.source.setDragGhostVisible(false);
    }
    state.displaceLastCell = { x: clamped.x, y: clamped.y };

    const items: IdRect[] = [];
    for (const [id, p] of state.displaceOriginals) {
      items.push({ id, ...p });
    }
    const virtualTarget = { x: clamped.x, y: clamped.y, w: scaledW, h };
    items.push({ id: VIRTUAL_INCOMING_ID, ...virtualTarget });

    const pinnedIds = this._buildTargetPinnedIds(target);
    const resolved = compactAll(items, VIRTUAL_INCOMING_ID, virtualTarget, pinnedIds);

    const before = new Map<string, DOMRect>();
    for (const child of target.gridEl.children) {
      const el = child as HTMLElement;
      const id = el.dataset.itemId;
      if (id != null) {
        el.style.transition = "none";
        el.style.transform = "";
        before.set(id, el.getBoundingClientRect());
      }
    }

    for (const item of resolved) {
      if (item.id === VIRTUAL_INCOMING_ID) continue;
      const el = target.gridEl.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
      if (el) applyGridPlacement(el, { mode: "positioned", x: item.x, y: item.y, w: item.w, h: item.h });
    }

    const virtualResolved = resolved.find(i => i.id === VIRTUAL_INCOMING_ID);
    showPlaceholder(target.gridEl, virtualResolved ?? virtualTarget);

    for (const child of target.gridEl.children) {
      const el = child as HTMLElement;
      const id = el.dataset.itemId;
      if (id == null) continue;
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

  private _buildTargetPinnedIds(target: GridEditController): Set<string> | undefined {
    const pinned = new Set<string>();
    for (let i = 0; i < target.items.length; i++) {
      const el = target.gridEl.querySelector(`[data-item-id="${i}"]`) as HTMLElement | null;
      if (el?.querySelector('[data-grid-editing]') && this.isPinned(target, String(i))) {
        pinned.add(String(i));
      }
    }
    return pinned.size > 0 ? pinned : undefined;
  }

  private _restoreDisplacement(): void {
    const state = this._crossGridState;
    if (!state?.displaceOriginals || !state.currentTarget) return;
    const target = state.currentTarget;
    for (const [id, p] of state.displaceOriginals) {
      const el = target.gridEl.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
      if (el) {
        applyGridPlacement(el, { mode: "positioned", ...p });
        el.style.transform = "";
        el.style.transition = "";
      }
    }
    hidePlaceholder(target.gridEl);
    state.source.setDragGhostVisible(true);
    state.displaceOriginals = null;
    state.displaceLastCell = null;
  }

  private _findItemElAt(controller: GridEditController, clientX: number, clientY: number): HTMLElement | null {
    for (const child of controller.gridEl.children) {
      if (!(child instanceof HTMLElement) || child.dataset.itemId == null) continue;
      if (child.dataset.gridPlaceholder != null) continue;
      const r = child.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return child;
    }
    return null;
  }

  private _crossGridHighlightEl: HTMLElement | null = null;

  private _highlightCrossGridTarget(controller: GridEditController, el: HTMLElement | null): void {
    this._clearCrossGridHighlight();
    if (el) {
      el.style.outline = "2px solid var(--pages-accent-7, #3b82f6)";
      el.style.outlineOffset = "-2px";
      el.style.boxShadow = "inset 0 0 0 100px rgba(59, 130, 246, 0.1)";
      this._crossGridHighlightEl = el;
    }
  }

  private _clearCrossGridHighlight(): void {
    if (this._crossGridHighlightEl) {
      this._crossGridHighlightEl.style.outline = "";
      this._crossGridHighlightEl.style.outlineOffset = "";
      this._crossGridHighlightEl.style.boxShadow = "";
      this._crossGridHighlightEl = null;
    }
  }

  private _nextAvailableRow(controller: GridEditController): number {
    let maxRow = 0;
    for (const item of controller.items) {
      if (item.at.mode === "positioned") {
        maxRow = Math.max(maxRow, item.at.y + item.at.h);
      }
    }
    return maxRow;
  }

  completeCrossGridDrag(clientX: number, clientY: number): CrossGridEditDetail | null {
    if (!this._crossGridState) return null;
    this._clearCrossGridHighlight();
    const target = this.deepestGridAt(clientX, clientY);
    if (!target || target === this._crossGridState.source) {
      this.cancelCrossGridDrag();
      return null;
    }
    const { source, itemIndex, item, intent } = this._crossGridState;
    const sourceAt = item.at;
    if (sourceAt.mode !== "positioned") { this.cancelCrossGridDrag(); return null; }
    const scaledW = scaleWidth(sourceAt.w, source.columns, target.columns);

    let swapTargetIndex: number | undefined;
    let placement: { x: number; y: number; w: number; h: number };
    let targetItemPlacements: Array<{ index: number; x: number; y: number; w: number; h: number }> | undefined;

    if (intent === "swap") {
      const hitEl = this._findItemElAt(target, clientX, clientY);
      swapTargetIndex = hitEl ? Number(hitEl.dataset.itemId) : undefined;
      if (hitEl && swapTargetIndex != null) {
        const targetItem = target.items[swapTargetIndex];
        if (targetItem?.at.mode === "positioned") {
          placement = { x: targetItem.at.x, y: targetItem.at.y, w: scaledW, h: sourceAt.h };
        } else {
          placement = { x: 0, y: this._nextAvailableRow(target), w: scaledW, h: sourceAt.h };
        }
      } else {
        placement = { x: 0, y: this._nextAvailableRow(target), w: scaledW, h: sourceAt.h };
      }
    } else {
      const geometry = computeGridGeometry(
        target.gridEl.getBoundingClientRect(), target.columns, target.rowHeight, target.gap
      );
      const cell = snapToCell(clientX, clientY, geometry);
      const clamped = clampPlacement(cell.x, cell.y, scaledW, sourceAt.h, target.columns);

      const items: IdRect[] = [];
      for (let i = 0; i < target.items.length; i++) {
        const tItem = target.items[i]!;
        if (tItem.at.mode === "positioned") {
          items.push({ id: String(i), x: tItem.at.x, y: tItem.at.y, w: tItem.at.w, h: tItem.at.h });
        }
      }
      const virtualTarget = { x: clamped.x, y: clamped.y, w: scaledW, h: sourceAt.h };
      items.push({ id: VIRTUAL_INCOMING_ID, ...virtualTarget });
      const resolved = compactAll(items, VIRTUAL_INCOMING_ID, virtualTarget);

      const virtualResolved = resolved.find(r => r.id === VIRTUAL_INCOMING_ID);
      placement = virtualResolved
        ? { x: virtualResolved.x, y: virtualResolved.y, w: virtualResolved.w, h: virtualResolved.h }
        : { x: clamped.x, y: clamped.y, w: scaledW, h: sourceAt.h };

      targetItemPlacements = resolved
        .filter(r => r.id !== VIRTUAL_INCOMING_ID)
        .map(r => ({ index: Number(r.id), x: r.x, y: r.y, w: r.w, h: r.h }));
    }

    const detail: CrossGridEditDetail = {
      type: "cross-move",
      sourceGridPath: this.resolveGridPath(source),
      targetGridPath: this.resolveGridPath(target),
      sourceIndex: itemIndex,
      targetPlacement: { mode: "positioned", ...placement },
      component: item.component!,
      swapTargetIndex,
      targetItemPlacements,
    };
    target.clearForeignItem();
    this._restoreDisplacement();
    this._crossGridState = null;
    return detail;
  }

  cancelCrossGridDrag(): void {
    if (!this._crossGridState) return;
    this._clearCrossGridHighlight();
    this._restoreDisplacement();
    this._crossGridState.currentTarget?.clearForeignItem();
    const el = this._crossGridState.source.gridEl.querySelector(
      `[data-item-id="${this._crossGridState.itemIndex}"]`
    ) as HTMLElement | null;
    if (el) el.style.display = "";
    this._crossGridState = null;
  }

  private _rebuildIfDirty(): void {
    if (!this._dirty) return;
    this._dirty = false;
    this._parents.clear();
    const controllers = [...this._controllers];
    for (const child of controllers) {
      let parent: GridEditController | null = null;
      for (const candidate of controllers) {
        if (candidate === child) continue;
        if (candidate.gridEl.contains(child.gridEl)) {
          if (!parent || parent.gridEl.contains(candidate.gridEl)) {
            parent = candidate;
          }
        }
      }
      this._parents.set(child, parent);
    }
  }

  private _depth(controller: GridEditController): number {
    let d = 0;
    let c: GridEditController | null = controller;
    while (c) {
      c = this._parents.get(c) ?? null;
      if (c) d++;
    }
    return d;
  }
}

let coordinator: GridEditCoordinator | null = null;

export function getCoordinator(): GridEditCoordinator {
  if (!coordinator) coordinator = new GridEditCoordinator();
  return coordinator;
}
