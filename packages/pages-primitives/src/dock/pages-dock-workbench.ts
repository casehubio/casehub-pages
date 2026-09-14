import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

export class PagesDockWorkbench extends LitElement {
  @property({ type: Number, attribute: 'left-width' }) leftWidth = 260;
  @property({ type: Number, attribute: 'right-width' }) rightWidth = 320;
  @property({ type: Number, attribute: 'bottom-height' }) bottomHeight = 200;
  @property({ type: Number, attribute: 'min-panel-size' }) minPanelSize = 120;
  @property({ type: Number, attribute: 'max-panel-size' }) maxPanelSize = 600;

  @property({ type: Boolean, attribute: 'left-collapsed' }) leftCollapsed = false;
  @property({ type: Boolean, attribute: 'right-collapsed' }) rightCollapsed = false;
  @property({ type: Boolean, attribute: 'bottom-collapsed' }) bottomCollapsed = true;

  @property({ type: Boolean, attribute: 'left-enabled' }) leftEnabled = true;
  @property({ type: Boolean, attribute: 'right-enabled' }) rightEnabled = true;
  @property({ type: Boolean, attribute: 'bottom-enabled' }) bottomEnabled = true;

  @property({ type: Boolean, attribute: 'show-toggle-bar' }) showToggleBar = true;
  @property({ attribute: 'persist-key' }) persistKey?: string;

