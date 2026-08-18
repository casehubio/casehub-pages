import { html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TypedDataSet } from "@casehubio/pages-data";
import type { EventTimelineProps, EventTimelineLayout } from "@casehubio/pages-component";
import { emitPagesEvent } from "@casehubio/pages-component";
import { PagesElement } from "../base/PagesElement.js";
import { cellToRaw } from "../base/cell-extract.js";
import type { EventTimelineNode, EventTimelineStrategy } from "./event-timeline-types.js";

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

const chronologicalStrategy: EventTimelineStrategy<EventTimelineNode[]> = {
  toNodes: (data) => [...data].sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  }),
  defaultLayout: "vertical",
};

@customElement("pages-event-timeline")
export class PagesEventTimeline extends PagesElement<EventTimelineProps> {
  private static _strategyRegistry = new Map<string, EventTimelineStrategy>([
    ["chronological", chronologicalStrategy],
  ]);

  static registerStrategy(key: string, strategy: EventTimelineStrategy): void {
    PagesEventTimeline._strategyRegistry.set(key, strategy);
  }

  @property({ attribute: false }) strategy?: EventTimelineStrategy;
  @property({ attribute: false }) data?: unknown;
  @property({ attribute: false }) activeFilters?: Set<string> | string[];

  @state() private _nodes: EventTimelineNode[] = [];
  @state() private _expandedKeys = new Set<string>();

