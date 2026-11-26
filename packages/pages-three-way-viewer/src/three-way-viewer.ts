import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { EditorView } from '@codemirror/view';
import { ViewerController, type ViewerMode } from './viewer-controller.js';
import { isViewerSyncTarget, type ViewerSelectDetail } from './sync-protocol.js';
import type { PagesCodeEditor } from '@casehubio/pages-code-editor';
import '@casehubio/pages-code-editor';

@customElement('three-way-viewer')
export class ThreeWayViewer extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--pages-surface-0, #0f172a);
      color: var(--pages-text-primary, #e2e8f0);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--pages-border, #334155);
      background: var(--pages-surface-1, #1e293b);
      flex-shrink: 0;
    }
    .mode-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: var(--pages-radius-sm, 4px);
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--pages-text-secondary, #94a3b8);
      transition: all 0.15s;
    }
    .mode-btn:hover {
      color: var(--pages-text-primary, #e2e8f0);
      background: var(--pages-surface-2, #334155);
    }
    .mode-btn.active {
      color: var(--pages-primary, #38bdf8);
      border-color: var(--pages-primary, #38bdf8);
      background: rgba(56, 189, 248, 0.1);
    }
    .content {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
    .editor-pane {
      overflow: hidden;
    }
    .editor-pane pages-code-editor {
      height: 100%;
      border: none;
      border-radius: 0;
      resize: none;
    }
    .visual-pane {
      overflow: auto;
    }
    .splitter {
      width: 4px;
      cursor: col-resize;
      background: var(--pages-border, #334155);
      flex-shrink: 0;
    }
    .splitter:hover {
      background: var(--pages-primary, #38bdf8);
    }
    .hidden { display: none; }
  `;

  @property({ reflect: true }) mode: ViewerMode = 'split';
  @property({ type: Number, attribute: 'split-ratio' }) splitRatio = 0.5;
  @property() language: 'yaml' | 'json' | 'markdown' = 'yaml';
  @property() value = '';
  @property({ type: Boolean, reflect: true }) readonly = false;

  @state() private _mode: ViewerMode = 'split';

  private _controller: ViewerController | undefined;
  private _cursorDebounce: ReturnType<typeof setTimeout> | undefined;

  get controller(): ViewerController {
    if (!this._controller) {
      this._controller = this._createController();
    }
    return this._controller;
  }

  private _createController(): ViewerController {
    return new ViewerController({
      initialMode: this.mode,
      initialSplitRatio: this.splitRatio,
      onChange: (m, r) => {
        this._mode = m;
        this.splitRatio = r;
        this.dispatchEvent(new CustomEvent('mode-change', {
          bubbles: true, composed: true, detail: { mode: m },
        }));
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this._controller) {
      this._controller = this._createController();
    }
    this._mode = this.mode;
    this.addEventListener('viewer-select', this._onViewerSelect as EventListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('viewer-select', this._onViewerSelect as EventListener);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('mode') && this.mode !== this._mode) {
      this.controller.setMode(this.mode);
    }
    if (changed.has('splitRatio')) {
      this.controller.setSplitRatio(this.splitRatio);
    }
  }

  private _getEditor(): PagesCodeEditor | null {
    return this.renderRoot.querySelector('pages-code-editor') as PagesCodeEditor | null;
  }

  private _getVisualElement(): Element | null {
    const slot = this.renderRoot.querySelector('slot[name="visual-pane"]') as HTMLSlotElement | null;
    if (!slot) return null;
    const assigned = slot.assignedElements();
    return assigned[0] ?? null;
  }

  private _onEditorInput = (): void => {
    const editor = this._getEditor();
    if (!editor) return;
    this.value = editor.value;
    this.dispatchEvent(new CustomEvent('value-change', {
      bubbles: true, composed: true, detail: { value: editor.value },
    }));
    this._syncCursorToVisual();
  };

  private _syncCursorToVisual(): void {
    if (this._cursorDebounce) clearTimeout(this._cursorDebounce);
    this._cursorDebounce = setTimeout(() => {
      const editor = this._getEditor();
      const visual = this._getVisualElement();
      if (!editor?.editorView || !visual || !isViewerSyncTarget(visual)) return;
      const pos = editor.editorView.state.selection.main.head;
      const line = editor.editorView.state.doc.lineAt(pos).number;
      visual.syncLine(line);
      this.dispatchEvent(new CustomEvent('cursor-move', {
        bubbles: true, composed: true, detail: { line },
      }));
    }, 50);
  }

  private _onViewerSelect = (e: Event): void => {
    const detail = (e as CustomEvent<ViewerSelectDetail>).detail;
    const editor = this._getEditor();
    if (!editor?.editorView || !detail) return;
    const lineNum = Math.min(detail.line, editor.editorView.state.doc.lines);
    const lineInfo = editor.editorView.state.doc.line(lineNum);
    editor.editorView.dispatch({
      selection: { anchor: lineInfo.from },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    });
  };

  private _onSplitterPointerDown = (e: PointerEvent): void => {
    const splitter = e.currentTarget as HTMLElement;
    splitter.setPointerCapture(e.pointerId);
    const content = this.renderRoot.querySelector('.content') as HTMLElement;

    const onMove = (ev: PointerEvent): void => {
      const rect = content.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      this.controller.setSplitRatio(ratio);
    };

    const onUp = (): void => {
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
    };

    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
  };

  override render() {
    const m = this._mode;
    const editorHidden = m === 'visual';
    const visualHidden = m === 'yaml';
    const showSplitter = m === 'split';
    const editorFlex = m === 'split'
      ? `0 0 ${String(this.splitRatio * 100)}%`
      : '1 1 100%';

    return html`
      <div class="toolbar">
        <button class="mode-btn ${m === 'yaml' ? 'active' : ''}"
                @click=${() => this.controller.setMode('yaml')}
                aria-pressed=${String(m === 'yaml')}>YAML</button>
        <button class="mode-btn ${m === 'split' ? 'active' : ''}"
                @click=${() => this.controller.setMode('split')}
                aria-pressed=${String(m === 'split')}>Split</button>
        <button class="mode-btn ${m === 'visual' ? 'active' : ''}"
                @click=${() => this.controller.setMode('visual')}
                aria-pressed=${String(m === 'visual')}>Visual</button>
      </div>
      <div class="content">
        <div class="editor-pane ${editorHidden ? 'hidden' : ''}"
             style="flex: ${editorFlex}">
          <pages-code-editor
            .value=${this.value}
            .language=${this.language}
            ?readonly=${this.readonly}
            @input=${this._onEditorInput}
          ></pages-code-editor>
        </div>
        ${showSplitter
          ? html`<div class="splitter" @pointerdown=${this._onSplitterPointerDown}></div>`
          : nothing}
        <div class="visual-pane ${visualHidden ? 'hidden' : ''}"
             style="flex: 1 1 0">
          <slot name="visual-pane"></slot>
        </div>
      </div>
    `;
  }
}
