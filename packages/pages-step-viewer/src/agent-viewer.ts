import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AgentDescriptor } from './agent-types.js';
import type { PatternSpec } from './pattern-types.js';
import './eidos-view.js';
import './voting-view.js';
import './debate-view.js';

export type AgentTab = 'eidos' | 'pattern' | 'steps';

export interface AgentViewerData {
  agent: AgentDescriptor;
  pattern?: PatternSpec;
  breadcrumb?: string[];
}

@customElement('agent-viewer')
export class AgentViewer extends LitElement {
  @property({ attribute: false }) data!: AgentViewerData;
  @state() private activeTab: AgentTab = 'eidos';

  static override styles = css`
    :host {
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #cdd6f4;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0;
      font-size: 12px;
      color: #7f849c;
      margin-bottom: 8px;
    }
    .breadcrumb-segment {
      color: #7f849c;
      cursor: pointer;
      transition: color 0.15s;
    }
    .breadcrumb-segment:hover {
      color: #89b4fa;
    }
    .breadcrumb-current {
      color: #cdd6f4;
      font-weight: 500;
    }
    .breadcrumb-sep {
      color: #585b70;
      font-size: 10px;
    }

    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 16px;
    }
    .tab {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      color: #7f849c;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
      user-select: none;
    }
    .tab:hover {
      color: #bac2de;
    }
    .tab.active {
      color: #89b4fa;
      border-bottom-color: #89b4fa;
    }
    .tab.disabled {
      color: #45475a;
      cursor: not-allowed;
    }

    .tab-content {
      min-height: 100px;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 120px;
      color: #585b70;
      font-size: 12px;
      font-style: italic;
    }
  `;

  override render() {
    if (!this.data) return nothing;
    return html`
      ${this.renderBreadcrumb()}
      ${this.renderTabBar()}
      <div class="tab-content">
        ${this.renderActiveTab()}
      </div>
    `;
  }

  private renderBreadcrumb(): TemplateResult | typeof nothing {
    const bc = this.data.breadcrumb;
    if (!bc?.length) return nothing;
    const segments = bc.slice(0, -1);
    const current = bc[bc.length - 1];
    return html`
      <div class="breadcrumb">
        ${segments.map(s => html`
          <span class="breadcrumb-segment">${s}</span>
          <span class="breadcrumb-sep">›</span>
        `)}
        <span class="breadcrumb-current">${current}</span>
      </div>
    `;
  }

  private renderTabBar(): TemplateResult {
    const hasPattern = !!this.data.pattern;
    return html`
      <div class="tab-bar">
        <div class="tab ${this.activeTab === 'eidos' ? 'active' : ''}"
             @click=${() => this.selectTab('eidos')}>Eidos</div>
        <div class="tab ${this.activeTab === 'pattern' ? 'active' : ''} ${hasPattern ? '' : 'disabled'}"
             @click=${() => hasPattern && this.selectTab('pattern')}>Pattern</div>
        <div class="tab ${this.activeTab === 'steps' ? 'active' : ''} disabled"
             @click=${() => {}}>Steps</div>
      </div>
    `;
  }

  private selectTab(tab: AgentTab): void {
    this.activeTab = tab;
  }

  private renderActiveTab(): TemplateResult {
    switch (this.activeTab) {
      case 'eidos':
        return html`<eidos-view .agent=${this.data.agent}></eidos-view>`;
      case 'pattern':
        return this.renderPattern();
      case 'steps':
        return html`<div class="empty-state">Steps view — requires runtime step data</div>`;
    }
  }

  private renderPattern(): TemplateResult {
    const p = this.data.pattern;
    if (!p) return html`<div class="empty-state">No pattern data available</div>`;
    switch (p.type) {
      case 'voting':
        return html`<voting-view .pattern=${p}></voting-view>`;
      case 'debate':
        return html`<debate-view .pattern=${p}></debate-view>`;
      default:
        return html`<div class="empty-state">Pattern type "${p.type}" not yet supported</div>`;
    }
  }
}
