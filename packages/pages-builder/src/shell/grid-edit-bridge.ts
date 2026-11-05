import type { PageDocument } from '@casehubio/pages-document';
import type { GridPlacement, GridItem } from '@casehubio/pages-component';

export type GridEditDetail =
  | { type: 'move'; items: GridItem[] }
  | { type: 'resize'; items: GridItem[] }
  | { type: 'insert'; placement: GridPlacement; componentType: string };

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
    }
  }

  private _applyPlacements(doc: PageDocument, items: GridItem[]): void {
    const page = doc.getPages()[0];
    if (!page) return;
    if (page.getLayoutMode() !== 'items') return;
    const gridItems = page.getItems();
    for (let i = 0; i < items.length && i < gridItems.length; i++) {
      const eventPlacement = items[i]!.placement;
      const current = gridItems[i]!.getPlacement();
      if (!this._placementEqual(current, eventPlacement)) {
        gridItems[i]!.setPlacement(eventPlacement);
      }
    }
  }

  private _insertItem(
    doc: PageDocument,
    placement: GridPlacement,
    componentType: string,
  ): void {
    const page = doc.getPages()[0];
    if (!page || page.getLayoutMode() !== 'items') return;
    page.addItem(placement, componentType);
  }

  private _placementEqual(a: GridPlacement, b: GridPlacement): boolean {
    if (a.mode !== b.mode || a.w !== b.w || a.h !== b.h) return false;
    if (a.mode === 'positioned' && b.mode === 'positioned') {
      return a.x === b.x && a.y === b.y;
    }
    return true;
  }
}