  private _lastData: unknown = undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Event timeline');
  }

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); color: var(--pages-neutral-12, #111); }
    .timeline-container { padding: 16px; }
    .filter-bar { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-chip {
      padding: 6px 12px; border-radius: 16px;
      border: 1px solid var(--pages-neutral-6, #d1d5db);
      background: var(--pages-neutral-1, #fff);
      cursor: pointer; font-size: 13px; font-weight: 500;
      transition: all 0.2s;
    }
    .filter-chip[aria-checked="true"] {
      background: var(--pages-accent-9, #2563eb);
      color: white; border-color: var(--pages-accent-9, #2563eb);
    }
    .filter-chip:hover { border-color: var(--pages-accent-7, #3b82f6); }
    .timeline { position: relative; padding-left: 40px; }
    .timeline::before {
      content: ''; position: absolute; left: 11px; top: 0; bottom: 0;
      width: 2px; background: var(--pages-neutral-5, #e5e7eb);
    }
    .timeline-node { position: relative; margin-bottom: 24px; outline: none; }
    .timeline-node:focus { outline: 2px solid var(--pages-accent-8, #1d4ed8); outline-offset: 4px; border-radius: 8px; }
    .node-dot {
      position: absolute; left: -34px; top: 12px;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--pages-neutral-7, #9ca3af);
      border: 2px solid var(--pages-neutral-1, #fff); z-index: 1;
    }
    .status-completed .node-dot { background: var(--pages-success-9, #16a34a); }
    .status-active .node-dot { background: var(--pages-accent-9, #2563eb); }
    .status-pending .node-dot { background: var(--pages-neutral-7, #9ca3af); }
    .status-failed .node-dot { background: var(--pages-danger-9, #dc2626); }
    .status-skipped .node-dot { background: var(--pages-neutral-5, #d1d5db); }
    .node-content {
      background: var(--pages-neutral-1, #fff);
      border: 1px solid var(--pages-neutral-5, #e5e7eb);
      border-radius: 8px; padding: 12px;
    }
    .node-body { cursor: pointer; }
    .node-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px; flex-wrap: wrap; gap: 8px;
    }
    .node-label { font-size: 14px; font-weight: 500; color: var(--pages-neutral-12, #111); }
    .timestamp { font-size: 13px; color: var(--pages-neutral-9, #6b7280); }
    .actor-info { font-size: 13px; color: var(--pages-neutral-9, #6b7280); margin-top: 4px; }
    .expand-button {
      display: inline-block; margin-top: 8px; padding: 4px 8px;
      font-size: 12px; cursor: pointer; background: none;
      border: 1px solid var(--pages-neutral-5, #e5e7eb);
      border-radius: 4px; color: var(--pages-neutral-11, #374151);
    }
    .expand-button:hover { background: var(--pages-neutral-2, #f9fafb); }
    .expanded .expand-button { background: var(--pages-neutral-3, #f3f4f6); }
    .detail-content {
      margin-top: 12px; padding: 12px;
      background: var(--pages-neutral-2, #f9fafb);
      border-radius: 4px; font-size: 13px;
    }
    .empty-state { text-align: center; padding: 24px; color: var(--pages-neutral-9, #6b7280); }
  `;

  private _resolveStrategy(): EventTimelineStrategy | undefined {
    if (this.strategy) return this.strategy;
    const key = this.props?.strategyKey ?? "chronological";
    return PagesEventTimeline._strategyRegistry.get(key);
  }

  private get _resolvedFilters(): Set<string> | null {
    if (this.activeFilters != null) {
      return this.activeFilters instanceof Set ? this.activeFilters : new Set(this.activeFilters);
    }
    return null;
  }

  private get _filteredNodes(): EventTimelineNode[] {
    const filters = this._resolvedFilters;
    const strategy = this._resolveStrategy();
    if (!filters || !strategy?.filterCategories) return this._nodes;
    return this._nodes.filter(n => n.category == null || filters.has(n.category));
  }

  protected override renderContent(
    props: EventTimelineProps,
    dataset: TypedDataSet,
  ): TemplateResult {
    const strategy = this._resolveStrategy();
    if (!strategy) {
      return html`<div class="empty-state">No strategy configured</div>`;
    }

    if (this.data !== this._lastData || dataset !== this._lastData) {
      this._lastData = this.data ?? dataset;
      const raw = this.data ?? this._dataSetToNodes(dataset);
      const transformed = strategy.transformData ? strategy.transformData(raw) : raw;
      this._nodes = strategy.toNodes(transformed);
    }

    const filtered = this._filteredNodes;
    return html`
      <div class="timeline-container">
        ${this._renderFilterBar(strategy)}
        ${filtered.length === 0
          ? html`<div class="empty-state">No events</div>`
          : this._renderVertical(filtered, strategy)}
      </div>
    `;
  }

  private _dataSetToNodes(dataset: TypedDataSet): EventTimelineNode[] {
    if (dataset.columns.length === 0 || dataset.rows.length === 0) return [];
    const cols = dataset.columns;
    const keyCol = cols.find(c => c.id === "key") ?? cols[0];
    const labelCol = cols.find(c => c.id === "label") ?? cols[1];
    const statusCol = cols.find(c => c.id === "status");
    const timestampCol = cols.find(c => c.id === "timestamp");
    const actorCol = cols.find(c => c.id === "actor");
    const categoryCol = cols.find(c => c.id === "category");

    return dataset.rows.map(row => {
      const key = String(keyCol ? cellToRaw(row.cell(keyCol.id)) : "");
      const label = String(labelCol ? cellToRaw(row.cell(labelCol.id)) : "");
      const status = (statusCol ? String(cellToRaw(row.cell(statusCol.id))) : "pending") as EventTimelineNode["status"];
      const ts = timestampCol ? String(cellToRaw(row.cell(timestampCol.id)) ?? "") : "";
      const actor = actorCol ? String(cellToRaw(row.cell(actorCol.id)) ?? "") : "";
      const cat = categoryCol ? String(cellToRaw(row.cell(categoryCol.id)) ?? "") : "";
      return {
        key,
        label,
        status,
        ...(ts ? { timestamp: ts } : {}),
        ...(actor ? { actor } : {}),
        ...(cat ? { category: cat } : {}),
      } as EventTimelineNode;
    });
  }

  private _renderFilterBar(strategy: EventTimelineStrategy): TemplateResult | typeof nothing {
    const categories = strategy.filterCategories;
    if (!categories) return nothing;
    const active = this._resolvedFilters ?? new Set(categories);
    return html`
      <div class="filter-bar" role="group" aria-label="Filter">
        ${categories.map(cat => html`
          <button
            class="filter-chip"
            role="checkbox"
            aria-checked="${active.has(cat)}"
            @click=${() => this._handleFilterToggle(cat, categories)}
          >${cat}</button>
        `)}
      </div>
    `;
  }

  private _handleFilterToggle(category: string, allCategories: string[]): void {
    const current = this._resolvedFilters ?? new Set(allCategories);
    const next = new Set(current);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    this.activeFilters = next;
  }

  private _handleToggleExpand(key: string): void {
    const next = new Set(this._expandedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._expandedKeys = next;
  }

  private _handleNodeClick(node: EventTimelineNode, index: number): void {
    this._handleToggleExpand(node.key);
    emitPagesEvent(this, "event-timeline:node-selected", { node, index });
  }

  private _handleKeyDown(e: KeyboardEvent, index: number): void {
    const nodes = this.shadowRoot!.querySelectorAll(".timeline-node");
    if (e.key === "ArrowDown" && index < nodes.length - 1) {
      e.preventDefault();
      (nodes[index + 1] as HTMLElement).focus();
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      (nodes[index - 1] as HTMLElement).focus();
    }
  }

  private _renderVertical(nodes: EventTimelineNode[], strategy: EventTimelineStrategy): TemplateResult {
    return html`
      <div class="timeline" role="list" aria-label="Timeline">
        ${nodes.map((node, index) => {
          const isExpanded = this._expandedKeys.has(node.key);
          const renderNode = strategy.renderNode;
          const renderDetail = strategy.renderDetail;

          return html`
            <div
              class="timeline-node status-${node.status} ${isExpanded ? "expanded" : ""}"
              role="listitem"
              tabindex="0"
              aria-label="${node.label}"
              @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, index)}
            >
              <div class="node-dot"></div>
              <div class="node-content">
                <div class="node-body" @click=${() => this._handleNodeClick(node, index)}>
                  <div class="node-header">
                    ${renderNode ? html`${renderNode(node)}` : html`<span class="node-label">${node.label}</span>`}
                    ${node.timestamp ? html`<span class="timestamp">${formatTimestamp(node.timestamp)}</span>` : nothing}
                  </div>
                  ${node.actor ? html`<div class="actor-info">${node.actor}</div>` : nothing}
                </div>
                ${node.detail != null ? html`
                  <button
                    class="expand-button"
                    aria-expanded="${isExpanded}"
                    @click=${(e: Event) => { e.stopPropagation(); this._handleToggleExpand(node.key); }}
                  >
                    ${isExpanded ? "▼" : "▶"} Details
                  </button>
                  ${isExpanded ? html`
                    <div class="detail-content" role="region">
                      ${renderDetail ? renderDetail(node) : html`<pre>${JSON.stringify(node.detail, null, 2)}</pre>`}
                    </div>
                  ` : nothing}
                ` : nothing}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pages-event-timeline": PagesEventTimeline;
  }
}
