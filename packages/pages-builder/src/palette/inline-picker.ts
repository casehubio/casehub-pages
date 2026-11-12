import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type ComponentCatalogEntry, type FilteredCatalogEntry } from '../catalog/component-catalog.js';
import type { PaletteContext } from '../catalog/palette-context.js';
import { filterCatalog, getCatalogCategories } from './palette-filter.js';

@customElement('pages-builder-inline-picker')
export class PagesBuilderInlinePicker extends LitElement {
  @property({ attribute: false }) context: PaletteContext | undefined;
  @property({ attribute: false }) anchor: HTMLElement | undefined;
  @property({ attribute: false }) anchorRect: DOMRect | undefined;
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _search = '';
  @state() private _activeCategory: string | undefined;

  private _filtered: readonly FilteredCatalogEntry[] = [];
  private _categories: readonly string[] = [];
  private _outsideClickHandler = (e: MouseEvent) => this._handleOutsideClick(e);
  private _dismissTimer: ReturnType<typeof setTimeout> | undefined;
  private _dragState: { startX: number; startY: number; origX: number; origY: number } | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._outsideClickHandler, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._outsideClickHandler, true);
    clearTimeout(this._dismissTimer);
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('context') || changed.has('_search') || changed.has('_activeCategory')) {
      this._recompute();
    }
    if (changed.has('open') && this.open) {
      this._search = '';
      this._activeCategory = undefined;
      this._recompute();
      this._positionNearAnchor();
      void this.updateComplete.then(() => {
        this.shadowRoot?.querySelector<HTMLInputElement>('.picker-search')?.focus();
      });
    }
  }

  private _positionNearAnchor(): void {
    const rect = this.anchorRect ?? this.anchor?.getBoundingClientRect();
    if (!rect || (rect.top === 0 && rect.left === 0 && rect.width === 0)) return;
    this.style.top = `${rect.bottom}px`;
    this.style.left = `${rect.left}px`;
  }

  private _recompute(): void {
    const ctx = this.context ?? {
      parentType: undefined,
      acceptsComponents: true,
      availableDatasets: [],
      siblingTypes: [],
    };
    const allForContext = filterCatalog(ctx);
    const populatedCategories = new Set(allForContext.map(e => e.entry.category));
    this._categories = getCatalogCategories().filter(c => populatedCategories.has(c));
    if (this._activeCategory && !populatedCategories.has(this._activeCategory)) {
      this._activeCategory = undefined;
    }
    this._filtered = filterCatalog(ctx, {
      ...(this._search ? { search: this._search } : {}),
      ...(this._activeCategory ? { category: this._activeCategory } : {}),
    });
  }

  private _handleOutsideClick(e: MouseEvent): void {
    if (!this.open) return;
    const path = e.composedPath();
    if (!path.includes(this) && !path.includes(this.anchor!)) {
      this.open = false;
      this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
    }
  }

  private _handleSearch(e: InputEvent): void {
    this._search = (e.target as HTMLInputElement).value;
  }

  private _handleSelect(entry: ComponentCatalogEntry): void {
    this.dispatchEvent(new CustomEvent('component-select', {
      bubbles: true, composed: true,
      detail: entry,
    }));
    this.open = false;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._close();
    }
  }

  private _close(): void {
    clearTimeout(this._dismissTimer);
    this.open = false;
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  private _handleMouseLeave(): void {
    this._dismissTimer = setTimeout(() => this._close(), 500);
  }

  private _handleMouseEnter(): void {
    clearTimeout(this._dismissTimer);
  }

  private _handleDragStart(e: PointerEvent): void {
    e.preventDefault();
    const rect = this.getBoundingClientRect();
    this._dragState = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const onMove = (ev: PointerEvent) => {
      if (!this._dragState) return;
      this.style.left = `${this._dragState.origX + ev.clientX - this._dragState.startX}px`;
      this.style.top = `${this._dragState.origY + ev.clientY - this._dragState.startY}px`;
    };
    const onUp = () => {
      this._dragState = undefined;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  override render(): TemplateResult {
    if (!this.open) return html``;

    return html`
      <div class="picker-popover" role="listbox" aria-label="Component picker"
        @keydown=${this._handleKeydown}
        @mouseleave=${this._handleMouseLeave}
        @mouseenter=${this._handleMouseEnter}
      >
        <div class="picker-header">
          <div class="drag-handle" @pointerdown=${this._handleDragStart}>⠿</div>
          <button class="close-btn" @click=${this._close} aria-label="Close">✕</button>
        </div>
        <input
          class="picker-search"
          type="text"
          placeholder="Search..."
          .value=${this._search}
          @input=${this._handleSearch}
          aria-label="Search components"
        />

        <div class="picker-categories">
          <button
            class="cat-chip${this._activeCategory === undefined ? ' active' : ''}"
            @click=${() => { this._activeCategory = undefined; }}
          >All</button>
          ${this._categories.map(cat => html`
            <button
              class="cat-chip${this._activeCategory === cat ? ' active' : ''}"
              @click=${() => { this._activeCategory = this._activeCategory === cat ? undefined : cat; }}
            >${cat}</button>
          `)}
        </div>

        <div class="picker-list">
          ${this._filtered.length > 0
            ? this._filtered.map(item => html`
                <button
                  class="picker-item ${item.relevance}"
                  role="option"
                  @click=${() => this._handleSelect(item.entry)}
                >
                  <span class="item-label">${item.entry.label}</span>
                  <span class="item-type">${item.entry.type}</span>
                  ${item.relevance === 'needs-prereq' && item.entry.prereqHint
                    ? html`<span class="item-hint">${item.entry.prereqHint}</span>`
                    : nothing}
                </button>
              `)
            : html`<div class="picker-empty">No matches</div>`
          }
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      position: fixed;
      z-index: 1000;
      font-family: var(--pages-font-family, sans-serif);
      font-size: var(--pages-font-size-sm, 13px);
    }

    :host(:not([open])) {
      display: none;
    }

    .picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 4px 0 8px;
      flex-shrink: 0;
    }

    .drag-handle {
      cursor: grab;
      color: var(--pages-neutral-11);
      font-size: 14px;
      user-select: none;
      padding: 2px 4px;
      letter-spacing: 2px;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .close-btn {
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--pages-neutral-11);
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .close-btn:hover {
      background: var(--pages-neutral-4);
      color: var(--pages-neutral-12);
    }

    .picker-popover {
      width: 280px;
      max-height: 360px;
      display: flex;
      flex-direction: column;
      background: var(--pages-neutral-2);
      border: 1px solid var(--pages-neutral-6);
      border-radius: var(--pages-radius-md, 8px);
      box-shadow: var(--pages-shadow-3, 0 4px 16px rgba(0, 0, 0, 0.12));
      overflow: hidden;
    }

    .picker-search {
      margin: 8px;
      padding: 6px 10px;
      border: 1px solid var(--pages-neutral-6);
      border-radius: var(--pages-radius-sm, 4px);
      font-size: inherit;
      outline: none;
    }

    .picker-search:focus {
      border-color: var(--pages-focus-ring, #4285f4);
    }

    .picker-categories {
      display: flex;
      gap: 4px;
      padding: 0 8px 8px;
      overflow-x: auto;
      flex-shrink: 0;
    }

    .cat-chip {
      padding: 2px 8px;
      border: none;
      border-radius: 12px;
      background: var(--pages-chip-bg, #f1f3f4);
      color: var(--pages-neutral-11);
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
    }

    .cat-chip.active {
      background: var(--pages-accent-9);
      color: #fff;
    }

    .picker-list {
      overflow-y: auto;
      flex: 1;
      padding: 4px 8px 8px;
    }

    .picker-item {
      display: flex;
      flex-direction: column;
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: var(--pages-radius-sm, 4px);
      background: none;
      cursor: pointer;
      text-align: left;
    }

    .picker-item:hover {
      background: var(--pages-neutral-4);
    }

    .picker-item.promoted {
      background: var(--pages-promoted-bg, rgba(52, 168, 83, 0.04));
    }

    .picker-item.needs-prereq {
      opacity: 0.6;
    }

    .item-label {
      font-weight: 500;
    }

    .item-type {
      font-size: 11px;
      color: var(--pages-neutral-11);
    }

    .item-hint {
      font-size: 10px;
      color: var(--pages-warning-color, #ea8600);
    }

    .picker-empty {
      text-align: center;
      padding: 16px;
      color: var(--pages-neutral-11);
    }
  `;
}
