import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { AriaTarget } from '@casehubio/pages-primitives';
import { probeReadiness, type ReadinessStatus } from './readiness-probe.js';

interface ScriptDescriptor {
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
    :host { display: block; }
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
    }
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
      border-bottom: 1px solid var(--pages-neutral-3, #f5f5f5);
      display: flex; align-items: flex-start; gap: var(--pages-space-2, 8px);
    }
    .script-item:hover { background: var(--pages-neutral-2, #fafafa); }
    .readiness {
      font-size: 10px; font-weight: 600;
      padding: 2px 6px; border-radius: var(--pages-radius-sm, 4px);
      flex-shrink: 0; min-width: 52px; text-align: center;
    }
    .readiness-ready { background: #dcfce7; color: #166534; }
    .readiness-not-ready { background: #fee2e2; color: #991b1b; }
    .readiness-unknown { background: #fef3c7; color: #92400e; }
    .script-info { flex: 1; min-width: 0; }
    .script-name { font-weight: 500; font-size: var(--pages-font-size-base, 14px); }
    .script-desc {
      font-size: var(--pages-font-size-sm, 12px);
      color: var(--pages-neutral-8, #999);
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

  async loadLibrary(): Promise<void> {
    try {
      const resp = await fetch(`${this.baseUrl}/scenario/library`);
      if (!resp.ok) return;
      this._scripts = await resp.json() as ScriptDescriptor[];
      this._allLabels = [...new Set(this._scripts.flatMap(s => s.labels))];
      this._probeAll();
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
