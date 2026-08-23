import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { EventConnection } from '@casehubio/pages-data';
import { KeyboardShortcutMixin } from '@casehubio/pages-primitives';
import { ScenarioConnectionController, type ScenarioState, type OutlineNode } from './scenario-connection-controller.js';
import type { PagesScenarioYamlViewer } from './scenario-yaml-viewer.js';

export class PagesScenarioController extends KeyboardShortcutMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--pages-font-family, system-ui, sans-serif);
      font-size: var(--pages-font-size-base, 14px);
      color: var(--pages-neutral-12, #1a1a1a);
    }
    .error { padding: var(--pages-space-4, 16px); color: var(--pages-danger-9, #dc2626); }
    .outline { padding: var(--pages-space-2, 8px) 0; }
    .outline-empty {
      padding: var(--pages-space-4, 16px);
      color: var(--pages-neutral-8, #999);
      font-style: italic;
    }
    .outline-heading {
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      font-weight: var(--pages-font-weight-medium, 500);
      cursor: pointer;
      border-radius: var(--pages-radius-sm, 4px);
    }
    .outline-heading:hover { background: var(--pages-neutral-3, #f5f5f5); }
    .outline-step {
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      cursor: pointer;
      border-radius: var(--pages-radius-sm, 4px);
      display: flex; align-items: center; gap: var(--pages-space-1, 4px);
    }
    .outline-step:hover { background: var(--pages-neutral-3, #f5f5f5); }
    .outline-step.current {
      background: var(--pages-accent-3, #e8eaf6);
      font-weight: var(--pages-font-weight-medium, 500);
    }
    .outline-step.completed { color: var(--pages-neutral-8, #999); }
    .step-icon { width: 14px; text-align: center; flex-shrink: 0; }
    .transport {
      display: flex; align-items: center; gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-2, 8px);
      border-top: 1px solid var(--pages-neutral-4, #e5e5e5);
      border-bottom: 1px solid var(--pages-neutral-4, #e5e5e5);
    }
    .transport button {
      background: none; border: 1px solid var(--pages-neutral-6, #ccc);
      border-radius: var(--pages-radius-sm, 4px);
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      cursor: pointer; font-size: 16px; line-height: 1;
    }
    .transport button:hover:not(:disabled) { background: var(--pages-neutral-3, #f5f5f5); }
    .transport button:disabled { opacity: 0.4; cursor: not-allowed; }
    .speed-slider { width: 80px; }
    .speed-label { font-size: var(--pages-font-size-sm, 12px); min-width: 36px; }
    .progress { font-size: var(--pages-font-size-sm, 12px); color: var(--pages-neutral-8, #999); margin-left: auto; }
    .status-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      font-size: var(--pages-font-size-sm, 12px);
      color: var(--pages-neutral-8, #999);
    }
    .connection-status { display: flex; align-items: center; gap: 4px; }
    .connection-status.connected { color: var(--pages-success-9, #16a34a); }
    .connection-status.reconnecting { color: var(--pages-warning-9, #ca8a04); }
    .connection-status.disconnected { color: var(--pages-danger-9, #dc2626); }

    :host([mode="compact"]) {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      width: auto; font-size: var(--pages-font-size-sm, 12px);
    }
    .compact-pill {
      display: flex; align-items: center; gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
      background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
      color: #e2e8f0; border-radius: var(--pages-radius-lg, 8px);
      cursor: pointer; user-select: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap;
    }
    .compact-pill:hover { background: rgba(15, 23, 42, 0.95); }
    .compact-pill button {
      background: none; border: none; color: #38bdf8;
      cursor: pointer; font-size: 14px; padding: 0; line-height: 1;
    }
    .compact-pill .scenario-name {
      color: #94a3b8; font-size: var(--pages-font-size-sm, 12px);
      max-width: 160px; overflow: hidden; text-overflow: ellipsis;
    }
    .compact-pill .progress-pct { color: #38bdf8; font-weight: 600; font-size: var(--pages-font-size-sm, 12px); }

    .compact-card {
      background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
      border-radius: var(--pages-radius-lg, 8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4); color: #e2e8f0;
      width: 280px; max-height: 60vh; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .compact-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
      cursor: grab; border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .compact-header:active { cursor: grabbing; }
    .compact-header .scenario-name { color: #94a3b8; font-size: var(--pages-font-size-sm, 12px); }
    .compact-header button {
      background: none; border: none; color: #64748b;
      cursor: pointer; font-size: 14px; padding: 0; line-height: 1;
    }
    .compact-header button:hover { color: #e2e8f0; }
    .compact-body { overflow-y: auto; flex: 1; }

    :host([mode="compact"]) .outline-empty { color: #64748b; }
    :host([mode="compact"]) .outline-heading { color: #e2e8f0; }
    :host([mode="compact"]) .outline-heading:hover { background: rgba(255,255,255,0.05); }
    :host([mode="compact"]) .outline-step { color: #94a3b8; }
    :host([mode="compact"]) .outline-step:hover { background: rgba(255,255,255,0.05); }
    :host([mode="compact"]) .outline-step.current { background: rgba(56,189,248,0.15); color: #38bdf8; }
    :host([mode="compact"]) .outline-step.completed { color: #475569; }
    :host([mode="compact"]) .transport { border-color: rgba(255,255,255,0.1); }
    :host([mode="compact"]) .transport button { color: #94a3b8; border-color: rgba(255,255,255,0.15); }
    :host([mode="compact"]) .transport button:hover:not(:disabled) { background: rgba(255,255,255,0.05); color: #e2e8f0; }
    :host([mode="compact"]) .status-bar { color: #475569; }
    :host([mode="compact"]) .connection-status.connected { color: #4ade80; }
    :host([mode="compact"]) .connection-status.disconnected { color: #f87171; }
    :host([mode="compact"]) .speed-label { color: #94a3b8; }
    :host([mode="compact"]) .progress { color: #38bdf8; }

    .demo-actions { display: flex; gap: var(--pages-space-2, 8px); padding: var(--pages-space-2, 8px); }
    .demo-btn {
      flex: 1; padding: var(--pages-space-2, 8px);
      border: none; border-radius: var(--pages-radius-sm, 4px);
      font-size: var(--pages-font-size-sm, 12px); font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .demo-btn-start { background: #2563eb; color: white; }
    .demo-btn-start:hover { background: #1d4ed8; }
    .demo-btn-restart { background: #334155; color: #e2e8f0; }
    .demo-btn-restart:hover { background: #475569; }
    :host(:not([mode="compact"])) .demo-btn-start { background: var(--pages-accent-9, #2563eb); color: white; }
    :host(:not([mode="compact"])) .demo-btn-restart { background: var(--pages-neutral-4, #e5e5e5); color: var(--pages-neutral-12, #1a1a1a); }
  `;

  @property({ attribute: false }) connection?: EventConnection;
  @property({ attribute: false }) eventTarget?: EventTarget;
  @property() baseUrl?: string;
  @property({ reflect: true }) mode: 'full' | 'compact' = 'full';
  @property() scenario?: string;

  @state() private _expanded = false;
  @state() private _yamlOpen = false;

  @state() private _outline: OutlineNode[] = [];

  private _conn!: ScenarioConnectionController;
  private _speedDebounce: ReturnType<typeof setTimeout> | null = null;
  private _yamlViewer: PagesScenarioYamlViewer | null = null;
  private _popoutWindow: Window | null = null;
  private _popoutPoll: ReturnType<typeof setInterval> | null = null;
  @state() private _docked = true;

  override connectedCallback(): void {
    super.connectedCallback();
    this.registerShortcut(' ', () => {
      if (!this._conn?.state?.scenario) return;
      void this._conn.sendCommand(this._conn.state.paused ? '/resume' : '/pause');
    }, { description: 'Toggle play/pause' });
    this.registerShortcut('ArrowRight', () => {
      if (!this._conn?.state?.scenario) return;
      void this._conn.sendCommand('/step');
    }, { description: 'Step forward' });
  }

  protected override firstUpdated(): void {
    this._conn = new ScenarioConnectionController(this, {
      connection: this.connection,
      eventTarget: this.eventTarget,
      baseUrl: this.baseUrl,
      onState: (s: ScenarioState) => this._onStateChange(s),
    });
  }

  private _onStateChange(s: ScenarioState): void {
    if (s.scenario && this._outline.length === 0) void this._fetchOutline();
    if (!s.scenario) this._outline = [];
  }

  private async _fetchOutline(): Promise<void> {
    try {
      const resp = await fetch(`${this._conn.restBase}/scenario/outline`);
      if (resp.ok) {
        const data: unknown = await resp.json();
        this._outline = Array.isArray(data) ? data as OutlineNode[] : [];
      }
    } catch {
      // Ignore — will retry on next state change
    }
  }

  private _flattenLabels(nodes: OutlineNode[]): string[] {
    const result: string[] = [];
    for (const node of nodes) {
      if (node.children.length === 0) result.push(node.label);
      else result.push(...this._flattenLabels(node.children));
    }
    return result;
  }

  private _isBeforeCurrent(label: string): boolean {
    const labels = this._flattenLabels(this._outline);
    const currentIdx = labels.indexOf(this._conn?.state.step ?? '');
    const labelIdx = labels.indexOf(label);
    return labelIdx >= 0 && currentIdx >= 0 && labelIdx < currentIdx;
  }

  override render(): TemplateResult {
    if (!this.connection && !this.baseUrl) {
      return html`<div class="error">No connection configured</div>`;
    }
    if (this.mode === 'compact') {
      return this._expanded ? this._renderCompactCard() : this._renderCompactPill();
    }
    return html`
      ${this._renderOutline()}
      ${this._renderDemoActions()}
      ${this._renderTransport()}
      ${this._renderStatus()}
    `;
  }

  private _renderOutline(): TemplateResult {
    if (this._outline.length === 0) {
      return html`<div class="outline-empty">No scenario running</div>`;
    }
    return html`
      <div class="outline" role="tree" aria-label="Scenario outline">
        ${this._outline.map(node => this._renderNode(node, 0))}
      </div>
    `;
  }

  private _renderNode(node: OutlineNode, depth: number): TemplateResult {
    const isLeaf = node.children.length === 0;
    const isCurrent = isLeaf && node.label === this._conn?.state.step;
    const isCompleted = isLeaf && this._isBeforeCurrent(node.label);

    if (isLeaf) {
      return html`
        <div class="outline-step ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}"
             role="treeitem" tabindex="-1"
             style="padding-left: ${depth * 16 + 8}px"
             @click=${() => void this._conn.sendCommand('/run-to', { label: node.label })}>
          <span class="step-icon">${isCurrent ? '●' : isCompleted ? '✓' : '○'}</span>
          ${node.label}
        </div>
      `;
    }
    return html`
      <div class="outline-group" role="group">
        <div class="outline-heading" role="treeitem" tabindex="-1"
             style="padding-left: ${depth * 16}px"
             @click=${() => void this._conn.sendCommand('/run-to', { label: node.label })}>
          ${node.label}
        </div>
        ${node.children.map(child => this._renderNode(child, depth + 1))}
      </div>
    `;
  }

  private _renderTransport(): TemplateResult {
    const s = this._conn?.state;
    const hasScenario = !!s?.scenario;
    return html`
      <div class="transport">
        <button aria-label=${s?.paused ? 'Resume' : 'Pause'}
                ?disabled=${!hasScenario}
                @click=${() => void this._conn.sendCommand(s?.paused ? '/resume' : '/pause')}>
          ${s?.paused ? '▶' : '⏸'}
        </button>
        <button aria-label="Step" ?disabled=${!hasScenario}
                @click=${() => void this._conn.sendCommand('/step')}>
          ⏩
        </button>
        <input type="range" class="speed-slider"
               min="-2" max="1" step="0.01"
               .value=${String(Math.log10(s?.speed ?? 1))}
               ?disabled=${!hasScenario}
               aria-label="Speed"
               aria-valuemin="0.01" aria-valuemax="10"
               aria-valuenow=${String(s?.speed ?? 1)}
               aria-valuetext="${(s?.speed ?? 1).toFixed(1)}x speed"
               @input=${this._onSpeedChange}>
        <span class="speed-label">${(s?.speed ?? 1).toFixed(1)}x</span>
        <span class="progress">${Math.round((s?.progress ?? 0) * 100)}%</span>
      </div>
    `;
  }

  private _onSpeedChange(e: Event): void {
    const logVal = parseFloat((e.target as HTMLInputElement).value);
    const speed = Math.pow(10, logVal);
    if (this._speedDebounce) clearTimeout(this._speedDebounce);
    this._speedDebounce = setTimeout(() => {
      void this._conn.sendCommand('/speed', { speed: Math.round(speed * 100) / 100 });
    }, 250);
  }

  private _renderStatus(): TemplateResult {
    const s = this._conn?.state;
    const status = this._conn?.connectionStatus ?? 'disconnected';
    const breadcrumb = [s?.chapter, s?.section, s?.step]
      .filter(Boolean).join(' → ');
    return html`
      <div class="status-bar">
        <span class="breadcrumb">${breadcrumb || 'Idle'}</span>
        <span class="connection-status ${status}">
          ● ${status}
        </span>
      </div>
    `;
  }

  private _renderCompactPill(): TemplateResult {
    const s = this._conn?.state;
    const name = s?.scenario ?? 'No scenario';
    const pct = Math.round((s?.progress ?? 0) * 100);
    return html`
      <div class="compact-pill"
           @click=${() => { this._expanded = true; }}
           @pointerdown=${this._onDragStart}>
        <button aria-label=${s?.paused !== false ? 'Resume' : 'Pause'}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  if (s?.scenario) void this._conn.sendCommand(s.paused ? '/resume' : '/pause');
                }}>
          ${s?.paused !== false ? '▶' : '⏸'}
        </button>
        <span class="scenario-name">${name}</span>
        <span class="progress-pct">${pct}%</span>
      </div>
    `;
  }

  private _renderCompactCard(): TemplateResult {
    const s = this._conn?.state;
    const name = s?.scenario ?? 'No scenario';
    return html`
      <div class="compact-card">
        <div class="compact-header" @pointerdown=${this._onDragStart}>
          <span class="scenario-name">${name}</span>
          <button aria-label="Toggle source" @click=${() => this._toggleYaml()}>&lt;/&gt;</button>
          ${this._yamlOpen ? (this._docked
            ? html`<button aria-label="Undock viewer" @click=${() => this._undockViewer()} title="Undock panels">⊟</button>`
            : html`<button aria-label="Dock viewer" @click=${() => this._dockViewer()} title="Dock panels">⊞</button>`
          ) : nothing}
          <button aria-label="Collapse" @click=${() => { this._expanded = false; }}>✕</button>
        </div>
        <div class="compact-body">
          ${this._renderOutline()}
        </div>
        ${this._renderDemoActions()}
        ${this._renderTransport()}
        ${this._renderStatus()}
      </div>
    `;
  }

  private async _startDemo(): Promise<void> {
    if (!this.scenario || !this._conn) return;
    try {
      const resp = await fetch(`${this._conn.restBase}/scenarios/${this.scenario}.yaml`);
      if (!resp.ok) return;
      const yaml = await resp.text();
      await this._conn.sendCommand('/start', { yaml, paused: true });
    } catch { /* ignore */ }
  }

  private async _restartDemo(): Promise<void> {
    if (!this._conn) return;
    try {
      await this._conn.sendCommand('/reset');
      window.location.reload();
    } catch { /* ignore */ }
  }

  private _renderDemoActions(): TemplateResult {
    const s = this._conn?.state;
    const hasScenario = !!s?.scenario;

    if (!this.scenario) return html``;

    if (!hasScenario) {
      return html`<div class="demo-actions">
        <button class="demo-btn demo-btn-start" @click=${() => void this._startDemo()}>Start Demo</button>
      </div>`;
    }
    return html`<div class="demo-actions">
      <button class="demo-btn demo-btn-restart" @click=${() => void this._restartDemo()}>Reset</button>
    </div>`;
  }

  private _toggleYaml(): void {
    this._yamlOpen = !this._yamlOpen;
    if (this._yamlOpen) {
      this._showYamlViewer();
    } else {
      this._hideYamlViewer();
    }
  }

  private _showYamlViewer(): void {
    if (!this._yamlViewer) {
      const viewer = document.createElement('pages-scenario-yaml-viewer') as PagesScenarioYamlViewer;
      viewer.connection = this.connection;
      viewer.eventTarget = this.eventTarget;
      if (this.baseUrl) viewer.baseUrl = this.baseUrl;
      if (this.scenario) viewer.scenario = this.scenario;
      viewer.onClose = () => this._toggleYaml();
      viewer.onDetach = () => this._detachYaml();
      viewer.onDragMove = (left: number, top: number) => this._onViewerDrag(left, top);
      viewer.onDragEnd = () => this._onViewerDragEnd();
      document.body.appendChild(viewer);
      this._yamlViewer = viewer;
      this._docked = true;
    }
    this._yamlViewer.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this._snapViewerToController());
    });
  }

  private _snapViewerToController(): void {
    if (!this._yamlViewer) return;
    const hostRect = this.getBoundingClientRect();
    const viewerRect = this._yamlViewer.getBoundingClientRect();
    const viewerWidth = viewerRect.width > 0 ? viewerRect.width : 360;
    const left = hostRect.left - viewerWidth - 8;
    const top = hostRect.top;
    this._yamlViewer.setPosition(left, top);
    this._docked = true;
  }

  private _onViewerDrag(left: number, _top: number): void {
    if (!this._docked) return;
    const hostRect = this.getBoundingClientRect();
    const viewerRect = this._yamlViewer!.getBoundingClientRect();
    const gap = hostRect.left - (left + viewerRect.width);
    if (Math.abs(gap - 8) > 30) {
      this._docked = false;
      return;
    }
    this.style.left = `${left + viewerRect.width + 8}px`;
    this.style.top = `${_top}px`;
    this.style.right = 'auto';
    this.style.bottom = 'auto';
  }

  private _onViewerDragEnd(): void {
    this._trySnap();
  }

  private _trySnap(): void {
    if (!this._yamlViewer || this._docked) return;
    const hostRect = this.getBoundingClientRect();
    const viewerRect = this._yamlViewer.getBoundingClientRect();
    const gap = hostRect.left - (viewerRect.left + viewerRect.width);
    if (Math.abs(gap) < 30 && Math.abs(hostRect.top - viewerRect.top) < 30) {
      this._snapViewerToController();
    }
  }

  private _undockViewer(): void {
    this._docked = false;
  }

  private _dockViewer(): void {
    this._snapViewerToController();
  }

  private _hideYamlViewer(): void {
    if (this._yamlViewer) {
      this._yamlViewer.style.display = 'none';
    }
  }

  private _detachYaml(): void {
    const base = this._conn?.restBase ?? this.baseUrl ?? window.location.origin;
    const scenario = this.scenario ?? this._conn?.state.scenario ?? '';
    const url = `${base}/scenario/yaml-viewer.html?baseUrl=${encodeURIComponent(base)}&scenario=${encodeURIComponent(scenario)}`;
    this._popoutWindow = window.open(url, 'yaml-viewer', 'width=400,height=600');
    this._hideYamlViewer();
    this._yamlOpen = false;
    if (this._popoutPoll) clearInterval(this._popoutPoll);
    this._popoutPoll = setInterval(() => {
      if (this._popoutWindow?.closed) {
        this._popoutWindow = null;
        if (this._popoutPoll) {
          clearInterval(this._popoutPoll);
          this._popoutPoll = null;
        }
      }
    }, 500);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._yamlViewer?.parentNode) {
      this._yamlViewer.parentNode.removeChild(this._yamlViewer);
      this._yamlViewer = null;
    }
    if (this._popoutPoll) {
      clearInterval(this._popoutPoll);
      this._popoutPoll = null;
    }
  }

  private _dragOffset = { x: 0, y: 0 };

  private _onDragStart = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    const host = this.getBoundingClientRect();
    this._dragOffset = { x: e.clientX - host.left, y: e.clientY - host.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).addEventListener('pointermove', this._onDragMove);
    (e.currentTarget as HTMLElement).addEventListener('pointerup', this._onDragEnd);
  };

  private _onDragMove = (e: PointerEvent): void => {
    const left = e.clientX - this._dragOffset.x;
    const top = e.clientY - this._dragOffset.y;
    this.style.left = `${left}px`;
    this.style.top = `${top}px`;
    this.style.right = 'auto';
    this.style.bottom = 'auto';
    if (this._docked && this._yamlViewer) {
      const viewerWidth = this._yamlViewer.getBoundingClientRect().width;
      this._yamlViewer.setPosition(left - viewerWidth - 8, top);
    }
  };

  private _onDragEnd = (e: PointerEvent): void => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).removeEventListener('pointermove', this._onDragMove);
    (e.currentTarget as HTMLElement).removeEventListener('pointerup', this._onDragEnd);
    this._trySnap();
  };
}

if (!customElements.get('pages-scenario-controller')) {
  customElements.define('pages-scenario-controller', PagesScenarioController);
}
