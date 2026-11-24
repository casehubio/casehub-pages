import type { PageDocument, PageNode } from '@casehubio/pages-document';
import type { GridPlacement, GridItem } from '@casehubio/pages-component';
import type { CrossGridEditDetail } from '@casehubio/pages-component';
import { compact } from '@casehubio/pages-component';
import { isSeq, isMap, type YAMLSeq, type YAMLMap } from 'yaml';

export type GridEditDetail =
  | { type: 'move'; items: GridItem[]; gridPath?: (string | number)[] }
  | { type: 'resize'; items: GridItem[]; gridPath?: (string | number)[] }
  | { type: 'insert'; placement: GridPlacement; componentType: string; gridPath?: (string | number)[] }
  | { type: 'split'; targetIndex: number; direction: 'horizontal' | 'vertical'; gridPath?: (string | number)[] }
  | { type: 'merge'; indices: number[]; gridPath?: (string | number)[] }
  | { type: 'swap'; indexA: number; indexB: number; gridPath?: (string | number)[] }
  | { type: 'remove'; index: number; gridPath?: (string | number)[] }
  | { type: 'add-empty'; placement: GridPlacement; gridPath?: (string | number)[] };

export class GridEditBridge {
  applyGridEdit(doc: PageDocument, detail: GridEditDetail): void {
    const gp = detail.gridPath;
    switch (detail.type) {
      case 'move':
      case 'resize': {
        doc.beginTransaction();
        try {
          this._applyPlacements(doc, detail.items, gp);
          if (!gp) {
            const page = doc.getPages()[0];
            if (page && (page.getLayoutMode() === 'grid' || page.getLayoutMode() === 'items')) {
              this._compactGrid(page);
            }
          }
          doc.commitTransaction();
        } catch (e) {
          doc.abortTransaction();
          throw e;
        }
        break;
      }
      case 'insert':
        this._insertItem(doc, detail.placement, detail.componentType, gp);
        break;
      case 'split':
        this._splitItem(doc, detail.targetIndex, detail.direction, gp);
        break;
      case 'merge':
        this._mergeItems(doc, detail.indices, gp);
        break;
      case 'swap':
        this._swapItems(doc, detail.indexA, detail.indexB, gp);
        break;
      case 'remove':
        this._removeItem(doc, detail.index, gp);
        break;
      case 'add-empty':
        this._addEmptyContainer(doc, detail.placement, gp);
        break;
    }
  }

