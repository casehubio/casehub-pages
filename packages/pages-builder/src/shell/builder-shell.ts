import { LitElement, html, css, nothing, render as litRender, type TemplateResult } from 'lit';
import type { DockItem } from '@casehubio/pages-component';
import type { PagesDockWorkbench } from '@casehubio/pages-primitives/dock';
import { customElement, property, state } from 'lit/decorators.js';
import { KeyboardShortcutMixin } from '@casehubio/pages-primitives/a11y';
import { PageDocument, type PageNode, type RowNode, type ColumnNode, type ComponentNode, type DatasetNode, type NavTreeNode } from '@casehubio/pages-document';
import { expand } from '@casehubio/yaml-core/expand';
import { EditorView } from '@codemirror/view';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';
import { buildYamlContext, navigateSchema, schemaToCompletions, isArrayField, type CompletionEntry } from '@casehubio/pages-lsp';
import { dashboardSchema } from '@casehubio/pages-schema';
import { yamlCoreDocumentSchema } from '@casehubio/yaml-core/schema';
import { z } from 'zod';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { PropertyPaletteSource } from '@casehubio/pages-property-palette/types';
import type { PaletteContext } from '../catalog/palette-context.js';
import type { ComponentCatalogEntry } from '../catalog/component-catalog.js';
import type { TreeNodeType } from '../tree/builder-tree.js';
import { computeMinimalChanges } from './diff-patch.js';
import { findPathAtOffset, getNodeRange, classifyPath, getParentPath } from './yaml-path.js';
import { builderHighlightExtension, setHighlightRange } from './yaml-gutter.js';
import { collectComponentsInScope } from './scope-collector.js';
import type { FieldSchema } from '@casehubio/pages-component';

import '../tree/builder-tree.js';
import '../palette/builder-palette.js';
import '../palette/inline-picker.js';
import '@casehubio/pages-primitives/dock';

function addBlankEnumOptions(schema: FieldSchema): FieldSchema {
  if (!schema.properties) return schema;
  const properties: Record<string, FieldSchema> = {};
  for (const [key, field] of Object.entries(schema.properties)) {
    if (field.enum && field.enum.length > 0 && field.enum[0] !== '') {
      properties[key] = { ...field, enum: ['', ...field.enum] };
    } else if (field.type === 'object' && field.properties) {
      properties[key] = addBlankEnumOptions(field);
    } else {
      properties[key] = field;
    }
  }
  return { ...schema, properties };
}

type EditOrigin = 'editor' | 'tree' | 'properties' | 'palette' | 'toolbar';

@customElement('pages-builder-shell')
export class PagesBuilderShell extends KeyboardShortcutMixin(LitElement) {
  @property({ attribute: false }) yaml = '';

  @property({ attribute: false }) renderPreview?: (container: HTMLElement, yaml: string) => void;

  @state() private _document: PageDocument = PageDocument.empty();
  @state() private _selectedPath: readonly (string | number)[] | undefined;
  @state() private _selectedNodeType: TreeNodeType | undefined;
  @state() private _viewMode: 'source' | 'visual' | 'split' = 'split';
  @state() private _paletteContext: PaletteContext | undefined;

  private _leftPanels: DockItem[] = [
    { icon: '☰', label: 'Tree', panelId: 'tree', defaultOpen: true },
  ];
  private _rightPanels: DockItem[] = [
    { icon: '☰', label: 'Props', panelId: 'properties', zone: 'top', defaultOpen: true },
    { icon: '▦', label: 'Comps', panelId: 'components', zone: 'bottom' },
  ];
  private _treeContainer?: HTMLElement;
  private _propsContainer?: HTMLElement;
  private _compsContainer?: HTMLElement;
  private _centreContainer?: HTMLElement;
  @state() private _propertySource: PropertyPaletteSource | undefined;

  private _undoStack: string[] = [];
  private _redoStack: string[] = [];

  private _pageSchema = z.intersection(yamlCoreDocumentSchema, dashboardSchema);

  private _schemaExtensions: Extension[] = (() => {
    const schema = this._pageSchema;
    const source = (context: CompletionContext): CompletionResult | null => {
      const line = context.state.doc.lineAt(context.pos);
      const textBefore = line.text.substring(0, context.pos - line.from);
      const doc = context.state.doc.toString();
      const yamlCtx = buildYamlContext(doc, context.pos);

      const afterValueColon = textBefore.match(/(?:^|\s)-?\s*(\w[\w-]*):\s*(\S*)$/);
      if (afterValueColon) {
        const key = afterValueColon[1] ?? '';
        const prefix = afterValueColon[2] ?? '';
        const resolved = navigateSchema(schema, [...yamlCtx.path, key], yamlCtx.siblings);
        if (resolved) {
          const completions = schemaToCompletions(resolved);
          if (completions.length > 0 && completions[0]?.type === 'enum') {
            return { from: context.pos - prefix.length, options: completions.map(c => ({ ...c, type: 'enum' as const })) };
          }
        }
        return null;
      }

      const keyMatch = textBefore.match(/(?:^|\s)-?\s*(\w[\w-]*)$/);
      const resolved = navigateSchema(schema, yamlCtx.path, yamlCtx.siblings);
      if (!resolved) return null;
      const completions = schemaToCompletions(resolved);
      if (completions.length === 0) return null;

      const hasSiblings = Object.keys(yamlCtx.siblings).length > 0;
      const needsDash = isArrayField(schema, yamlCtx.path, yamlCtx.siblings) && !textBefore.trimStart().startsWith('-') && !hasSiblings;
      function applyDash(c: CompletionEntry) {
        const apply = needsDash ? '- ' + (c.apply || c.label) : c.apply;
        return { label: needsDash ? '- ' + c.label : c.label, ...(c.detail ? { detail: c.detail } : {}), type: c.type, ...(apply ? { apply } : {}) };
      }

      if (keyMatch) {
        const prefix = keyMatch[1] ?? '';
        if (!prefix && !context.explicit) return null;
        return { from: context.pos - prefix.length, options: completions.map(applyDash) };
      }

      const emptyMatch = textBefore.match(/(?:^|\s)-?\s*$/);
      if (emptyMatch && context.explicit) {
        return { from: context.pos, options: completions.map(applyDash) };
      }

      return null;
    };
    return [autocompletion({ override: [source], activateOnTyping: true })];
  })();