  @state() private _resizing: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadPersisted();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._persistDebounceTimer);
  }

  private _loadPersisted(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    try {
      const data = JSON.parse(localStorage.getItem(this.persistKey) ?? '{}');
      if (data.leftWidth) this.leftWidth = data.leftWidth;
      if (data.rightWidth) this.rightWidth = data.rightWidth;
      if (data.bottomHeight) this.bottomHeight = data.bottomHeight;
      if (data.leftCollapsed != null) this.leftCollapsed = data.leftCollapsed;
      if (data.rightCollapsed != null) this.rightCollapsed = data.rightCollapsed;
      if (data.bottomCollapsed != null) this.bottomCollapsed = data.bottomCollapsed;
    } catch { /* ignore */ }
  }

  private _persistDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  private _persist(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    clearTimeout(this._persistDebounceTimer);
    this._persistDebounceTimer = setTimeout(() => {
      localStorage.setItem(this.persistKey!, JSON.stringify({
        leftWidth: this.leftWidth,
        rightWidth: this.rightWidth,
        bottomHeight: this.bottomHeight,
        leftCollapsed: this.leftCollapsed,
        rightCollapsed: this.rightCollapsed,
        bottomCollapsed: this.bottomCollapsed,
      }));
    }, 300);
  }

  toggleZone(zone: string): void {
    if (zone === 'left') this.leftCollapsed = !this.leftCollapsed;
    else if (zone === 'right') this.rightCollapsed = !this.rightCollapsed;
    else if (zone === 'bottom') this.bottomCollapsed = !this.bottomCollapsed;
    this._persist();
    this.dispatchEvent(new CustomEvent('dock-panel-toggle', {
      bubbles: true, composed: true,
      detail: { zone, collapsed: zone === 'left' ? this.leftCollapsed : zone === 'right' ? this.rightCollapsed : this.bottomCollapsed },
    }));
  }

  private _handleResizeStart(zone: string, e: PointerEvent): void {
    e.preventDefault();
    this._resizing = zone;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
  }

  private _handleResizeMove(zone: string, e: PointerEvent): void {
    if (this._resizing !== zone) return;
    const rect = this.getBoundingClientRect();
    if (zone === 'left') {
      this.leftWidth = Math.max(this.minPanelSize, Math.min(this.maxPanelSize, e.clientX - rect.left));
    } else if (zone === 'right') {
      this.rightWidth = Math.max(this.minPanelSize, Math.min(this.maxPanelSize, rect.right - e.clientX));
    } else if (zone === 'bottom') {
      this.bottomHeight = Math.max(this.minPanelSize, Math.min(this.maxPanelSize, rect.bottom - e.clientY));
    }
  }

  private _handleResizeEnd(e: PointerEvent): void {
    if (!this._resizing) return;
    const zone = this._resizing;
    this._resizing = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    this._persist();
    this.dispatchEvent(new CustomEvent('dock-panel-resize', {
      bubbles: true, composed: true,
      detail: { zone, size: zone === 'left' ? this.leftWidth : zone === 'right' ? this.rightWidth : this.bottomHeight },
    }));
  }

  override render(): TemplateResult {
    const showLeft = this.leftEnabled && !this.leftCollapsed;
    const showRight = this.rightEnabled && !this.rightCollapsed;
    const showBottom = this.bottomEnabled && !this.bottomCollapsed;

    return html`
      <div class="dock-layout">
        <div class="dock-main">
          ${this.leftEnabled ? html`
            ${!showLeft && this.showToggleBar ? html`
              <div class="toggle-bar toggle-bar-left" role="toolbar" aria-label="Left panel toggle">
                <button class="toggle-btn" aria-label="Toggle left panel" @click=${() => this.toggleZone('left')}>◧</button>
                <slot name="toggle-bar-left"></slot>
              </div>
            ` : nothing}
            ${showLeft ? html`
              <div class="zone zone-left" role="region" aria-label="Left panel" style="width: ${this.leftWidth}px">
                <slot name="left"></slot>
              </div>
              ${this.showToggleBar ? html`
                <div class="toggle-bar toggle-bar-left" role="toolbar" aria-label="Left panel toggle">
                  <button class="toggle-btn active" aria-label="Toggle left panel" @click=${() => this.toggleZone('left')}>◧</button>
                  <slot name="toggle-bar-left"></slot>
                </div>
              ` : nothing}
              <div class="resize-handle resize-left"
                role="separator" aria-orientation="vertical" aria-label="Resize left panel"
                aria-valuenow="${this.leftWidth}"
                @pointerdown=${(e: PointerEvent) => this._handleResizeStart('left', e)}
                @pointermove=${(e: PointerEvent) => this._handleResizeMove('left', e)}
                @pointerup=${(e: PointerEvent) => this._handleResizeEnd(e)}
              ></div>
            ` : nothing}
          ` : nothing}

          <div class="zone zone-centre" role="region" aria-label="Centre panel">
            <slot name="centre"></slot>
          </div>

          ${this.rightEnabled ? html`
            ${showRight ? html`
              <div class="resize-handle resize-right"
                role="separator" aria-orientation="vertical" aria-label="Resize right panel"
                aria-valuenow="${this.rightWidth}"
                @pointerdown=${(e: PointerEvent) => this._handleResizeStart('right', e)}
                @pointermove=${(e: PointerEvent) => this._handleResizeMove('right', e)}
                @pointerup=${(e: PointerEvent) => this._handleResizeEnd(e)}
              ></div>
              <div class="zone zone-right" role="region" aria-label="Right panel" style="width: ${this.rightWidth}px">
                <slot name="right"></slot>
              </div>
            ` : nothing}
            ${this.showToggleBar && this.rightEnabled ? html`
              <div class="toggle-bar toggle-bar-right" role="toolbar" aria-label="Right panel toggle">
                <slot name="toggle-bar-right"></slot>
              </div>
            ` : nothing}
          ` : nothing}
        </div>

        ${this.bottomEnabled ? html`
          ${showBottom ? html`
            <div class="resize-handle resize-bottom"
              role="separator" aria-orientation="horizontal" aria-label="Resize bottom panel"
              aria-valuenow="${this.bottomHeight}"
              @pointerdown=${(e: PointerEvent) => this._handleResizeStart('bottom', e)}
              @pointermove=${(e: PointerEvent) => this._handleResizeMove('bottom', e)}
              @pointerup=${(e: PointerEvent) => this._handleResizeEnd(e)}
            ></div>
            <div class="zone zone-bottom" role="region" aria-label="Bottom panel" style="height: ${this.bottomHeight}px">
              <slot name="bottom"></slot>
            </div>
          ` : nothing}
        ` : nothing}

        <slot name="status-bar"></slot>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      font-family: var(--pages-font-family, sans-serif);
    }

    .dock-layout {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .dock-main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .zone {
      overflow: auto;
    }

    .zone-left, .zone-right {
      flex-shrink: 0;
    }

    .zone-centre {
      flex: 1;
      min-width: 0;
    }

    .zone-bottom {
      flex-shrink: 0;
      border-top: 1px solid var(--pages-border-color, #dadce0);
    }

    .resize-handle {
      flex-shrink: 0;
      background: transparent;
      transition: background 0.15s;
      touch-action: none;
    }

    .resize-handle:hover, .resize-handle:active {
      background: var(--pages-primary, #1967d2);
    }

    .resize-left, .resize-right {
      width: 4px;
      cursor: col-resize;
    }

    .resize-bottom {
      height: 4px;
      cursor: row-resize;
    }

    .toggle-bar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 4px;
      border-left: 1px solid var(--pages-border-color, #dadce0);
      flex-shrink: 0;
    }

    .toggle-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--pages-radius-sm, 4px);
      background: none;
      cursor: pointer;
      font-size: 16px;
      color: var(--pages-text-secondary, #5f6368);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toggle-btn:hover {
      background: var(--pages-hover-bg, rgba(0, 0, 0, 0.04));
    }

    .toggle-btn.active {
      color: var(--pages-primary, #1967d2);
      background: rgba(25, 103, 210, 0.08);
    }
  `;
}

if (!customElements.get('pages-dock-workbench')) {
  customElements.define('pages-dock-workbench', PagesDockWorkbench);
}
