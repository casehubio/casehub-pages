import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('pages-position-picker')
export class PagesPositionPicker extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) anchor: HTMLElement | undefined;
  @property({ type: Boolean }) showReplace = false;

  private _dismissTimer: ReturnType<typeof setTimeout> | undefined;
  private _escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this._dismiss(); };

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open')) {
      if (this.open) {
        this._positionNearAnchor();
        document.addEventListener('keydown', this._escHandler);
      } else {
        document.removeEventListener('keydown', this._escHandler);
        clearTimeout(this._dismissTimer);
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._escHandler);
    clearTimeout(this._dismissTimer);
  }

  private _positionNearAnchor(): void {
    if (!this.anchor) return;
    const anchorRect = this.anchor.getBoundingClientRect();
    this.style.top = `${anchorRect.bottom}px`;
    this.style.left = `${anchorRect.left}px`;
  }

  private _dismiss(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  private _select(position: 'before' | 'after' | 'replace'): void {
    this.dispatchEvent(new CustomEvent('position-select', {
      bubbles: true, composed: true,
      detail: { position },
    }));
    this.open = false;
  }

  private _handleMouseLeave(): void {
    this._dismissTimer = setTimeout(() => this._dismiss(), 500);
  }

  private _handleMouseEnter(): void {
    clearTimeout(this._dismissTimer);
  }

  override render(): TemplateResult {
    if (!this.open) return html``;
    return html`
      <div class="position-popover"
        @mouseleave=${this._handleMouseLeave}
        @mouseenter=${this._handleMouseEnter}
      >
        <button title="Insert before" @click=${() => this._select('before')}>⬆</button>
        ${this.showReplace ? html`<button title="Replace component" @click=${() => this._select('replace')}>⇄</button>` : ''}
        <button title="Insert after" @click=${() => this._select('after')}>⬇</button>
      </div>
    `;
  }

  static override styles = css`
    :host {
      position: fixed;
      z-index: 1001;
      font-family: var(--pages-font-family, sans-serif);
      font-size: var(--pages-font-size-sm, 13px);
    }

    :host(:not([open])) {
      display: none;
    }

    .position-popover {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 3px;
      background: var(--pages-neutral-2);
      border: 1px solid var(--pages-neutral-6);
      border-radius: var(--pages-radius-sm, 4px);
      box-shadow: var(--pages-shadow-2, 0 2px 4px rgba(0, 0, 0, 0.08));
    }

    button {
      width: 20px;
      height: 20px;
      padding: 0;
      border: 1px solid var(--pages-neutral-6);
      border-radius: 4px;
      background: var(--pages-neutral-2);
      color: var(--pages-neutral-11);
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    button:hover {
      background: var(--pages-accent-9);
      color: #fff;
      border-color: var(--pages-accent-9);
    }
  `;
}