  private _pendingEditorSync: number | undefined;
  private _editorDirty = false;
  private _inlinePickerOpen = false;
  private _inlinePickerPath: readonly (string | number)[] | undefined;
  private _inlinePickerNodeType: TreeNodeType | undefined;
  private _inlinePickerAnchor: HTMLElement | undefined;

  get document(): PageDocument {
    return this._document;
  }

  private _parseDocument(yaml: string): PageDocument {
    return PageDocument.parseCoordinated(yaml);
  }

  private _applyEdit(origin: EditOrigin, fn: () => void): void {
    if (origin !== 'editor' && this._pendingEditorSync) {
      this._flushEditorSync();
    }
    this._undoStack.push(this._document.toString());
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack.length = 0;
    fn();
    this._syncViews(origin);
  }

  private _syncViews(origin: EditOrigin): void {
    if (origin !== 'editor') {
      this._diffPatchEditor();
    }
    this._syncTree();
    this._resolvePropertySource();
    this._refreshPreview();
    this._emitChange();
    this.requestUpdate();
  }

  private _diffPatchEditor(): void {
    const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
    if (!editorEl) return;
    const editorText = editorEl.value ?? '';
    const modelText = this._document.toString();
    if (editorText === modelText) return;
    editorEl.value = modelText;
    const view = editorEl._editorView;
    if (!view) return;
    const changes = computeMinimalChanges(editorText, modelText);
    if (changes.length > 0) {
      editorEl._suppressUpdate = true;
      view.dispatch({ changes });
      editorEl._suppressUpdate = false;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._document = this.yaml ? this._parseDocument(this.yaml) : PageDocument.empty();
    this.registerShortcut('z', () => this._undo(), { description: 'Undo', requiresModifier: true });
    this.registerShortcut('Z', () => this._redo(), { description: 'Redo', requiresModifier: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._pendingEditorSync);
    this._editorClickCleanup?.();
    this._previewClickCleanup?.();
    if (this._previewClickTimer) clearTimeout(this._previewClickTimer);
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('yaml') && changed.get('yaml') !== undefined) {
      this._document = this._parseDocument(this.yaml);
      this._undoStack.length = 0;
      this._redoStack.length = 0;
      clearTimeout(this._pendingEditorSync);
      this._pendingEditorSync = undefined;
      this._editorDirty = false;
    }
    if (changed.has('_selectedPath')) {
      if (this._compsOpen) this._refreshPaletteContext();
    }
  }

  override firstUpdated(): void {
    this.updateComplete.then(() => {
      this._diffPatchEditor();
      this._connectEditorCursorSync();
      this._refreshPreview();
    });
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    const dockEl = this.renderRoot.querySelector('pages-dock-workbench') as any;
    if (dockEl?.updateComplete) await dockEl.updateComplete;
    return result;
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('_viewMode')) {
      this._syncCentre();
      if (this._viewMode !== 'source') this._refreshPreview();
      this.updateComplete.then(() => {
        this._diffPatchEditor();
        this._connectEditorCursorSync();
      });
    }
    if (changed.has('_selectedPath') || changed.has('_document')) {
      this._syncTree();
      if (this._compsContainer) this._refreshPaletteContext();
    }
    if (changed.has('_propertySource')) {
      this._syncProperties();
    }
    if (changed.has('_paletteContext')) {
      this._syncComponents();
    }
  }

