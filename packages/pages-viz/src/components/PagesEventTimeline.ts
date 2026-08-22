import { html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TypedDataSet } from "@casehubio/pages-data";
import type { EventTimelineProps } from "@casehubio/pages-component";
import { emitPagesEvent } from "@casehubio/pages-component";
import { PagesElement } from "../base/PagesElement.js";
import { cellToRaw } from "../base/cell-extract.js";
import type { EventTimelineNode, EventTimelineStrategy } from "./event-timeline-types.js";
import { renderVerticalTimeline, verticalTimelineStyles } from "./event-timeline/renderers/vertical.js";
import { renderHorizontalTimeline, horizontalTimelineStyles } from "./event-timeline/renderers/horizontal.js";
import { renderCompactTimeline, compactTimelineStyles } from "./event-timeline/renderers/compact.js";
import { renderFilterBar, filterBarStyles } from "./event-timeline/renderers/filter-bar.js";

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
  @state() private _internalFilters: Set<string> | null = null;

  private _lastData: unknown = undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Event timeline');
  }

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); color: var(--pages-neutral-12, #111); }
    .timeline-container { padding: 16px; }
    .empty-state { text-align: center; padding: 24px; color: var(--pages-neutral-9, #6b7280); }
    ${verticalTimelineStyles}
    ${horizontalTimelineStyles}
    ${compactTimelineStyles}
    ${filterBarStyles}
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
    return this._internalFilters;
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

    const layout = props.layout ?? strategy.defaultLayout ?? "vertical";
    const filtered = this._filteredNodes;

    return html`
      <div class="timeline-container">
        ${strategy.filterCategories && layout !== "compact"
          ? renderFilterBar(
              strategy.filterCategories,
              this._resolvedFilters ?? new Set(strategy.filterCategories),
              (cat) => this._handleFilterToggle(cat, strategy.filterCategories!),
            )
          : nothing}
        ${filtered.length === 0
          ? html`<div class="empty-state">No events</div>`
          : layout === "vertical"
          ? renderVerticalTimeline(filtered, {
              expandedKeys: this._expandedKeys,
              onNodeClick: (n, i) => this._handleNodeClick(n, i),
              onToggleExpand: (k) => this._handleToggleExpand(k),
              onKeyDown: (e, i) => this._handleVerticalKeyDown(e, i),
              renderNode: strategy.renderNode,
              renderDetail: strategy.renderDetail,
            })
          : layout === "horizontal"
          ? renderHorizontalTimeline(filtered, {
              onNodeClick: (n, i) => this._handleNodeClick(n, i),
              onKeyDown: (e, i) => this._handleHorizontalKeyDown(e, i),
              renderNode: strategy.renderNode,
            })
          : renderCompactTimeline(filtered, {
              onExpandRequested: () => emitPagesEvent(this, "event-timeline:expand-requested", {}),
              onKeyDown: () => {},
            })}
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

  private _handleFilterToggle(category: string, allCategories: string[]): void {
    const current = this._resolvedFilters ?? new Set(allCategories);
    const next = new Set(current);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    this._internalFilters = next;
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

  private _handleVerticalKeyDown(e: KeyboardEvent, index: number): void {
    const nodes = this.shadowRoot!.querySelectorAll(".timeline-node");
    if (e.key === "ArrowDown" && index < nodes.length - 1) {
      e.preventDefault();
      (nodes[index + 1] as HTMLElement).focus();
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      (nodes[index - 1] as HTMLElement).focus();
    }
  }

  private _handleHorizontalKeyDown(e: KeyboardEvent, index: number): void {
    const items = this.shadowRoot!.querySelectorAll('[role="listitem"]');
    if (e.key === "ArrowRight" && index < items.length - 1) {
      e.preventDefault();
      (items[index + 1] as HTMLElement).focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      (items[index - 1] as HTMLElement).focus();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pages-event-timeline": PagesEventTimeline;
  }
}
