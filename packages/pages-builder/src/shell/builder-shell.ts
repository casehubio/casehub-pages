import { LitElement, html, css, nothing, render as litRender, type TemplateResult } from 'lit';
import type { DockItem } from '@casehubio/pages-component';
import type { PagesDockWorkbench } from '@casehubio/pages-primitives/dock';
import { customElement, property, state } from 'lit/decorators.js';
import { KeyboardShortcutMixin } from '@casehubio/pages-primitives/a11y';
import { PageDocument, type PageNode, type RowNode, type ColumnNode, type ComponentNode, type DatasetNode, type NavTreeNode } from '@casehubio/pages-document';
import { EditorView } from '@codemirror/view';
import type { PropertyPaletteSource } from '@casehubio/pages-property-palette/types';
import type { PaletteContext } from '../catalog/palette-context.js';
import type { ComponentCatalogEntry } from '../catalog/component-catalog.js';
import type { TreeNodeType } from '../tree/builder-tree.js';
import { YamlSync, type EditorAdapter } from './yaml-sync.js';
import { findPathAtOffset, getNodeRange, classifyPath, getParentPath } from './yaml-path.js';
import { builderHighlightExtension, setHighlightRange } from './yaml-gutter.js';
import { collectComponentsInScope } from './scope-collector.js';
import type { FieldSchema } from '@casehubio/pages-component';

