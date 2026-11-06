import type { PageDocument, PageNode } from '@casehubio/pages-document';
import type { GridPlacement, GridItem } from '@casehubio/pages-component';
import type { LayoutMode } from '@casehubio/pages-document';

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
    if (page.getLayoutMode() !== 'items') {
      this._convertToItems(doc, page, items);
      return;
    }
    const gridItems = page.getItems();
    for (let i = 0; i < items.length && i < gridItems.length; i++) {
      const eventPlacement = items[i]!.placement;
      const current = gridItems[i]!.getPlacement();
      if (!this._placementEqual(current, eventPlacement)) {
        gridItems[i]!.setPlacement(eventPlacement);
      }
    }
  }

  private _convertToItems(doc: PageDocument, page: PageNode, eventItems: GridItem[]): void {
    const mode = page.getLayoutMode();
    const yamlDoc = doc._getDoc();
    const pagePath = [...page.path];

    const componentJsons: Record<string, unknown>[] = [];
    if (mode === 'flat') {
      const comps = page.getComponents();
      for (const comp of comps) {
        componentJsons.push(yamlDoc.getIn([...comp.path])?.toJSON?.() ?? { type: comp.type });
      }
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
      const ep = eventItems[i]?.placement ?? { mode: 'positioned' as const, x: 0, y: i, w: 12, h: 1 };
      const placementObj: Record<string, number> = { w: ep.w, h: ep.h };
      if (ep.mode === 'positioned') {
        placementObj['x'] = ep.x;
        placementObj['y'] = ep.y;
      }
      return { placement: placementObj, component: compJson };
    });

    const itemsNode = yamlDoc.createNode(entries);
    yamlDoc.setIn([...pagePath, 'items'], itemsNode);
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
