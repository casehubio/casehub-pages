import type { PageDocument, PageNode } from '@casehubio/pages-document';
import type { GridPlacement, GridItem } from '@casehubio/pages-component';

export type GridEditDetail =
  | { type: 'move'; items: GridItem[] }
  | { type: 'resize'; items: GridItem[] }
  | { type: 'insert'; placement: GridPlacement; componentType: string }
  | { type: 'split'; targetIndex: number; direction: 'horizontal' | 'vertical' }
  | { type: 'merge'; indices: number[] }
  | { type: 'swap'; indexA: number; indexB: number }
  | { type: 'remove'; index: number }
  | { type: 'add-empty'; placement: GridPlacement };

export class GridEditBridge {
  applyGridEdit(doc: PageDocument, detail: GridEditDetail): void {
    switch (detail.type) {
      case 'move':
      case 'resize':
        this._applyPlacements(doc, detail.items);
        break;
      case 'insert':
        this._insertItem(doc, detail.placement, detail.componentType);
        break;
      case 'split':
        this._splitItem(doc, detail.targetIndex, detail.direction);
        break;
      case 'merge':
        this._mergeItems(doc, detail.indices);
        break;
      case 'swap':
        this._swapItems(doc, detail.indexA, detail.indexB);
        break;
      case 'remove':
        this._removeItem(doc, detail.index);
        break;
      case 'add-empty':
        this._addEmptyContainer(doc, detail.placement);
        break;
    }
  }

  private _applyPlacements(doc: PageDocument, items: GridItem[]): void {
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
  ): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addItem(placement, componentType);
  }

  private _splitItem(
    doc: PageDocument,
    targetIndex: number,
    direction: 'horizontal' | 'vertical',
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
      page.addEmptyItem({ mode: 'positioned', x: p.x, y: p.y + topH, w: p.w, h: bottomH });
    } else {
      const leftW = Math.floor(p.w / 2);
      const rightW = p.w - leftW;
      target.setPlacement({ mode: 'positioned', x: p.x, y: p.y, w: leftW, h: p.h });
      page.addEmptyItem({ mode: 'positioned', x: p.x + leftW, y: p.y, w: rightW, h: p.h });
    }
  }

  private _mergeItems(doc: PageDocument, indices: number[]): void {
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

  private _swapItems(doc: PageDocument, indexA: number, indexB: number): void {
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

  private _removeItem(doc: PageDocument, index: number): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.removeItem(index);
  }

  private _addEmptyContainer(doc: PageDocument, placement: GridPlacement): void {
    const page = doc.getPages()[0];
    { const m = page?.getLayoutMode(); if (!page || (m !== 'grid' && m !== 'items')) return; }
    page.addEmptyItem(placement);
  }

  private _placementEqual(a: GridPlacement, b: GridPlacement): boolean {
    if (a.mode !== b.mode || a.w !== b.w || a.h !== b.h) return false;
    if (a.mode === 'positioned' && b.mode === 'positioned') {
      return a.x === b.x && a.y === b.y;
    }
    return true;
  }
}