import '../tree/builder-tree.js';
import '../palette/builder-palette.js';
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

  private _yamlSync: YamlSync | undefined;
  private _docUnsub: (() => void) | undefined;

  get document(): PageDocument {
    return this._document;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._document = this.yaml ? PageDocument.parse(this.yaml) : PageDocument.empty();
    this._subscribeToDocument();
    this.registerShortcut('z', () => this._undo(), { description: 'Undo', requiresModifier: true });
    this.registerShortcut('Z', () => this._redo(), { description: 'Redo', requiresModifier: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._yamlSync?.disconnect();
    this._docUnsub?.();
    this._editorClickCleanup?.();
    this._previewClickCleanup?.();
    if (this._previewClickTimer) clearTimeout(this._previewClickTimer);
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('yaml') && changed.get('yaml') !== undefined) {
      this._docUnsub?.();
      this._document = PageDocument.parse(this.yaml);
      this._subscribeToDocument();
    }
    if (changed.has('_selectedPath')) {
      if (this._compsOpen) this._refreshPaletteContext();
    }
  }

  private _subscribeToDocument(): void {
    this._docUnsub = this._document.onChange(() => {
      this._pushYamlToEditor();
      this._emitChange();
      this.requestUpdate();
      this._refreshPreview();
    });
  }

  private _pushYamlToEditor(): void {
    const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
    if (!editorEl) return;
    const newText = this._document.toString();
    editorEl.value = newText;
    const view = editorEl._editorView;
    if (view) {
      const currentText = view.state.doc.toString();
      if (currentText !== newText) {
        editorEl._suppressUpdate = true;
        view.dispatch({ changes: { from: 0, to: currentText.length, insert: newText } });
        editorEl._suppressUpdate = false;
      }
    }
  }

  override firstUpdated(): void {
    this.updateComplete.then(() => {
      this._pushYamlToEditor();
      this._connectYamlSync();
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
        this._pushYamlToEditor();
        this._connectYamlSync();
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

  private _refreshPreview(): void {
    if (this._viewMode === 'source') return;
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector('.preview-container') as HTMLElement;
      if (!container) return;
      if (this.renderPreview) {
        this.renderPreview(container, this._document.toString());
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
    this._document.addPage('New Page');
  }

  private _addDataset(): void {
    this._document.addDataset('new_dataset');
  }

  private _undo(): void {
    this._document.undo();
  }

  private _redo(): void {
    this._document.redo();
  }

  // --- Selection ---

  private _handleNodeSelect(e: CustomEvent<{ path: readonly (string | number)[]; nodeType: TreeNodeType }>): void {
    this._syncSource = 'tree';
    this._selectedPath = e.detail.path;
    this._selectedNodeType = e.detail.nodeType;
    this._updatePropertySource();
  }

  private _updatePropertySource(): void {
    if (!this._selectedPath || !this._selectedNodeType) {
      this._propertySource = undefined;
      this._scrollYamlToPath(undefined);
      return;
    }

    const nt = this._selectedNodeType;
    if (this._syncSource !== 'yaml') {
      this._scrollYamlToPath(this._selectedPath);
    } else {
      this._highlightYamlRange(this._selectedPath);
    }
    this._highlightPreviewNode(this._selectedPath, nt);

    if (nt === 'section') {
      const key = this._selectedPath[0] as string;
      const count = key === 'pages' ? this._document.getPages().length
        : key === 'datasets' ? this._document.getDatasets().length : 0;
      this._propertySource = {
        schema: { type: 'object', properties: {
          section: { type: 'string', title: 'Section', readOnly: true },
          count: { type: 'number', title: 'Items', readOnly: true },
        }},
        get data() { return { section: key, count }; },
        onChange: () => {},
      };
      return;
    }

    if (nt === 'page') {
      const page = this._findPageAtPath(this._selectedPath);
      if (page) {
        this._propertySource = {
          schema: { type: 'object', properties: {
            name: { type: 'string', title: 'Page Name' },
          }},
          get data() { return { name: page.name }; },
          onChange: (field, value) => {
            if (String(field[0]) === 'name') page.name = String(value);
          },
        };
        return;
      }
    }

    if (nt === 'row') {
      const row = this._findRowAtPath(this._selectedPath);
      if (row) {
        this._propertySource = {
          schema: { type: 'object', properties: {
            columns: { type: 'number', title: 'Column Count', readOnly: true },
          }},
          get data() { return { columns: row.getColumns().length }; },
          onChange: () => {},
        };
        return;
      }
    }

    if (nt === 'column') {
      const col = this._findColumnAtPath(this._selectedPath);
      if (col) {
        this._propertySource = {
          schema: { type: 'object', properties: {
            span: { type: 'number', title: 'Column Span', minimum: 1, maximum: 12 },
          }},
          get data() { return { span: col.span }; },
          onChange: (field, value) => {
            if (String(field[0]) === 'span') col.span = Number(value);
          },
        };
        return;
      }
    }

    if (nt === 'component') {
      const node = this._findComponentAtPath(this._selectedPath);
      if (node) {
        this._propertySource = {
          schema: addBlankEnumOptions(node.getSchema()),
          get data() { return node.getProperties(); },
          onChange: (field, value) => {
            const v = value === '' ? undefined : value;
            if (v === undefined) node.removeProperty(String(field[0]));
            else node.setProperty(String(field[0]), v);
          },
        };
        return;
      }
    }

    if (nt === 'dataset') {
      const dsNode = this._findDatasetAtPath(this._selectedPath);
      if (dsNode) {
        this._propertySource = {
          schema: { type: 'object', properties: {
            uuid: { type: 'string', title: 'UUID' },
            name: { type: 'string', title: 'Name' },
            url: { type: 'string', title: 'URL', format: 'uri' },
          }},
          get data() { return dsNode.getProperties() as Record<string, unknown>; },
          onChange: (field, value) => {
            dsNode.setProperty(String(field[0]), value);
          },
        };
        return;
      }
    }

    if (nt === 'nav-item') {
      const nav = this._findNavAtPath(this._selectedPath);
      if (nav) {
        this._propertySource = {
          schema: { type: 'object', properties: {
            type: { type: 'string', title: 'Type', enum: ['GROUP', 'ITEM'] },
            id: { type: 'string', title: 'ID' },
            page: { type: 'string', title: 'Page' },
          }},
          get data() { return { type: nav.type ?? '', id: nav.id ?? '', page: nav.page ?? '' }; },
          onChange: (field, value) => {
            const key = String(field[0]);
            if (key === 'page') nav.setPage(String(value));
            if (key === 'id') nav.setId(String(value));
          },
        };
        return;
      }
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
      ></pages-builder-tree>
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
          .extensions="${builderHighlightExtension}"
          language="yaml"
          label="Page YAML source"
        ></pages-code-editor>
      </div>
      <div class="editor-visual${showVisual ? '' : ' hidden'}${this._viewMode === 'split' ? ' split' : ''}">
        <div class="preview-container"></div>
      </div>
    `, this._centreContainer);
  }

  private _refreshPaletteContext(): void {
    const datasets = this._document.getDatasets();
    this._paletteContext = {
      parentType: this._getParentType(),
      acceptsComponents: true,
      availableDatasets: datasets.map(d => d.uuid),
      siblingTypes: [],
    };
  }

  private _getParentType(): string | undefined {
    if (!this._selectedPath || !this._selectedNodeType) return undefined;
    if (this._selectedNodeType === 'component') {
      const node = this._findComponentAtPath(this._selectedPath);
      if (node?.isContainer()) return node.type;
    }
    return undefined;
  }

  private _handleComponentSelect(e: CustomEvent<ComponentCatalogEntry>): void {
    const entry = e.detail;
    const props = entry.defaultProps && Object.keys(entry.defaultProps).length > 0
      ? entry.defaultProps : undefined;

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

  private _connectYamlSync(): void {
    const editorEl = this.shadowRoot?.querySelector('pages-code-editor') as any;
    if (!editorEl) return;

    this._yamlSync?.disconnect();

    const adapter: EditorAdapter = {
      getValue: () => editorEl.value ?? '',
      setValue: (v: string) => { editorEl.value = v; },
      onInput: (handler: (v: string) => void) => {
        const listener = () => handler(editorEl.value);
        editorEl.addEventListener('input', listener);
        return () => editorEl.removeEventListener('input', listener);
      },
    };

    this._yamlSync = new YamlSync(this._document, adapter);
    this._yamlSync.onDocumentChange((doc) => {
      if (doc.toString() === this._document.toString()) return;
      this._docUnsub?.();
      this._document = doc;
      this._subscribeToDocument();
      this._updatePropertySource();
    });
    this._yamlSync.connect();
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
          <button class="toolbar-btn" @click="${this._undo}" ?disabled="${!this._document.canUndo()}" title="Undo">Undo</button>
          <button class="toolbar-btn" @click="${this._redo}" ?disabled="${!this._document.canRedo()}" title="Redo">Redo</button>
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
