import type { GridEditController } from "./grid-edit-controller.js";
import type { GridItem, GridPlacement, Component } from "../model/types.js";
import { scaleWidth } from "./grid-scale.js";
import { computeGridGeometry, snapToCell, clampPlacement } from "./grid-drag.js";

export interface CrossGridEditDetail {
  type: "cross-move";
  sourceGridPath: (string | number)[];
  targetGridPath: (string | number)[];
  sourceIndex: number;
  targetPlacement: GridPlacement;
  component: Component;
}

export class GridEditCoordinator {
  private _controllers = new Set<GridEditController>();
  private _parents = new Map<GridEditController, GridEditController | null>();
  private _dirty = true;
  private _crossGridState: {
    source: GridEditController;
    itemIndex: number;
    item: GridItem;
    currentTarget: GridEditController | null;
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

  startCrossGridDrag(source: GridEditController, itemIndex: number, item: GridItem): void {
    this._crossGridState = { source, itemIndex, item, currentTarget: null };
    source.releaseItem(itemIndex);
  }

  handleCrossGridMove(clientX: number, clientY: number): void {
    if (!this._crossGridState) return;
    const target = this.deepestGridAt(clientX, clientY);
    if (target === this._crossGridState.source) return;

    if (target !== this._crossGridState.currentTarget) {
      this._crossGridState.currentTarget?.clearForeignItem();
      this._crossGridState.currentTarget = target;
    }

    if (target && target !== this._crossGridState.source) {
      const sourceItem = this._crossGridState.item;
      const sourceAt = sourceItem.at;
      if (sourceAt.mode !== "positioned") return;
      const scaledW = scaleWidth(sourceAt.w, this._crossGridState.source.columns, target.columns);
      const geometry = computeGridGeometry(
        target.gridEl.getBoundingClientRect(), target.columns, 60, 12
      );
      const cell = snapToCell(clientX, clientY, geometry);
      const clamped = clampPlacement(cell.x, cell.y, scaledW, sourceAt.h, target.columns);
      target.acceptForeignItem(sourceItem, {
        mode: "positioned", x: clamped.x, y: clamped.y, w: scaledW, h: sourceAt.h,
      });
    }
  }

  completeCrossGridDrag(clientX: number, clientY: number): CrossGridEditDetail | null {
    if (!this._crossGridState) return null;
    const target = this.deepestGridAt(clientX, clientY);
    if (!target || target === this._crossGridState.source) {
      this.cancelCrossGridDrag();
      return null;
    }
    const { source, itemIndex, item } = this._crossGridState;
    const sourceAt = item.at;
    if (sourceAt.mode !== "positioned") { this.cancelCrossGridDrag(); return null; }
    const scaledW = scaleWidth(sourceAt.w, source.columns, target.columns);
    const geometry = computeGridGeometry(
      target.gridEl.getBoundingClientRect(), target.columns, 60, 12
    );
    const cell = snapToCell(clientX, clientY, geometry);
    const clamped = clampPlacement(cell.x, cell.y, scaledW, sourceAt.h, target.columns);
    const detail: CrossGridEditDetail = {
      type: "cross-move",
      sourceGridPath: this.resolveGridPath(source),
      targetGridPath: this.resolveGridPath(target),
      sourceIndex: itemIndex,
      targetPlacement: { mode: "positioned", x: clamped.x, y: clamped.y, w: scaledW, h: sourceAt.h },
      component: item.component!,
    };
    target.clearForeignItem();
    this._crossGridState = null;
    return detail;
  }

  cancelCrossGridDrag(): void {
    if (!this._crossGridState) return;
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
