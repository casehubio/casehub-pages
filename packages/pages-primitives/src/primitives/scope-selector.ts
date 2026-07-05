import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { RovingTabindexMixin } from '../a11y/index.js';

export interface ScopeItem {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly badge?: string;
}

@customElement('pages-scope-selector')
export class PagesScopeSelector extends RovingTabindexMixin(LitElement) {
  static override styles = css`
    :host {
      display: inline-flex;
      gap: var(--pages-space-1, 0.25rem);
      align-items: center;
    }

    [role="radio"] {
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

    [role="radio"]:focus-visible {
      box-shadow: 0 0 0 2px var(--pages-accent-7, #93c5fd);
    }

    [role="radio"][aria-checked="true"] {
      background: var(--pages-accent-3, #dbeafe);
      border-color: var(--pages-accent-7, #3b82f6);
      color: var(--pages-accent-11, #1d4ed8);
    }

    .scope-count {
      color: var(--pages-neutral-9, #71717a);
      font-size: var(--pages-text-xs, 0.75rem);
    }

    [role="radio"][aria-checked="true"] .scope-count {
      color: var(--pages-accent-9, #2563eb);
    }

    .scope-badge {
      display: inline-flex;
      align-items: center;
      padding: 0 var(--pages-space-2, 0.5rem);
      border-radius: var(--pages-radius-full, 9999px);
      background: var(--pages-accent-9, #2563eb);
      color: var(--pages-neutral-1, #ffffff);
      font-size: var(--pages-text-xs, 0.75rem);
      line-height: 1.5;
    }
  `;

  override rovingSelector = '[role="radio"]';
  override rovingDirection = 'horizontal' as const;

  @property({ type: Array }) items: ScopeItem[] = [];
  @property({ type: String }) selected: string | null = null;
  @property({ type: Boolean }) allowDeselect = false;

  private _select(item: ScopeItem): void {
    if (this.selected === item.id) {
      if (this.allowDeselect) {
        this.selected = null;
      } else {
        return;
      }
    } else {
      this.selected = item.id;
    }

    this.dispatchEvent(
      new CustomEvent('pages-scope-change', {
        detail: { selected: this.selected },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render(): TemplateResult {
    if (this.items.length === 0) return html`${nothing}`;

    return html`
      <div role="radiogroup" aria-orientation="horizontal">
        ${this.items.map(
          (item) => html`
            <span
              role="radio"
              tabindex="-1"
              aria-checked="${this.selected === item.id}"
              data-id="${item.id}"
              @click="${() => this._select(item)}"
            >
              ${item.label}
              <span class="scope-count">(${item.count})</span>
              ${item.badge
                ? html`<span class="scope-badge">${item.badge}</span>`
                : nothing}
            </span>
          `
        )}
      </div>
    `;
  }
}