  private _expandYamlForPreview(yamlText: string): string {
    try {
      const parsed = parseYaml(yamlText) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== 'object') return yamlText;
      const hasYamlCore = ['variables', 'modules', 'imports', 'iterations', 'data']
        .some(k => k in parsed);
      if (!hasYamlCore) return yamlText;
      const result = expand(parsed, { strict: false });
      return stringifyYaml(result.map);
    } catch {
      return yamlText;
    }
  }

  private _refreshPreview(): void {
    if (this._viewMode === 'source') return;
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector('.preview-container') as HTMLElement;
      if (!container) return;
      if (this.renderPreview) {
        const yamlText = this._document.toString();
        this.renderPreview(container, this._expandYamlForPreview(yamlText));
      } else {
        container.innerHTML = '<div class="preview-placeholder">Visual preview — provide renderPreview callback to enable live rendering</div>';
      }
      this._previewClickCleanup?.();
      this._previewClickCleanup = this._wirePreviewClicks(container);
    });
  }

  // --- Cross-panel sync ---

  private _editorClickCleanup: (() => void) | undefined;
  private _previewClickCleanup: (() => void) | undefined;
  private _suppressCursorSync = false;
  private _syncSource: 'tree' | 'yaml' | 'visual' | null = null;

  private _connectEditorCursorSync(): void {
    this._editorClickCleanup?.();
    const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
    if (!editorEl) return;
    const handler = () => {
      if (this._suppressCursorSync) return;
      const view = editorEl._editorView;
      if (!view) return;
      const offset = view.state.selection.main.head;
      const path = findPathAtOffset(this._document, offset);
      if (path) {
        const nodeType = classifyPath(path);
        if (nodeType) {
          this._syncSource = 'yaml';
          this._selectedPath = path;
          this._selectedNodeType = nodeType;
          this._updatePropertySource();
          this._syncSource = null;
        }
      }
    };
    editorEl.addEventListener('mouseup', handler);
    editorEl.addEventListener('keyup', handler);
    this._editorClickCleanup = () => {
      editorEl.removeEventListener('mouseup', handler);
      editorEl.removeEventListener('keyup', handler);
    };
  }

  // --- Visual click → Tree sync ---

  private _highlightPreviewNode(path: readonly (string | number)[], nodeType: TreeNodeType): void {
    if (this._viewMode === 'source') return;
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector('.preview-container') as HTMLElement;
      if (!container) return;

      let overlay = container.querySelector('.builder-scope-overlay') as HTMLElement;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'builder-scope-overlay';
        container.style.position = 'relative';
        container.appendChild(overlay);
      }

      const scopeComps = collectComponentsInScope(this._document, path, nodeType);
      const renderedIndex = this._buildRenderedIndex(container);
      const elements: HTMLElement[] = [];
      for (const comp of scopeComps) {
        const el = renderedIndex.get(JSON.stringify(comp.path));
        if (el) elements.push(el);
      }

      if (elements.length === 0) {
        overlay.style.display = 'none';
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const rects = elements.map(el => el.getBoundingClientRect());
      const pad = 4;
      const minX = Math.min(...rects.map(r => r.left)) - containerRect.left - pad;
      const minY = Math.min(...rects.map(r => r.top)) - containerRect.top + container.scrollTop - pad;
      const maxX = Math.max(...rects.map(r => r.right)) - containerRect.left + pad;
      const maxY = Math.max(...rects.map(r => r.bottom)) - containerRect.top + container.scrollTop + pad;

      overlay.style.cssText = `
        position: absolute; pointer-events: none;
        left: ${minX}px; top: ${minY}px;
        width: ${maxX - minX}px; height: ${maxY - minY}px;
        outline: 2px solid var(--pages-primary, #4285f4);
        outline-offset: 0;
        border-radius: 6px;
        background: rgba(66, 133, 244, 0.04);
        z-index: 10;
        transition: all 0.15s ease;
      `;

      elements[0]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  private _buildRenderedIndex(container: HTMLElement): Map<string, HTMLElement> {
    const index = new Map<string, HTMLElement>();
    const allDocComps: ComponentNode[] = [];
    for (const page of this._document.getPages()) {
      allDocComps.push(...collectComponentsInScope(this._document, page.path, 'page'));
    }
    const typeCounts = new Map<string, number>();
    for (const comp of allDocComps) {
      const count = typeCounts.get(comp.type) ?? 0;
      const els = container.querySelectorAll(`[data-component-type="${comp.type}"]`);
      const el = els[count] as HTMLElement | undefined;
      if (el) index.set(JSON.stringify(comp.path), el);
      typeCounts.set(comp.type, count + 1);
    }
    return index;
  }

  private _previewClickTimer: ReturnType<typeof setTimeout> | null = null;

  private _wirePreviewClicks(container: HTMLElement): () => void {
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const compEl = target.closest('[data-component-type]') as HTMLElement | null;
      if (!compEl) return;
      const compType = compEl.dataset.componentType;
      if (!compType) return;
      const path = this._findFirstComponentPathByType(compType, compEl, container);
      if (!path) return;

      if (this._previewClickTimer) clearTimeout(this._previewClickTimer);
      this._previewClickTimer = setTimeout(() => {
        this._previewClickTimer = null;
        this._syncSource = 'visual';
        this._selectedPath = path;
        this._selectedNodeType = 'component';
        this._updatePropertySource();
      }, 200);
    };

    const dblClickHandler = (e: Event) => {
      e.preventDefault();
      if (this._previewClickTimer) {
        clearTimeout(this._previewClickTimer);
        this._previewClickTimer = null;
      }
      if (!this._selectedPath) return;
      const parent = getParentPath(this._selectedPath);
      if (parent) {
        const parentType = classifyPath(parent);
        if (parentType) {
          this._syncSource = 'visual';
          this._selectedPath = parent;
          this._selectedNodeType = parentType;
          this._updatePropertySource();
        }
      }
    };

    container.addEventListener('click', clickHandler);
    container.addEventListener('dblclick', dblClickHandler);
    return () => {
      container.removeEventListener('click', clickHandler);
      container.removeEventListener('dblclick', dblClickHandler);
    };
  }

  private _findFirstComponentPathByType(type: string, clickedEl: HTMLElement, container: HTMLElement): readonly (string | number)[] | undefined {
    const allOfType = container.querySelectorAll(`[data-component-type="${type}"]`);
    const clickIndex = Array.from(allOfType).indexOf(clickedEl);
    let count = 0;
    const pages = this._document.getPages();
    for (let pi = 0; pi < pages.length; pi++) {
      const page = pages[pi]!;
      const found = this._searchComponentsForType(page, type, ['pages', pi], count, clickIndex);
      if (found.path) return found.path;
      count = found.count;
    }
    return undefined;
  }

  private _searchComponentsForType(
    parent: { getComponents?: () => ComponentNode[]; getRows?: () => { getColumns: () => { getComponents: () => ComponentNode[] }[] }[] },
    type: string, basePath: readonly (string | number)[], startCount: number, targetIndex: number
  ): { path: readonly (string | number)[] | undefined; count: number } {
    let count = startCount;
    if (parent.getComponents) {
      const comps = parent.getComponents();
      for (let i = 0; i < comps.length; i++) {
        if (comps[i]!.type === type) {
          if (count === targetIndex) return { path: comps[i]!.path, count };
          count++;
        }
      }
    }
    if (parent.getRows) {
      for (const row of parent.getRows()) {
        for (const col of row.getColumns()) {
          const comps = col.getComponents();
          for (let i = 0; i < comps.length; i++) {
            if (comps[i]!.type === type) {
              if (count === targetIndex) return { path: comps[i]!.path, count };
              count++;
            }
          }
        }
      }
    }
    return { path: undefined, count };
  }

  // --- Toolbar actions ---

  private _addPage(): void {
    this._applyEdit('toolbar', () => this._document.addPage('New Page'));
  }

  private _addDataset(): void {
    this._applyEdit('toolbar', () => this._document.addDataset('new_dataset'));
  }

  private _undo(): void {
    if (this._undoStack.length === 0) return;
    this._redoStack.push(this._document.toString());
    const prev = this._undoStack.pop()!;
    this._document = this._parseDocument(prev);
    this._syncViews('toolbar');
  }

  private _redo(): void {
    if (this._redoStack.length === 0) return;
    this._undoStack.push(this._document.toString());
    const next = this._redoStack.pop()!;
    this._document = this._parseDocument(next);
    this._syncViews('toolbar');
  }

  // --- Selection ---

  private _handleNodeSelect(e: CustomEvent<{ path: readonly (string | number)[]; nodeType: TreeNodeType }>): void {
    this._syncSource = 'tree';
    this._selectedPath = e.detail.path;
    this._selectedNodeType = e.detail.nodeType;
    this._updatePropertySource();
  }

  private _handleTreeAdd(e: CustomEvent<{ path: readonly (string | number)[]; nodeType: TreeNodeType; target?: HTMLElement }>): void {
    this._syncSource = 'tree';
    this._selectedPath = e.detail.path;
    this._selectedNodeType = e.detail.nodeType;
    this._updatePropertySource();
    this._refreshPaletteContext();
    this._inlinePickerOpen = true;
    this._inlinePickerPath = e.detail.path;
    this._inlinePickerNodeType = e.detail.nodeType;
    this._inlinePickerAnchor = e.detail.target;
    this._syncTree();
  }

  private static _LAYOUT_TYPES = new Set(['rows', 'columns', 'grid']);

  private _handleInlinePickerSelect(e: CustomEvent<ComponentCatalogEntry>): void {
    const entry = e.detail;
    const props = entry.defaultProps && Object.keys(entry.defaultProps).length > 0
      ? entry.defaultProps : undefined;
    const path = this._inlinePickerPath;
    const nt = this._inlinePickerNodeType;
    this._inlinePickerOpen = false;
    if (path && nt) {
      this._applyEdit('tree', () => {
        if (nt === 'page') {
          const page = this._findPageAtPath(path);
          if (page && PagesBuilderShell._LAYOUT_TYPES.has(entry.type)) {
            page.addRow();
          } else {
            page?.addComponent(entry.type, props);
          }
        } else if (nt === 'column') {
          this._findColumnAtPath(path)?.addComponent(entry.type, props);
        } else if (nt === 'row') {
          const row = this._findRowAtPath(path);
          if (row) {
            const cols = row.getColumns();
            if (cols.length > 0) cols[0]!.addComponent(entry.type, props);
          }
        } else if (nt === 'component') {
          const page = this._findPageAtPath(['pages', path[1] as number]);
          if (page) page.addComponent(entry.type, props);
        }
      });
    } else {
      this._syncTree();
    }
  }

  private _handleTreeAction(e: CustomEvent<{ action: string; path: readonly (string | number)[]; nodeType: TreeNodeType }>): void {
    const { action, path, nodeType } = e.detail;
    this._applyEdit('tree', () => {
      switch (action) {
        case 'delete': this._deleteAtPath(path, nodeType); break;
        case 'duplicate': if (nodeType === 'component') this._findComponentAtPath(path)?.duplicate(); break;
        case 'add-row': this._findPageAtPath(path)?.addRow(); break;
        case 'add-column': this._findRowAtPath(path)?.addColumn(); break;
        case 'move-up': this._moveAtPath(path, -1); break;
        case 'move-down': this._moveAtPath(path, 1); break;
        case 'wrap-row': {
          const page = this._findPageAtPath(['pages', path[1] as number]);
          if (page && path[2] === 'components') page.wrapInRow([path[3] as number]);
          break;
        }
      }
    });
  }

  private _deleteAtPath(path: readonly (string | number)[], nodeType: TreeNodeType): void {
    const idx = path[path.length - 1] as number;
    if (nodeType === 'page') { this._document.removePage(idx); return; }
    if (nodeType === 'dataset') { this._document.removeDataset(idx); return; }
    if (nodeType === 'row') { this._findPageAtPath(['pages', path[1] as number])?.removeChild(path[3] as number); return; }
    if (nodeType === 'column') { this._findRowAtPath(path.slice(0, 4))?.removeColumn(idx); return; }
    if (nodeType === 'component') {
      if (path[2] === 'components') this._findPageAtPath(['pages', path[1] as number])?.removeChild(idx);
      else if (path.length >= 8 && path[6] === 'components') this._findColumnAtPath(path.slice(0, 6))?.removeComponent(idx);
      else if (path.length >= 6 && path[4] === 'components') this._findColumnAtPath(path.slice(0, 4))?.removeComponent(idx);
    }
  }

  private _moveAtPath(path: readonly (string | number)[], direction: number): void {
    const comp = this._findComponentAtPath(path);
    if (!comp) return;
    const idx = (path[path.length - 1] as number) + direction;
    if (idx < 0) return;
    comp.moveToIndex({ path: path.slice(0, -2) }, idx);
  }

  private _handleTreeDrop(e: CustomEvent<{ sourcePath: readonly (string | number)[]; dropTarget: { parent: { path: readonly (string | number)[] }; index: number } }>): void {
    const { sourcePath, dropTarget } = e.detail;
    this._applyEdit('tree', () => {
      const component = this._findComponentAtPath(sourcePath);
      if (!component) return;
      component.moveToIndex(dropTarget.parent, dropTarget.index);
    });
  }

  private _updatePropertySource(): void {
    if (!this._selectedPath || !this._selectedNodeType) {
      this._propertySource = undefined;
      this._scrollYamlToPath(undefined);
      return;
    }
    if (this._syncSource !== 'yaml') {
      this._scrollYamlToPath(this._selectedPath);
    } else {
      this._highlightYamlRange(this._selectedPath);
    }
    this._highlightPreviewNode(this._selectedPath, this._selectedNodeType);
    this._resolvePropertySource();
  }

  private _resolvePropertySource(): void {
    if (!this._selectedPath || !this._selectedNodeType) {
      this._propertySource = undefined;
      return;
    }
    const nt = this._selectedNodeType;
    const path = this._selectedPath;

    if (nt === 'section') {
      const key = path[0] as string;
      const getDoc = () => this._document;
      this._propertySource = {
        schema: { type: 'object', properties: {
          section: { type: 'string', title: 'Section', readOnly: true },
          count: { type: 'number', title: 'Items', readOnly: true },
        }},
        get data() {
          const d = getDoc();
          const c = key === 'pages' ? d.getPages().length : key === 'datasets' ? d.getDatasets().length : 0;
          return { section: key, count: c };
        },
        onChange: () => {},
      };
      return;
    }

    if (nt === 'page') {
      const resolve = () => this._findPageAtPath(path);
      if (!resolve()) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: { type: 'object', properties: {
          name: { type: 'string', title: 'Page Name' },
        }},
        get data() { return { name: resolve()?.name ?? '' }; },
        onChange: (field, value) => {
          this._applyEdit('properties', () => {
            const n = resolve();
            if (n && String(field[0]) === 'name') n.name = String(value);
          });
        },
      };
      return;
    }

    if (nt === 'row') {
      const resolve = () => this._findRowAtPath(path);
      if (!resolve()) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: { type: 'object', properties: {
          columns: { type: 'number', title: 'Column Count', readOnly: true },
        }},
        get data() { return { columns: resolve()?.getColumns().length ?? 0 }; },
        onChange: () => {},
      };
      return;
    }

    if (nt === 'column') {
      const resolve = () => this._findColumnAtPath(path);
      if (!resolve()) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: { type: 'object', properties: {
          span: { type: 'number', title: 'Column Span', minimum: 1, maximum: 12 },
        }},
        get data() { return { span: resolve()?.span ?? 0 }; },
        onChange: (field, value) => {
          this._applyEdit('properties', () => {
            const n = resolve();
            if (n && String(field[0]) === 'span') n.span = Number(value);
          });
        },
      };
      return;
    }

    if (nt === 'component') {
      const resolve = () => this._findComponentAtPath(path);
      const node = resolve();
      if (!node) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: addBlankEnumOptions(node.getSchema()),
        get data() { return resolve()?.getProperties() ?? {}; },
        onChange: (field, value) => {
          this._applyEdit('properties', () => {
            const n = resolve();
            if (!n) return;
            const v = value === '' ? undefined : value;
            if (v === undefined) n.removeProperty(String(field[0]));
            else n.setProperty(String(field[0]), v);
          });
        },
      };
      return;
    }

    if (nt === 'dataset') {
      const resolve = () => this._findDatasetAtPath(path);
      if (!resolve()) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: { type: 'object', properties: {
          uuid: { type: 'string', title: 'UUID' },
          name: { type: 'string', title: 'Name' },
          url: { type: 'string', title: 'URL', format: 'uri' },
        }},
        get data() { return (resolve()?.getProperties() ?? {}) as Record<string, unknown>; },
        onChange: (field, value) => {
          this._applyEdit('properties', () => {
            resolve()?.setProperty(String(field[0]), value);
          });
        },
      };
      return;
    }

    if (nt === 'nav-item') {
      const resolve = () => this._findNavAtPath(path);
      if (!resolve()) { this._propertySource = undefined; return; }
      this._propertySource = {
        schema: { type: 'object', properties: {
          type: { type: 'string', title: 'Type', enum: ['GROUP', 'ITEM'] },
          id: { type: 'string', title: 'ID' },
          page: { type: 'string', title: 'Page' },
        }},
        get data() { const n = resolve(); return { type: n?.type ?? '', id: n?.id ?? '', page: n?.page ?? '' }; },
        onChange: (field, value) => {
          this._applyEdit('properties', () => {
            const n = resolve();
            if (!n) return;
            const key = String(field[0]);
            if (key === 'page') n.setPage(String(value));
            if (key === 'id') n.setId(String(value));
          });
        },
      };
      return;
    }

    this._propertySource = undefined;
  }

  // --- Right dock panel ---

  private _toggleTree(): void {
    const dockEl = this.renderRoot.querySelector('pages-dock-workbench') as PagesDockWorkbench | null;
    if (dockEl) dockEl.togglePanel('tree');
  }

  private _renderDockContent = (container: HTMLElement, panelId: string): void => {
    if (panelId === 'tree') {
      this._treeContainer = container;
      container.classList.add('panel-tree');
      this._syncTree();
    } else if (panelId === 'properties') {
      this._propsContainer = container;
      this._syncProperties();
    } else if (panelId === 'components') {
      this._compsContainer = container;
      this._refreshPaletteContext();
      this._syncComponents();
    }
  };

  private _renderEditorContent = (container: HTMLElement): void => {
    this._centreContainer = container;
    container.classList.add('panel-editor');
    this._syncCentre();
  };

  private _syncTree(): void {
    if (!this._treeContainer) return;
    litRender(html`
      <pages-builder-tree
        .document="${this._document}"
        .selectedPath="${this._selectedPath}"
        @node-select="${(e: CustomEvent) => this._handleNodeSelect(e)}"
        @tree-add="${(e: CustomEvent) => this._handleTreeAdd(e)}"
        @tree-action="${(e: CustomEvent) => this._handleTreeAction(e)}"
        @tree-drop="${(e: CustomEvent) => this._handleTreeDrop(e)}"
      ></pages-builder-tree>
      <pages-builder-inline-picker
        .context="${this._paletteContext}"
        .open="${this._inlinePickerOpen}"
        .anchor="${this._inlinePickerAnchor}"
        @component-select="${(e: CustomEvent) => this._handleInlinePickerSelect(e)}"
        @picker-close="${() => { this._inlinePickerOpen = false; this._syncTree(); }}"
      ></pages-builder-inline-picker>
    `, this._treeContainer);
  }

  private _syncProperties(): void {
    if (!this._propsContainer) return;
    litRender(html`
      <div class="dock-section">
        <div class="dock-section-header"><span>Properties</span></div>
        <div class="dock-section-content">
          ${this._propertySource ? html`
            <pages-property-palette .source="${this._propertySource}"></pages-property-palette>
          ` : html`
            <div class="empty-panel">Select a node to edit its properties.</div>
          `}
        </div>
      </div>
    `, this._propsContainer);
  }

  private _syncComponents(): void {
    if (!this._compsContainer) return;
    litRender(html`
      <div class="dock-section">
        <div class="dock-section-header"><span>Components</span></div>
        <div class="dock-section-content">
          <pages-builder-palette
            .context="${this._paletteContext}"
            @component-select="${(e: CustomEvent) => this._handleComponentSelect(e)}"
          ></pages-builder-palette>
        </div>
      </div>
    `, this._compsContainer);
  }

  private _syncCentre(): void {
    if (!this._centreContainer) return;
    const showSource = this._viewMode === 'source' || this._viewMode === 'split';
    const showVisual = this._viewMode === 'visual' || this._viewMode === 'split';
    litRender(html`
      <div class="editor-source${showSource ? '' : ' hidden'}${this._viewMode === 'split' ? ' split' : ''}">
        <pages-code-editor
          .extensions="${[...builderHighlightExtension, ...this._schemaExtensions]}"
          language="yaml"
          label="Page YAML source"
          @input="${() => this._handleEditorInput()}"
        ></pages-code-editor>
      </div>
      <div class="editor-visual${showVisual ? '' : ' hidden'}${this._viewMode === 'split' ? ' split' : ''}">
        <div class="preview-container"></div>
      </div>
    `, this._centreContainer);
  }

  private _refreshPaletteContext(): void {
    const datasets = this._document.getDatasets();
    const nt = this._selectedNodeType;
    const parentType = this._getParentType();
    this._paletteContext = {
      parentType,
      acceptsComponents: nt !== 'row',
      availableDatasets: datasets.map(d => d.uuid),
      siblingTypes: [],
    };
  }

  private _getParentType(): string | undefined {
    if (!this._selectedPath || !this._selectedNodeType) return undefined;
    const nt = this._selectedNodeType;
    if (nt === 'column' || nt === 'row') return nt;
    if (nt === 'component') {
      const node = this._findComponentAtPath(this._selectedPath);
      if (node?.isContainer()) return node.type;
    }
    return undefined;
  }

  private _handleComponentSelect(e: CustomEvent<ComponentCatalogEntry>): void {
    const entry = e.detail;
    const props = entry.defaultProps && Object.keys(entry.defaultProps).length > 0
      ? entry.defaultProps : undefined;

    this._applyEdit('palette', () => {
      if (!this._selectedPath || !this._selectedNodeType) {
        const pages = this._document.getPages();
        if (pages.length > 0) pages[0]!.addComponent(entry.type, props);
        return;
      }

      const nt = this._selectedNodeType;
      const path = this._selectedPath;

      if (nt === 'page') {
        const page = this._findPageAtPath(path);
        page?.addComponent(entry.type, props);
      } else if (nt === 'row') {
        const row = this._findRowAtPath(path);
        if (row) {
          const cols = row.getColumns();
          if (cols.length > 0) cols[0]!.addComponent(entry.type, props);
        }
      } else if (nt === 'column') {
        const col = this._findColumnAtPath(path);
        col?.addComponent(entry.type, props);
      } else if (nt === 'component') {
        const page = this._findPageAtPath(['pages', path[1] as number]);
        if (!page) return;
        if (path[2] === 'components') {
          page.addComponent(entry.type, props);
        } else if (path[2] === 'rows' && path.length >= 6) {
          const row = page.getRows()[path[3] as number];
          const col = row?.getColumns()[path[5] as number];
          col?.addComponent(entry.type, props);
        } else if (path[2] === 'columns' && path.length >= 4) {
          const col = page.getColumns()[path[3] as number];
          col?.addComponent(entry.type, props);
        }
      }
    });
  }

  // --- YAML scroll ---

  private _getYamlRange(path: readonly (string | number)[]): { from: number; to: number } | null {
    return getNodeRange(this._document, path);
  }

  private _scrollYamlToPath(path: readonly (string | number)[] | undefined): void {
    if (!path || path.length === 0) return;
    requestAnimationFrame(() => {
      const range = this._getYamlRange(path);
      if (!range) return;
      const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
      const view = editorEl?._editorView;
      if (!view) return;
      this._suppressCursorSync = true;
      view.dispatch({
        effects: [
          setHighlightRange.of(range),
          EditorView.scrollIntoView(range.from, { y: 'center' }),
        ],
      });
      setTimeout(() => { this._suppressCursorSync = false; }, 50);
    });
  }

  private _highlightYamlRange(path: readonly (string | number)[] | undefined): void {
    if (!path || path.length === 0) return;
    requestAnimationFrame(() => {
      const range = this._getYamlRange(path);
      const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
      const view = editorEl?._editorView;
      if (!view) return;
      view.dispatch({ effects: setHighlightRange.of(range) });
    });
  }

  private _findPageAtPath(path: readonly (string | number)[]): PageNode | undefined {
    if (path.length < 2 || path[0] !== 'pages') return undefined;
    return this._document.getPages()[path[1] as number];
  }

  private _findRowAtPath(path: readonly (string | number)[]): RowNode | undefined {
    if (path.length < 4 || path[0] !== 'pages') return undefined;
    const page = this._document.getPages()[path[1] as number];
    if (!page || path[2] !== 'rows') return undefined;
    return page.getRows()[path[3] as number];
  }

  private _findColumnAtPath(path: readonly (string | number)[]): ColumnNode | undefined {
    if (path.length < 4 || path[0] !== 'pages') return undefined;
    const page = this._document.getPages()[path[1] as number];
    if (!page) return undefined;
    if (path[2] === 'columns' && path.length >= 4) {
      return page.getColumns()[path[3] as number];
    }
    if (path[2] === 'rows' && path.length >= 6) {
      const row = page.getRows()[path[3] as number];
      if (!row || path[4] !== 'columns') return undefined;
      return row.getColumns()[path[5] as number];
    }
    return undefined;
  }

  private _findComponentAtPath(path: readonly (string | number)[]): ComponentNode | undefined {
    if (path.length < 3) return undefined;
    const page = this._document.getPages()[path[1] as number];
    if (!page) return undefined;
    if (path[2] === 'components' && path.length >= 4) {
      return page.getComponents()[path[3] as number];
    }
    if (path[2] === 'rows' && path.length >= 8) {
      const row = page.getRows()[path[3] as number];
      if (!row || path[4] !== 'columns') return undefined;
      const col = row.getColumns()[path[5] as number];
      if (!col || path[6] !== 'components') return undefined;
      return col.getComponents()[path[7] as number];
    }
    if (path[2] === 'columns' && path.length >= 6) {
      const col = page.getColumns()[path[3] as number];
      if (!col || path[4] !== 'components') return undefined;
      return col.getComponents()[path[5] as number];
    }
    return undefined;
  }

  private _findDatasetAtPath(path: readonly (string | number)[]): DatasetNode | undefined {
    if (path.length < 2 || path[0] !== 'datasets') return undefined;
    return this._document.getDatasets()[path[1] as number];
  }

  private _findNavAtPath(path: readonly (string | number)[]): NavTreeNode | undefined {
    if (path[0] !== 'navTree') return undefined;
    const nav = this._document.getNavTree();
    if (!nav) return undefined;
    let current: NavTreeNode = nav;
    for (let i = 1; i < path.length; i++) {
      const key = path[i];
      if (key === 'root_items' || key === 'children') continue;
      const idx = typeof key === 'number' ? key : parseInt(String(key), 10);
      if (isNaN(idx)) return undefined;
      const child = current.children[idx];
      if (!child) return undefined;
      current = child;
    }
    return current === nav ? undefined : current;
  }

  private _handleEditorInput(): void {
    this._editorDirty = true;
    clearTimeout(this._pendingEditorSync);
    this._pendingEditorSync = window.setTimeout(() => {
      this._pendingEditorSync = undefined;
      const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
      const text = editorEl?.value ?? '';
      const newDoc = this._parseDocument(text);
      if (newDoc.diagnostics.some(d => d.severity === 'error')) return;
      this._applyEdit('editor', () => { this._document = newDoc; });
      this._editorDirty = false;
    }, 300);
  }

  private _flushEditorSync(): void {
    clearTimeout(this._pendingEditorSync);
    this._pendingEditorSync = undefined;
    if (!this._editorDirty) return;
    const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
    const text = editorEl?.value ?? '';
    const newDoc = this._parseDocument(text);
    if (newDoc.diagnostics.some(d => d.severity === 'error')) return;
    this._undoStack.push(this._document.toString());
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack.length = 0;
    this._document = newDoc;
    this._editorDirty = false;
  }

  // --- onChange emission ---

  private _emitChange(): void {
    this.dispatchEvent(new CustomEvent('builder-change', {
      bubbles: true, composed: true,
      detail: { yaml: this._document.toString() },
    }));
  }

  // --- Render ---

  override render(): TemplateResult {
    return html`
      <div class="shell">
        <div class="toolbar">
          <button class="toolbar-btn" @click="${this._addPage}" title="Add page">+ Page</button>
          <button class="toolbar-btn" @click="${this._addDataset}" title="Add dataset">+ Dataset</button>
          <div class="toolbar-spacer"></div>
          <div class="view-tabs">
            <button class="view-tab${this._viewMode === 'source' ? ' active' : ''}"
              @click="${() => { this._viewMode = 'source'; }}">Source</button>
            <button class="view-tab${this._viewMode === 'split' ? ' active' : ''}"
              @click="${() => { this._viewMode = 'split'; }}">Split</button>
            <button class="view-tab${this._viewMode === 'visual' ? ' active' : ''}"
              @click="${() => { this._viewMode = 'visual'; }}">Visual</button>
          </div>
          <div class="toolbar-spacer"></div>
          <button class="toolbar-btn" @click="${this._undo}" ?disabled="${this._undoStack.length === 0}" title="Undo">Undo</button>
          <button class="toolbar-btn" @click="${this._redo}" ?disabled="${this._redoStack.length === 0}" title="Redo">Redo</button>
        </div>

        <pages-dock-workbench
          persist-key="pages-builder"
          .leftPanels="${this._leftPanels}"
          .rightPanels="${this._rightPanels}"
          .renderContent="${this._renderDockContent}"
          .renderCentre="${this._renderEditorContent}"
        >
        </pages-dock-workbench>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--pages-font-family, sans-serif);
    }

    .shell {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--pages-border-color, #dadce0);
      background: var(--pages-toolbar-bg, #f8f9fa);
    }

    .toolbar-btn {
      padding: 4px 12px;
      border: 1px solid var(--pages-border-color, #dadce0);
      border-radius: 4px;
      background: var(--pages-surface-bg, #fff);
      cursor: pointer;
      font-size: 12px;
    }

    .toolbar-btn:hover:not(:disabled) {
      background: var(--pages-hover-bg, #e8eaed);
    }

    .toolbar-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .toolbar-spacer {
      flex: 1;
    }

    /* Main panel layout */

    pages-dock-workbench {
      flex: 1;
    }

    .panel-tree {
      height: 100%;
      overflow-y: auto;
      padding: 8px 0;
    }

    .tree-toggle.active {
      background: var(--pages-selected-bg, rgba(66, 133, 244, 0.12));
      color: var(--pages-primary, #1967d2);
      border-color: var(--pages-primary, #1967d2);
    }

    .view-tabs {
      display: flex;
      gap: 0;
      border: 1px solid var(--pages-border-color, #dadce0);
      border-radius: 4px;
      overflow: hidden;
    }

    .view-tab {
      padding: 3px 10px;
      border: none;
      border-right: 1px solid var(--pages-border-color, #dadce0);
      background: var(--pages-surface-bg, #fff);
      cursor: pointer;
      font-size: 11px;
    }

    .view-tab:last-child { border-right: none; }
    .view-tab:hover { background: var(--pages-hover-bg, #e8eaed); }

    .view-tab.active {
      background: var(--pages-primary, #1967d2);
      color: #fff;
    }

    .panel-editor {
      height: 100%;
      display: flex;
      overflow: hidden;
    }

    .editor-source, .editor-visual {
      flex: 1;
      overflow: hidden;
    }

    .editor-source.split, .editor-visual.split {
      flex: 1;
      min-width: 0;
    }

    .editor-source.split {
      border-right: 1px solid var(--pages-border-color, #dadce0);
    }

    .editor-source > pages-code-editor {
      display: block;
      height: 100%;
    }

    .editor-visual {
      background: var(--pages-surface-bg, #fff);
    }

    .editor-source.hidden, .editor-visual.hidden {
      display: none;
    }

    .preview-container {
      height: 100%;
      overflow: auto;
      padding: 16px;
    }

    .preview-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-text-secondary, #5f6368);
      font-size: 14px;
    }

    .empty-panel {
      padding: 32px;
      text-align: center;
      color: var(--pages-text-secondary, #5f6368);
      font-size: 14px;
    }

    /* Right dock content */

    .dock-section {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .dock-section.half {
      flex: 1;
      max-height: 50%;
    }

    .dock-section + .dock-section {
      border-top: 1px solid var(--pages-border-color, #dadce0);
    }

    .dock-section-header {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      border-bottom: 1px solid var(--pages-border-color, #dadce0);
      background: var(--pages-toolbar-bg, #f8f9fa);
      font-size: 11px;
      font-weight: 600;
      color: var(--pages-text-secondary, #5f6368);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .dock-section-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .dock-section-content > pages-builder-palette {
      height: 100%;
    }

    .dock-section-content > pages-property-palette {
      display: block;
    }

    /* Toggle bar icons (inside dock-workbench toggle-bar slot) */

    .dock-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 4px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 4px;
      color: var(--pages-text-secondary, #5f6368);
      width: 32px;
    }

    .dock-icon:hover {
      background: var(--pages-hover-bg, rgba(0, 0, 0, 0.06));
      color: var(--pages-text-primary, #202124);
    }

    .dock-icon.active {
      background: var(--pages-selected-bg, rgba(66, 133, 244, 0.12));
      color: var(--pages-primary, #1967d2);
    }

    .dock-icon-glyph {
      font-size: 16px;
      line-height: 1;
    }

    .dock-icon-label {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      white-space: nowrap;
    }

    .dock-icon + .dock-icon {
      margin-top: 4px;
    }
  `;
}
