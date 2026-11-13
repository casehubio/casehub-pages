import type { PageDocument, PageNode } from '@casehubio/pages-document';
import type { GridPlacement, GridItem, Component } from '@casehubio/pages-component';
import type { CrossGridEditDetail } from '@casehubio/pages-component';
import { isSeq, type YAMLSeq } from 'yaml';

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
      case 'resize':
        this._applyPlacements(doc, detail.items, gp);
        break;
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
        const entry = (seq as YAMLSeq).get(i) as any;
        if (!entry) continue;
        const currentAt = entry.get?.('at')?.toJSON?.();
        if (currentAt && currentAt.x === eventAt.x && currentAt.y === eventAt.y &&
            currentAt.w === eventAt.w && currentAt.h === eventAt.h) continue;
        const atNode = yamlDoc.createNode({ x: eventAt.x, y: eventAt.y, w: eventAt.w, h: eventAt.h });
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
        componentJsons.push(yamlDoc.getIn([...comp.path])?.toJSON?.() ?? { type: comp.type });
      }
      yamlDoc.deleteIn([...pagePath, 'flat']);
      yamlDoc.deleteIn([...pagePath, 'components']);
    } else if (mode === 'rows') {
      const rows = page.getRows();
      for (const row of rows) {
        for (const col of row.getColumns()) {
          for (const comp of col.getComponents()) {
            componentJsons.push(yamlDoc.getIn([...comp.path])?.toJSON?.() ?? { type: comp.type });
          }
        }
      }
      yamlDoc.deleteIn([...pagePath, 'rows']);
    } else if (mode === 'columns') {
      const cols = page.getColumns();
      for (const col of cols) {
        for (const comp of col.getComponents()) {
          componentJsons.push(yamlDoc.getIn([...comp.path])?.toJSON?.() ?? { type: comp.type });
        }
      }
      yamlDoc.deleteIn([...pagePath, 'columns']);
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
    _gridPath?: (string | number)[],
  ): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addItem(placement, componentType);
  }

  private _splitItem(
    doc: PageDocument,
    targetIndex: number,
    direction: 'horizontal' | 'vertical',
    _gridPath?: (string | number)[],
  ): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    const items = page.getItems();
    const target = items[targetIndex];
    if (!target) return;
    const p = target.getPlacement();
    if (p.mode !== 'positioned') return;

    if (direction === 'horizontal') {
      const topH = Math.floor(p.h / 2);
      const bottomH = p.h - topH;
      target.setPlacement({ mode: 'positioned', x: p.x, y: p.y, w: p.w, h: topH });
      page.addItem({ mode: 'positioned', x: p.x, y: p.y + topH, w: p.w, h: bottomH }, 'markdown', { content: ' ' });
    } else {
      const leftW = Math.floor(p.w / 2);
      const rightW = p.w - leftW;
      target.setPlacement({ mode: 'positioned', x: p.x, y: p.y, w: leftW, h: p.h });
      page.addItem({ mode: 'positioned', x: p.x + leftW, y: p.y, w: rightW, h: p.h }, 'markdown', { content: ' ' });
    }
  }

  private _mergeItems(doc: PageDocument, indices: number[], _gridPath?: (string | number)[]): void {
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
  }

  private _swapItems(doc: PageDocument, indexA: number, indexB: number, _gridPath?: (string | number)[]): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    const items = page.getItems();
    const a = items[indexA];
    const b = items[indexB];
    if (!a || !b) return;
    const placementA = a.getPlacement();
    const placementB = b.getPlacement();
    a.setPlacement(placementB);
    b.setPlacement(placementA);
  }

  private _removeItem(doc: PageDocument, index: number, _gridPath?: (string | number)[]): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.removeItem(index);
  }

  private _addEmptyContainer(doc: PageDocument, placement: GridPlacement, _gridPath?: (string | number)[]): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addEmptyItem(placement);
  }

  applyCrossGridEdit(doc: PageDocument, detail: CrossGridEditDetail): void {
    doc._pushUndoInternal();
    const yamlDoc = doc._getDoc();
    const sourceSeq = yamlDoc.getIn(detail.sourceGridPath) as YAMLSeq;
    const targetSeq = yamlDoc.getIn(detail.targetGridPath) as YAMLSeq;

    if (detail.swapTargetIndex != null) {
      const swapNode = targetSeq.get(detail.swapTargetIndex, true) as any;
      const sourceNode = sourceSeq.get(detail.sourceIndex, true) as any;
      if (swapNode && sourceNode) {
        const swapAt = swapNode.get('at', true);
        const sourceAt = sourceNode.get('at', true);
        const tp = detail.targetPlacement;
        const newSourceAt = yamlDoc.createNode(tp.mode === 'positioned' ? { x: tp.x, y: tp.y, w: tp.w, h: tp.h } : { w: tp.w, h: tp.h });
        sourceSeq.delete(detail.sourceIndex);
        targetSeq.delete(detail.swapTargetIndex);
        const movedSource = yamlDoc.createNode((sourceNode as any).toJSON());
        (movedSource as any).set('at', newSourceAt);
        targetSeq.add(movedSource);
        const movedTarget = yamlDoc.createNode((swapNode as any).toJSON());
        (movedTarget as any).set('at', yamlDoc.createNode((sourceAt as any).toJSON()));
        sourceSeq.add(movedTarget);
      }
    } else {
      sourceSeq.delete(detail.sourceIndex);
      if (detail.targetItemPlacements) {
        for (const tp of detail.targetItemPlacements) {
          const existingEntry = (targetSeq as YAMLSeq).get(tp.index) as any;
          if (existingEntry) {
            const atNode = yamlDoc.createNode({ x: tp.x, y: tp.y, w: tp.w, h: tp.h });
            existingEntry.set('at', atNode);
          }
        }
      }
      const tp = detail.targetPlacement;
      const atObj: Record<string, number> = tp.mode === 'positioned'
        ? { x: tp.x, y: tp.y, w: tp.w, h: tp.h }
        : { w: tp.w, h: tp.h };
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