  private _applyPlacements(doc: PageDocument, items: GridItem[], gridPath?: (string | number)[]): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      for (let i = 0; i < items.length && i < (seq as YAMLSeq).items.length; i++) {
        const eventAt = items[i]!.at;
        if (eventAt.mode !== 'positioned') continue;
        const entry = seq.get(i, true);
        if (!isMap(entry)) continue;
        const at = entry.get('at', true);
        const currentAt = isMap(at) ? at.toJSON() as Record<string, unknown> : undefined;
        if (currentAt && currentAt.x === eventAt.x && currentAt.y === eventAt.y &&
            currentAt.w === eventAt.w && currentAt.h === eventAt.h &&
            (currentAt.fixedWidth ?? undefined) === (eventAt.fixedWidth ?? undefined)) continue;
        const atObj: Record<string, number> = { x: eventAt.x, y: eventAt.y, w: eventAt.w, h: eventAt.h };
        if (eventAt.fixedWidth != null) atObj['fixedWidth'] = eventAt.fixedWidth;
        const atNode = yamlDoc.createNode(atObj);
        entry.set('at', atNode);
      }
      return;
    }
    const page = doc.getPages()[0];
    if (!page) return;
    const mode = page.getLayoutMode();
    if (mode !== 'grid' && mode !== 'items') {
      this._convertToGrid(doc, page, items);
      return;
    }
    const gridItems = page.getItems();
    for (let i = 0; i < items.length && i < gridItems.length; i++) {
      const eventPlacement = items[i]!.at;
      const current = gridItems[i]!.getPlacement();
      if (!this._placementEqual(current, eventPlacement)) {
        gridItems[i]!.setPlacement(eventPlacement);
      }
    }
  }

  private _convertToGrid(doc: PageDocument, page: PageNode, eventItems: GridItem[]): void {
    const mode = page.getLayoutMode();
    const yamlDoc = doc._getDoc();
    const pagePath = [...page.path];

    const componentJsons: Record<string, unknown>[] = [];
    if (mode === 'flat') {
      const comps = page.getComponents();
      for (const comp of comps) {
        const node = yamlDoc.getIn([...comp.path]);
        componentJsons.push(isMap(node) ? node.toJSON() as Record<string, unknown> : { type: comp.type });
      }
      yamlDoc.deleteIn([...pagePath, 'flat']);
      yamlDoc.deleteIn([...pagePath, 'components']);
    }

    const entries = componentJsons.map((compJson, i) => {
      const ep = eventItems[i]?.at ?? { mode: 'positioned' as const, x: 0, y: i, w: 12, h: 1 };
      const atObj: Record<string, number> = { w: ep.w, h: ep.h };
      if (ep.mode === 'positioned') {
        atObj['x'] = ep.x;
        atObj['y'] = ep.y;
      }
      return { at: atObj, ...(compJson ?? {}) };
    });

    const gridNode = yamlDoc.createNode(entries);
    yamlDoc.setIn([...pagePath, 'grid'], gridNode);
  }

  private _insertItem(
    doc: PageDocument,
    placement: GridPlacement,
    componentType: string,
    gridPath?: (string | number)[],
  ): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      const atBase = placement.mode === 'positioned'
        ? { x: placement.x, y: placement.y, w: placement.w, h: placement.h }
        : { w: placement.w, h: placement.h };
      const atObj = placement.fixedWidth != null ? { ...atBase, fixedWidth: placement.fixedWidth } : atBase;
      const node = yamlDoc.createNode({ at: atObj, type: componentType });
      (seq as YAMLSeq).add(node);
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addItem(placement, componentType);
  }

  private _splitItem(
    doc: PageDocument,
    targetIndex: number,
    direction: 'horizontal' | 'vertical',
    gridPath?: (string | number)[],
  ): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      const entry = (seq as YAMLSeq).get(targetIndex, true);
      if (!isMap(entry)) return;
      const at = (entry as YAMLMap).get('at', true);
      if (!isMap(at)) return;
      const p = (at as YAMLMap).toJSON() as { x: number; y: number; w: number; h: number; fixedWidth?: number };

      doc.beginTransaction();
      try {
        if (direction === 'horizontal') {
          const topH = Math.floor(p.h / 2);
          const bottomH = p.h - topH;
          const topAt: Record<string, number> = { x: p.x, y: p.y, w: p.w, h: topH };
          if (p.fixedWidth != null) topAt['fixedWidth'] = p.fixedWidth;
          (entry as YAMLMap).set('at', yamlDoc.createNode(topAt));
          (seq as YAMLSeq).add(yamlDoc.createNode({ at: { x: p.x, y: p.y + topH, w: p.w, h: bottomH }, type: 'markdown', properties: { content: ' ' } }));
        } else {
          const leftW = Math.floor(p.w / 2);
          const rightW = p.w - leftW;
          const leftAt: Record<string, number> = { x: p.x, y: p.y, w: leftW, h: p.h };
          if (p.fixedWidth != null) leftAt['fixedWidth'] = p.fixedWidth;
          (entry as YAMLMap).set('at', yamlDoc.createNode(leftAt));
          (seq as YAMLSeq).add(yamlDoc.createNode({ at: { x: p.x + leftW, y: p.y, w: rightW, h: p.h }, type: 'markdown', properties: { content: ' ' } }));
        }
        doc.commitTransaction();
      } catch (e) {
        doc.abortTransaction();
        throw e;
      }
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    const items = page.getItems();
    const target = items[targetIndex];
    if (!target) return;
    const p = target.getPlacement();
    if (p.mode !== 'positioned') return;

    doc.beginTransaction();
    try {
      if (direction === 'horizontal') {
        const topH = Math.floor(p.h / 2);
        const bottomH = p.h - topH;
        const topP: GridPlacement = { mode: 'positioned', x: p.x, y: p.y, w: p.w, h: topH };
        target.setPlacement(p.fixedWidth != null ? { ...topP, fixedWidth: p.fixedWidth } : topP);
        page.addItem({ mode: 'positioned', x: p.x, y: p.y + topH, w: p.w, h: bottomH }, 'markdown', { content: ' ' });
      } else {
        const leftW = Math.floor(p.w / 2);
        const rightW = p.w - leftW;
        const leftP: GridPlacement = { mode: 'positioned', x: p.x, y: p.y, w: leftW, h: p.h };
        target.setPlacement(p.fixedWidth != null ? { ...leftP, fixedWidth: p.fixedWidth } : leftP);
        page.addItem({ mode: 'positioned', x: p.x + leftW, y: p.y, w: rightW, h: p.h }, 'markdown', { content: ' ' });
      }
      doc.commitTransaction();
    } catch (e) {
      doc.abortTransaction();
      throw e;
    }
  }

  private _mergeItems(doc: PageDocument, indices: number[], gridPath?: (string | number)[]): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      const placements = indices
        .map(i => {
          const e = (seq as YAMLSeq).get(i, true);
          if (!isMap(e)) return null;
          const at = (e as YAMLMap).get('at', true);
          if (!isMap(at)) return null;
          const p = (at as YAMLMap).toJSON() as { x: number; y: number; w: number; h: number };
          return { index: i, ...p };
        })
        .filter((e): e is { index: number; x: number; y: number; w: number; h: number } => e !== null);
      if (placements.length < 2) return;

      const minX = Math.min(...placements.map(p => p.x));
      const minY = Math.min(...placements.map(p => p.y));
      const maxX = Math.max(...placements.map(p => p.x + p.w));
      const maxY = Math.max(...placements.map(p => p.y + p.h));

      doc.beginTransaction();
      try {
        const keepIndex = indices[0]!;
        const removeIndices = [...indices].filter(i => i !== keepIndex).sort((a, b) => b - a);
        for (const idx of removeIndices) {
          (seq as YAMLSeq).delete(idx);
        }
        const adjustedKeep = keepIndex - removeIndices.filter(i => i < keepIndex).length;
        const kept = (seq as YAMLSeq).get(adjustedKeep, true);
        if (isMap(kept)) {
          (kept as YAMLMap).set('at', yamlDoc.createNode({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }));
        }
        doc.commitTransaction();
      } catch (e) {
        doc.abortTransaction();
        throw e;
      }
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    const items = page.getItems();
    const placements = indices
      .map(i => ({ index: i, placement: items[i]?.getPlacement() }))
      .filter((e): e is { index: number; placement: Extract<GridPlacement, { mode: 'positioned' }> } =>
        e.placement?.mode === 'positioned');
    if (placements.length < 2) return;

    const minX = Math.min(...placements.map(p => p.placement.x));
    const minY = Math.min(...placements.map(p => p.placement.y));
    const maxX = Math.max(...placements.map(p => p.placement.x + p.placement.w));
    const maxY = Math.max(...placements.map(p => p.placement.y + p.placement.h));

    doc.beginTransaction();
    try {
      const keepIndex = indices[0]!;
      const removeIndices = [...indices].filter(i => i !== keepIndex).sort((a, b) => b - a);
      for (const idx of removeIndices) {
        page.removeItem(idx);
      }

      const updatedItems = page.getItems();
      const adjustedKeep = keepIndex - removeIndices.filter(i => i < keepIndex).length;
      updatedItems[adjustedKeep]?.setPlacement({
        mode: 'positioned', x: minX, y: minY, w: maxX - minX, h: maxY - minY,
      });
      this._compactGrid(page);
      doc.commitTransaction();
    } catch (e) {
      doc.abortTransaction();
      throw e;
    }
  }

  private _swapItems(doc: PageDocument, indexA: number, indexB: number, gridPath?: (string | number)[]): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      const entryA = (seq as YAMLSeq).get(indexA, true);
      const entryB = (seq as YAMLSeq).get(indexB, true);
      if (!isMap(entryA) || !isMap(entryB)) return;
      const atA = (entryA as YAMLMap).get('at', true);
      const atB = (entryB as YAMLMap).get('at', true);
      if (!isMap(atA) || !isMap(atB)) return;
      doc.beginTransaction();
      try {
        (entryA as YAMLMap).set('at', (atB as YAMLMap).clone());
        (entryB as YAMLMap).set('at', (atA as YAMLMap).clone());
        doc.commitTransaction();
      } catch (e) {
        doc.abortTransaction();
        throw e;
      }
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    const items = page.getItems();
    const a = items[indexA];
    const b = items[indexB];
    if (!a || !b) return;
    const placementA = a.getPlacement();
    const placementB = b.getPlacement();
    doc.beginTransaction();
    try {
      a.setPlacement(placementB);
      b.setPlacement(placementA);
      doc.commitTransaction();
    } catch (e) {
      doc.abortTransaction();
      throw e;
    }
  }

  private _removeItem(doc: PageDocument, index: number, gridPath?: (string | number)[]): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      doc.beginTransaction();
      try {
        (seq as YAMLSeq).delete(index);
        doc.commitTransaction();
      } catch (e) {
        doc.abortTransaction();
        throw e;
      }
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    doc.beginTransaction();
    try {
      page.removeItem(index);
      this._compactGrid(page);
      doc.commitTransaction();
    } catch (e) {
      doc.abortTransaction();
      throw e;
    }
  }

  private _addEmptyContainer(doc: PageDocument, placement: GridPlacement, gridPath?: (string | number)[]): void {
    if (gridPath) {
      const yamlDoc = doc._getDoc();
      const seq = yamlDoc.getIn(gridPath);
      if (!isSeq(seq)) return;
      const atBase = placement.mode === 'positioned'
        ? { x: placement.x, y: placement.y, w: placement.w, h: placement.h }
        : { w: placement.w, h: placement.h };
      const atObj = placement.fixedWidth != null ? { ...atBase, fixedWidth: placement.fixedWidth } : atBase;
      (seq as YAMLSeq).add(yamlDoc.createNode({ at: atObj }));
      return;
    }
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addEmptyItem(placement);
  }

  private _compactGrid(page: PageNode): void {
    const items = page.getItems();
    const rects = items.map((item, i) => {
      const p = item.getPlacement();
      return p.mode === 'positioned' ? { id: String(i), x: p.x, y: p.y, w: p.w, h: p.h } : null;
    }).filter((r): r is { id: string; x: number; y: number; w: number; h: number } => r !== null);
    if (rects.length === 0) return;
    const compacted = compact(rects);
    for (const rect of compacted) {
      const item = items[Number(rect.id)];
      if (!item) continue;
      const p = item.getPlacement();
      if (p.mode === 'positioned' && p.y !== rect.y) {
        const compactedP: GridPlacement = { mode: 'positioned', x: p.x, y: rect.y, w: p.w, h: p.h };
        item.setPlacement(p.fixedWidth != null ? { ...compactedP, fixedWidth: p.fixedWidth } : compactedP);
      }
    }
  }

  applyCrossGridEdit(doc: PageDocument, detail: CrossGridEditDetail): void {
    doc._pushUndoInternal();
    const yamlDoc = doc._getDoc();
    const sourceSeq = yamlDoc.getIn(detail.sourceGridPath);
    const targetSeq = yamlDoc.getIn(detail.targetGridPath);
    if (!isSeq(sourceSeq) || !isSeq(targetSeq)) return;

    if (detail.swapTargetIndex != null) {
      const swapNode = targetSeq.get(detail.swapTargetIndex, true);
      const sourceNode = sourceSeq.get(detail.sourceIndex, true);
      if (isMap(swapNode) && isMap(sourceNode)) {
        const sourceAt = sourceNode.get('at', true);
        const tp = detail.targetPlacement;
        const sourceAtBase = tp.mode === 'positioned' ? { x: tp.x, y: tp.y, w: tp.w, h: tp.h } : { w: tp.w, h: tp.h };
        const newSourceAt = yamlDoc.createNode(tp.fixedWidth != null ? { ...sourceAtBase, fixedWidth: tp.fixedWidth } : sourceAtBase);
        sourceSeq.delete(detail.sourceIndex);
        targetSeq.delete(detail.swapTargetIndex);
        const movedSource = sourceNode.clone() as YAMLMap;
        movedSource.set('at', newSourceAt);
        targetSeq.add(movedSource);
        const movedTarget = swapNode.clone() as YAMLMap;
        movedTarget.set('at', isMap(sourceAt) ? sourceAt.clone() : yamlDoc.createNode({ w: 1, h: 1 }));
        sourceSeq.add(movedTarget);
      }
    } else {
      sourceSeq.delete(detail.sourceIndex);
      if (detail.targetItemPlacements) {
        for (const tp of detail.targetItemPlacements) {
          const existingEntry = targetSeq.get(tp.index, true);
          if (isMap(existingEntry)) {
            const atNode = yamlDoc.createNode({ x: tp.x, y: tp.y, w: tp.w, h: tp.h });
            existingEntry.set('at', atNode);
          }
        }
      }
      const tp = detail.targetPlacement;
      const atObj: Record<string, number> = tp.mode === 'positioned'
        ? { x: tp.x, y: tp.y, w: tp.w, h: tp.h }
        : { w: tp.w, h: tp.h };
      if (tp.fixedWidth != null) atObj['fixedWidth'] = tp.fixedWidth;
      const entry: Record<string, unknown> = { at: atObj };
      if (detail.component) {
        entry['type'] = detail.component.type;
        if (detail.component.props) entry['properties'] = detail.component.props;
      }
      const targetNode = yamlDoc.createNode(entry);
      targetSeq.add(targetNode);
    }
    doc._notifyInternal();
  }

  private _placementEqual(a: GridPlacement, b: GridPlacement): boolean {
    if (a.mode !== b.mode || a.w !== b.w || a.h !== b.h) return false;
    if (a.mode === 'positioned' && b.mode === 'positioned') {
      return a.x === b.x && a.y === b.y;
    }
    return true;
  }
}
