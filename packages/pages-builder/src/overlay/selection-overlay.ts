import type { TreeNodeType } from '../tree/builder-tree.js';

export type ButtonDef = readonly [cls: string, label: string, event: string];

const ALL_BUTTONS: ButtonDef[] = [
  ['sel-add-btn', '+', 'selection-add'],
  ['sel-insert-btn', '↓', 'selection-insert'],
  ['sel-cut-btn', '✂', 'selection-cut'],
  ['sel-copy-btn', '⎘', 'selection-copy'],
  ['sel-delete-btn', '✕', 'selection-delete'],
];

const GRID_ITEM_BUTTONS: ButtonDef[] = [
  ['sel-split-h-btn', '⬌', 'selection-split-h'],
  ['sel-split-v-btn', '⬍', 'selection-split-v'],
  ['sel-merge-btn', '⊞', 'selection-merge'],
  ['sel-delete-btn', '✕', 'selection-delete'],
  ['sel-add-empty-btn', '+', 'selection-add-empty'],
];

const EDIT_LAYOUT_BTN: ButtonDef = ['sel-edit-layout-btn', '⊞', 'selection-edit-layout'];

const BUTTON_TOOLTIPS: Record<string, string> = {
  'selection-split-h': 'Split horizontally',
  'selection-split-v': 'Split vertically',
  'selection-merge': 'Merge',
  'selection-delete': 'Delete',
  'selection-add-empty': 'Add empty',
  'selection-add': 'Add',
  'selection-insert': 'Insert',
  'selection-cut': 'Cut',
  'selection-copy': 'Copy',
  'selection-edit-layout': 'Edit layout',
};

export function getButtonsForNodeType(
  nodeType: TreeNodeType,
  isContainer: boolean,
): ButtonDef[] {
  if (nodeType === 'page') {
    return [EDIT_LAYOUT_BTN, ...ALL_BUTTONS.filter(([, , evt]) =>
      evt === 'selection-add' || evt === 'selection-delete')];
  }
  if (nodeType === 'grid-item') {
    return GRID_ITEM_BUTTONS;
  }
  if (nodeType === 'component' && !isContainer) {
    return ALL_BUTTONS.filter(([, , evt]) => evt !== 'selection-add');
  }
  return ALL_BUTTONS;
}

const BTN_STYLE = `
  width: 20px; height: 20px; border: 1px solid #dadce0;
  border-radius: 4px; background: #fff; color: #5f6368;
  cursor: pointer; font-size: 12px; line-height: 1; padding: 0;
  display: flex; align-items: center; justify-content: center;
`;

export class SelectionOverlay {
  private _overlayRoot: HTMLElement;
  private _overlay: HTMLElement | null = null;
  private _insertionPoints: HTMLElement[] = [];
  private _buttonsContainer: HTMLElement | null = null;
  private _toolbarLocked = false;
  private _isGridItemToolbar = false;

  constructor(overlayRoot: HTMLElement) {
    this._overlayRoot = overlayRoot;
  }

