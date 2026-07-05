import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { RovingTabindexMixin } from '../a11y/index.js';

export interface ChipItem {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

@customElement('pages-filter-chips')
export class PagesFilterChips extends RovingTabindexMixin(LitElement) {
  static override styles = css`
    :host {
      display: inline-flex;
      gap: var(--pages-space-2, 0.5rem);
      align-items: center;
    }

    :host([disabled]) {
      pointer-events: none;
      opacity: var(--pages-opacity-disabled, 0.5);
    }

    [role="option"] {
      display: inline-flex;
      align-items: center;
      gap: var(--pages-space-1, 0.25rem);
      padding: var(--pages-space-1, 0.25rem) var(--pages-space-3, 0.75rem);
      border-radius: var(--pages-radius-full, 9999px);
      border: 1px solid var(--pages-neutral-6, #d4d4d8);
      background: var(--pages-neutral-2, #fafafa);
      color: var(--pages-neutral-12, #18181b);
      font-size: var(--pages-text-sm, 0.875rem);
      cursor: pointer;
      user-select: none;
      transition: background var(--pages-duration-fast, 150ms),
                  border-color var(--pages-duration-fast, 150ms);
      outline: none;
    }

    [role="option"]:focus-visible {
      box-shadow: 0 0 0 2px var(--pages-accent-7, #93c5fd);
    }

    [role="option"][aria-selected="true"] {
      background: var(--pages-accent-3, #dbeafe);
      border-color: var(--pages-accent-7, #3b82f6);
      color: var(--pages-accent-11, #1d4ed8);
    }

    [role="option"][aria-disabled="true"] {
      opacity: var(--pages-opacity-disabled, 0.4);
      cursor: default;
      pointer-events: none;
    }

    .chip-count {
      color: var(--pages-neutral-9, #71717a);
      font-size: var(--pages-text-xs, 0.75rem);
    }

    [role="option"][aria-selected="true"] .chip-count {
      color: var(--pages-accent-9, #2563eb);
    }
  `;

  override rovingSelector = '[role="option"]';
  override rovingDirection = 'horizontal' as const;

  @property({ type: Array }) items: ChipItem[] = [];
  @property({ type: Array }) selected: string[] = [];
  @property({ type: Boolean, reflect: true }) disabled = false;

  private _toggle(item: ChipItem): void {
    if (this.disabled || item.count === 0) return;

    const idx = this.selected.indexOf(item.id);
    if (idx >= 0) {
      this.selected = [...this.selected.slice(0, idx), ...this.selected.slice(idx + 1)];
    } else {
      this.selected = [...this.selected, item.id];
    }

    this.dispatchEvent(
      new CustomEvent('pages-filter-chips-change', {
        detail: { selected: [...this.selected] },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render(): TemplateResult {
    if (this.items.length === 0) return html`${nothing}`;

    return html`
      <div role="listbox" aria-orientation="horizontal" aria-multiselectable="true">
        ${this.items.map(
          (item) => html`
            <span
              role="option"
              tabindex="-1"
              aria-selected="${this.selected.includes(item.id)}"
              aria-disabled="${item.count === 0}"
              data-id="${item.id}"
              @click="${() => this._toggle(item)}"
            >
              ${item.label} <span class="chip-count">(${item.count})</span>
            </span>
          `
        )}
      </div>
    `;
  }
}
