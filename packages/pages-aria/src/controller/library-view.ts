import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { AriaTarget } from '@casehubio/pages-primitives';
import { probeReadiness, type ReadinessStatus } from './readiness-probe.js';

export interface ScriptDescriptor {
  name: string;
  description?: string;
  labels: string[];
  tags: string[];
  params: { name: string; type: string; required: boolean }[];
  calls: string[];
  provenance: string;
  firstStepTargets: AriaTarget[];
}

export class PagesLibraryView extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--pages-font-family, system-ui, sans-serif);
      color: var(--pages-neutral-12, #1a1a1a);
    }
    .search {
      padding: var(--pages-space-2, 8px);
      border-bottom: 1px solid var(--pages-neutral-4, #e5e5e5);
    }
    .search input {
      width: 100%; box-sizing: border-box;
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      border: 1px solid var(--pages-neutral-5, #ddd);
      border-radius: var(--pages-radius-sm, 4px);
      font-size: var(--pages-font-size-sm, 12px);
      background: var(--pages-neutral-1, #fff);
      color: var(--pages-neutral-12, #1a1a1a);
    }
    .search input::placeholder { color: var(--pages-neutral-8, #999); }
    .filters {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 4px var(--pages-space-2, 8px);
    }
    .filter-chip {
      font-size: 10px; padding: 2px 6px;
      border-radius: var(--pages-radius-sm, 4px);
      background: var(--pages-accent-3, #e8eaf6);
      color: var(--pages-accent-11, #1e3a5f);
      cursor: pointer;
    }
    .filter-chip.active { background: var(--pages-accent-9, #2563eb); color: white; }
    .script-list { padding: var(--pages-space-2, 8px) 0; }
    .script-item {
      padding: var(--pages-space-2, 8px);
      border-bottom: 1px solid var(--pages-neutral-4, #e5e5e5);
      display: flex; align-items: flex-start; gap: var(--pages-space-2, 8px);
    }
    .script-item:hover { background: var(--pages-neutral-3, #f5f5f5); }
    .readiness {
      font-size: 10px; font-weight: 600;
      padding: 2px 6px; border-radius: var(--pages-radius-sm, 4px);
      flex-shrink: 0; min-width: 52px; text-align: center;
    }
    .readiness-ready { background: var(--pages-success-3, #dcfce7); color: var(--pages-success-11, #166534); }
    .readiness-not-ready { background: var(--pages-danger-3, #fee2e2); color: var(--pages-danger-11, #991b1b); }
    .readiness-unknown { background: var(--pages-warning-3, #fef3c7); color: var(--pages-warning-11, #92400e); }
    .script-info { flex: 1; min-width: 0; }
    .script-name {
      font-weight: var(--pages-font-weight-medium, 500);
      font-size: var(--pages-font-size-base, 14px);
      color: var(--pages-neutral-12, #1a1a1a);
    }
    .script-desc {
      font-size: var(--pages-font-size-sm, 12px);
      color: var(--pages-neutral-9, #777);
      margin-top: 2px;
    }
    .script-meta {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;
    }
    .label-chip {
      font-size: 10px; padding: 1px 4px;
      border-radius: 2px;
      background: var(--pages-neutral-3, #f5f5f5);
      color: var(--pages-neutral-10, #555);
    }
    .provenance {
      font-size: 9px; padding: 1px 4px;
      border-radius: 2px; text-transform: lowercase;
      background: var(--pages-neutral-3, #f5f5f5);
      color: var(--pages-neutral-8, #999);
    }
    .run-btn {
      flex-shrink: 0; padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      background: var(--pages-accent-9, #2563eb); color: white;
      border: none; border-radius: var(--pages-radius-sm, 4px);
      cursor: pointer; font-size: var(--pages-font-size-sm, 12px);
    }
    .run-btn:hover { background: var(--pages-accent-10, #1d4ed8); }
    .empty {
      padding: var(--pages-space-4, 16px);
      color: var(--pages-neutral-8, #999);
      text-align: center; font-style: italic;
    }
  `;

  @property() baseUrl = '';
  @state() searchText = '';
  @state() filterLabels: string[] = [];

  @state() private _scripts: ScriptDescriptor[] = [];
  @state() private _readiness = new Map<string, ReadinessStatus>();
  @state() private _allLabels: string[] = [];

  @property({ attribute: false })
  set scripts(value: ScriptDescriptor[]) {
    this._scripts = value;
    this._allLabels = [...new Set(value.flatMap(s => s.labels))];
    this._probeAll();
  }

  get scripts(): ScriptDescriptor[] {
    return this._scripts;
  }

  async loadLibrary(): Promise<void> {
    try {
      const resp = await fetch(`${this.baseUrl}/scenario/library`);
      if (!resp.ok) return;
      this.scripts = await resp.json() as ScriptDescriptor[];
    } catch { /* ignore */ }
  }

  private _probeAll(): void {
    const readiness = new Map<string, ReadinessStatus>();
    for (const script of this._scripts) {
      readiness.set(script.name, probeReadiness(script.firstStepTargets));
    }
    this._readiness = readiness;
  }

  private get _filtered(): ScriptDescriptor[] {
    let result = this._scripts;
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q));
    }
    if (this.filterLabels.length > 0) {
      result = result.filter(s =>
        this.filterLabels.every(l => s.labels.includes(l)));
    }
    return result;
  }

  override render(): TemplateResult {
    return html`
      <div class="search">
        <input type="text" placeholder="Search scripts..."
               .value=${this.searchText}
               @input=${(e: Event) => { this.searchText = (e.target as HTMLInputElement).value; }}
               aria-label="Search scripts">
      </div>
      ${this._allLabels.length > 0 ? html`
        <div class="filters">
          ${this._allLabels.map(label => html`
            <span class="filter-chip ${this.filterLabels.includes(label) ? 'active' : ''}"
                  @click=${() => this._toggleLabel(label)}>${label}</span>
          `)}
        </div>
      ` : nothing}
      <div class="script-list">
        ${this._filtered.length === 0
          ? html`<div class="empty">No scripts found</div>`
          : this._filtered.map(s => this._renderScript(s))}
      </div>
    `;
  }

  private _renderScript(script: ScriptDescriptor): TemplateResult {
    const status = this._readiness.get(script.name) ?? 'unknown';
    return html`
      <div class="script-item">
        <span class="readiness readiness-${status}">${status}</span>
        <div class="script-info">
          <div class="script-name">${script.name}</div>
          ${script.description ? html`<div class="script-desc">${script.description}</div>` : nothing}
          <div class="script-meta">
            ${script.labels.map(l => html`<span class="label-chip">${l}</span>`)}
            ${script.tags.map(t => html`<span class="label-chip">${t}</span>`)}
            <span class="provenance">${script.provenance.toLowerCase()}</span>
          </div>
        </div>
        <button class="run-btn" @click=${() => this._selectScript(script)}
                aria-label="Run ${script.name}">Run</button>
      </div>
    `;
  }

  private _toggleLabel(label: string): void {
    if (this.filterLabels.includes(label)) {
      this.filterLabels = this.filterLabels.filter(l => l !== label);
    } else {
      this.filterLabels = [...this.filterLabels, label];
    }
  }

  private _selectScript(script: ScriptDescriptor): void {
    this.dispatchEvent(new CustomEvent('script-selected', {
      detail: { name: script.name },
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get('pages-library-view')) {
  customElements.define('pages-library-view', PagesLibraryView);
}