  update(
    bounds: DOMRect,
    nodeType: TreeNodeType,
    path: readonly (string | number)[],
    options?: { isContainer?: boolean },
  ): void {
    if (!this._overlay) {
      this._overlay = document.createElement('div');
      this._overlay.className = 'builder-scope-overlay';
      this._overlayRoot.appendChild(this._overlay);
    }

    this._overlay.style.cssText = `
      position: absolute; pointer-events: none;
      left: ${bounds.x}px; top: ${bounds.y}px;
      width: ${bounds.width}px; height: ${bounds.height}px;
      outline: 2px solid var(--pages-accent-9);
      outline-offset: 0;
      border-radius: 6px;
      background: rgba(66, 133, 244, 0.04);
      z-index: 10;
      transition: all 0.15s ease;
    `;

    this._overlay.innerHTML = '';
    const toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar';
    const isGridItemToolbar = nodeType === 'grid-item';
    toolbar.style.cssText = isGridItemToolbar
      ? `position: absolute; top: -2px; right: -2px;
         display: flex; flex-direction: column; align-items: flex-end;
         pointer-events: auto; z-index: 11;`
      : `position: absolute; top: -2px; right: -2px;
         display: flex; align-items: center;
         pointer-events: auto; z-index: 11;`;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'toolbar-buttons';
    buttonsContainer.style.cssText = isGridItemToolbar
      ? `display: grid; grid-template-columns: repeat(3, 20px); gap: 2px;
         max-height: 0; overflow: hidden; opacity: 0;
         transition: max-height 150ms ease, opacity 150ms ease;`
      : `display: flex; gap: 2px;
         max-width: 0; overflow: hidden; opacity: 0;
         transition: max-width 150ms ease, opacity 150ms ease;`;

    const buttons = getButtonsForNodeType(nodeType, options?.isContainer ?? false);
    for (let i = 0; i < buttons.length; i++) {
      const [cls, label, eventName] = buttons[i]!;
      if (isGridItemToolbar && i === 3) {
        const spacer = document.createElement('div');
        buttonsContainer.appendChild(spacer);
      }
      const btn = document.createElement('button');
      btn.className = cls;
      btn.textContent = label;
      btn.title = BUTTON_TOOLTIPS[eventName] ?? '';
      btn.style.cssText = BTN_STYLE;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._overlayRoot.dispatchEvent(new CustomEvent(eventName, {
          bubbles: true,
          detail: { path, nodeType, target: btn },
        }));
      });
      buttonsContainer.appendChild(btn);
    }

    const trigger = document.createElement('div');
    trigger.className = 'toolbar-trigger';
    trigger.textContent = '⋮';
    trigger.style.cssText = `
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; font-weight: bold;
      color: #5f6368; background: #fff;
      border: 1px solid #dadce0; border-radius: 4px;
    `;

    if (isGridItemToolbar) {
      toolbar.appendChild(trigger);
      toolbar.appendChild(buttonsContainer);
    } else {
      toolbar.appendChild(buttonsContainer);
      toolbar.appendChild(trigger);
    }
    this._buttonsContainer = buttonsContainer;
    this._isGridItemToolbar = isGridItemToolbar;

    toolbar.addEventListener('mouseenter', () => {
      if (isGridItemToolbar) {
        buttonsContainer.style.maxHeight = '50px';
      } else {
        buttonsContainer.style.maxWidth = '200px';
      }
      buttonsContainer.style.opacity = '1';
    });
    toolbar.addEventListener('mouseleave', () => {
      if (this._toolbarLocked) return;
      if (isGridItemToolbar) {
        buttonsContainer.style.maxHeight = '0';
      } else {
        buttonsContainer.style.maxWidth = '0';
      }
      buttonsContainer.style.opacity = '0';
    });

    this._overlay.appendChild(toolbar);
    if (this._toolbarLocked) {
      if (isGridItemToolbar) {
        buttonsContainer.style.maxHeight = '50px';
      } else {
        buttonsContainer.style.maxWidth = '200px';
      }
      buttonsContainer.style.opacity = '1';
    }

  }

  lockToolbar(): void {
    this._toolbarLocked = true;
    if (this._buttonsContainer) {
      if (this._isGridItemToolbar) {
        this._buttonsContainer.style.maxHeight = '50px';
      } else {
        this._buttonsContainer.style.maxWidth = '200px';
      }
      this._buttonsContainer.style.opacity = '1';
    }
  }

  unlockToolbar(): void {
    this._toolbarLocked = false;
  }

  hide(): void {
    if (this._overlay) this._overlay.style.display = 'none';
    this.hideInsertionPoints();
  }

  setInsertMode(_fragmentType: string): void {
    this._overlay?.classList.add('paste-target');
  }

  clearInsertMode(): void {
    this._overlay?.classList.remove('paste-target');
  }

  showInsertionPoints(
    childBounds: DOMRect[],
    parentPath: readonly (string | number)[],
    parentNodeType: TreeNodeType,
  ): void {
    this.hideInsertionPoints();

    const overlayLeft = this._overlay ? parseFloat(this._overlay.style.left) : 0;
    const overlayWidth = this._overlay ? parseFloat(this._overlay.style.width) : 300;
    const overlayTop = this._overlay ? parseFloat(this._overlay.style.top) : 0;
    const overlayHeight = this._overlay ? parseFloat(this._overlay.style.height) : 200;

    const count = childBounds.length + 1;
    for (let i = 0; i < count; i++) {
      let top: number;
      if (childBounds.length === 0) {
        top = overlayTop + overlayHeight / 2;
      } else if (i === 0) {
        top = childBounds[0]!.top - 6;
      } else if (i === childBounds.length) {
        top = childBounds[i - 1]!.bottom + 2;
      } else {
        top = (childBounds[i - 1]!.bottom + childBounds[i]!.top) / 2;
      }

      const point = document.createElement('div');
      point.className = 'visual-insertion-point';
      point.setAttribute('role', 'button');
      point.setAttribute('aria-label', `Insert at position ${i}`);
      point.dataset.index = String(i);
      point.style.cssText = `
        position: absolute;
        left: ${overlayLeft}px;
        top: ${top - 6}px;
        width: ${overlayWidth}px;
        height: 12px;
        display: flex;
        align-items: center;
        cursor: pointer;
        opacity: 0.3;
        transition: opacity 150ms ease;
        pointer-events: auto;
        z-index: 11;
      `;

      const lineL = document.createElement('span');
      lineL.style.cssText = 'flex: 1; height: 1px; background: var(--pages-accent-9);';
      const icon = document.createElement('span');
      icon.textContent = '+';
      icon.style.cssText = 'font-size: 10px; color: var(--pages-accent-9); padding: 0 4px; font-weight: bold;';
      const lineR = document.createElement('span');
      lineR.style.cssText = 'flex: 1; height: 1px; background: var(--pages-accent-9);';

      point.appendChild(lineL);
      point.appendChild(icon);
      point.appendChild(lineR);

      point.addEventListener('mouseenter', () => { point.style.opacity = '1'; });
      point.addEventListener('mouseleave', () => { point.style.opacity = '0.3'; });

      const idx = i;
      point.addEventListener('click', (e) => {
        e.stopPropagation();
        this._overlayRoot.dispatchEvent(new CustomEvent('selection-insert-at', {
          bubbles: true,
          detail: { parentPath, index: idx, parentNodeType, target: point },
        }));
      });

      this._overlayRoot.appendChild(point);
      this._insertionPoints.push(point);
    }
  }

  hideInsertionPoints(): void {
    for (const p of this._insertionPoints) p.remove();
    this._insertionPoints = [];
  }

  dispose(): void {
    this.hideInsertionPoints();
    this._overlay?.remove();
    this._overlay = null;
  }
}
