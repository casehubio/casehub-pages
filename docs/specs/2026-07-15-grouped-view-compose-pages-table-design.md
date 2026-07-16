# PagesGroupedView Compose pages-table Design

**Issue:** #188 — pages-grouped-view must compose pages-table for content rendering
**Date:** 2026-07-15

## Problem

`PagesGroupedView` reimplements table rendering via innerHTML string concatenation
(`render-content-table.ts`, `renderSpreadsheet()`) instead of composing `<pages-table>`.
Grouped views get none of pages-table's features: no column renderers, no sorting,
no row detail, no row styling, no virtual scroll. Every consumer that needs tabular
data with grouping wraps `<pages-table>` directly and reimplements grouping.

## Design

### 1. Type Ownership — Move Shared Types to pages-component

Types that are pure data interfaces with no framework dependency move from
`packages/pages-table/src/types.ts` to `packages/pages-component/src/model/displayer-types.ts`
(where `RowStyleRule`, `TableProps`, `ExpandableConfig` already live):

| Type | Notes |
|------|-------|
| `TableColumnConfig` | Column label, width, sortable, visible, align, filterable |
| `ColumnAlign` | `"start" \| "center" \| "end"` |
| `SelectionMode` | `"none" \| "single" \| "multi"` |
| `ColumnRenderer` | Base signature: `(cell: CellValue, row: TypedRow, column: Column) => unknown` |

`RowStyleRule` already exists in pages-component — delete the duplicate from
pages-table's local scope.

pages-table re-exports these from pages-component and narrows `ColumnRenderer`
locally for Lit-specific return types:

```typescript
import type { ColumnRenderer as BaseColumnRenderer } from '@casehubio/pages-component';
export type ColumnRenderer = (...args: Parameters<BaseColumnRenderer>) => TemplateResult | string | DirectiveResult;
```

`TableColumnConfig` in pages-component omits the `compare` callback — it's a
runtime function, not serializable data. pages-table extends locally with the
same pattern:

```typescript
import type { TableColumnConfig as BaseTableColumnConfig } from '@casehubio/pages-component';
export type TableColumnConfig = BaseTableColumnConfig & {
  readonly compare?: (a: CellValue, b: CellValue) => number;
};
```

### 2. GroupedViewProps Extension

Add serializable passthrough properties to `GroupedViewProps` in
`packages/pages-component/src/model/grouped-view-types.ts`:

```typescript
export interface GroupedViewProps extends DataComponentCommon {
  readonly groupBy: GroupingKey;
  readonly preset?: GroupedViewPreset;
  readonly groupDisplay?: GroupDisplayMode;
  readonly contentDisplay?: ContentDisplayMode;
  readonly defaultExpanded?: boolean;
  readonly showGroupSummary?: boolean;
  readonly aggregations?: readonly AggregationBinding[];
  readonly order?: "asc" | "desc";
  readonly emptyGroups?: boolean;

  // pages-table passthrough (new)
  readonly columnConfig?: readonly TableColumnConfig[];
  readonly rowStyle?: readonly RowStyleRule[];
  readonly selection?: SelectionMode;
  readonly sortable?: boolean;
}
```

PagesGroupedView class gains programmatic-only properties (not YAML-expressible):

```typescript
columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
getRowKey?: (row: TypedRow) => string;
getRowDetail?: (row: TypedRow) => unknown;
getRowClass?: (row: TypedRow) => string;
```

These are stored on the class instance and forwarded to every per-group
`<pages-table>` element.

YAML desugar (`grouped-view-desugar.ts`) is extended to pass through
`columnConfig`, `rowStyle`, `selection`, `sortable`.

#### YAML examples for passthrough properties

```yaml
# Sortable grouped view with column configuration and row styling
- type: grouped-view
  groupBy: { column: status, strategy: distinct }
  preset: sectioned
  sortable: true
  columnConfig:
    - { id: name, width: "2fr", sortable: true }
    - { id: date, width: "1fr" }
    - { id: priority, width: "0.5fr", align: center }
  rowStyle:
    - condition: "row.cell('priority').value === 'P0'"
      className: critical-row

# Grouped view with selection
- type: grouped-view
  groupBy: { column: department, strategy: distinct }
  preset: spreadsheet
  selection: multi
```

The desugar is straightforward scalar passthrough — YAML object values map
directly to TypeScript properties without transformation. All passthrough types
(`columnConfig`, `rowStyle`, `selection`, `sortable`) are JSON-serializable.
The `compare` callback on `TableColumnConfig` is omitted from the base type
(see §1) and is only available via programmatic API.

### 3. Rendering Architecture — Lifecycle-Aware Composition

Three distinct operations replace the single innerHTML teardown:

#### 3a. Structure build (`render()` override)

Called by PagesElement when data arrives. Builds the full DOM programmatically.

```
container
  └─ div.pages-grouped-view
       ├─ div.group-section
       │    ├─ button.section-toggle  [data-group="Engineering"]
       │    └─ div.section-content    [id="xxx-group-0"]
       │         └─ <pages-table>     ← persistent, stored in Map
       ├─ div.group-section
       │    ├─ button.section-toggle  [data-group="Design"]
       │    └─ div.section-content    [id="xxx-group-1"]
       │         └─ <pages-table>     ← persistent, stored in Map
       └─ ...
```

State tracking:

```typescript
private _groupTables = new Map<string, HTMLElement>();
private _lastBoundaries: readonly GroupBoundary[] = [];
```

Reconciliation logic:

1. Compute new boundaries from new dataset
2. Compare with `_lastBoundaries` — same group names in same order?
   - **Same structure:** Update each table's `dataSet` to new subset. Update
     group header summaries if aggregations changed. No DOM rebuild.
   - **Same group names, different order:** Detach group sections from container,
     reattach in new order using existing DOM nodes and table references from
     `_groupTables`. Update each table's `dataSet` to the reordered subset.
     No table destruction — client-side sort state, selections, and expanded
     details survive.
   - **Group names changed (groups added or removed):** Clear container, rebuild
     all group sections and tables from scratch. Store new references.
3. Apply shared column widths to all tables (recomputed from the full dataset)

#### 3b. Expand/collapse toggle

No render call. Toggle handler:

1. Update `_expandState` map
2. Toggle `hidden` attribute on `.section-content` div
3. Update `aria-expanded` on toggle button
4. Dispatch `pages-event` with topic `group-toggle`

Event listeners are attached once during structure build. They survive because
DOM elements persist (no innerHTML teardown).

#### 3c. Property forwarding

When programmatic properties change on PagesGroupedView, iterate `_groupTables`
and set the property on each `<pages-table>`:

```typescript
set columnRenderers(value: ReadonlyMap<ColumnId, ColumnRenderer> | undefined) {
  this._columnRenderers = value;
  for (const table of this._groupTables.values()) {
    (table as PagesTableHost).columnRenderers = value;
  }
}
```

For serializable properties from `props` (columnConfig, rowStyle, selection,
etc.), these are read during render and forwarded at table creation/update time.

#### 3d. Spreadsheet vs. sectioned — shared header bar

Both modes use per-group `<pages-table>` with `embedded = true` (toolbar and
pagination suppressed) and `headerVisible = false` (header row visually hidden
but screen-reader accessible). PagesGroupedView renders a **shared column
header bar** once at the top of the component, outside any group.

The shared header bar provides:
- Column grid aligned to the per-group tables — includes spacer columns matching
  PagesTable's prefix columns (40px for row-detail expand toggle when `getRowDetail`
  is set, 40px for multi-select checkbox when `selection === 'multi'`). Empty
  `<div>` elements fill the spacer positions. The grid template is computed as:
  ```typescript
  const prefix = [
    this._getRowDetail ? '40px' : '',
    props.selection === 'multi' ? '40px' : '',
  ].filter(Boolean);
  const headerGridCols = [...prefix, ...frWidths].join(' ');
  ```
- Column cells render conditionally based on sortability:
  - **Sortable columns** (`props.sortable !== false` AND `columnConfig[col].sortable
    !== false`): `<button class="col-header" data-column="${columnId}">` with click
    handler `_handleHeaderSort()` (see §3f)
  - **Non-sortable columns**: `<span class="col-label">` — static text, no click
    handler, no sort indicator
  - When global `sortable` is `false`, ALL columns render as static labels
- Sort indicators (`aria-sort` attribute + visual arrow) reflecting `activeSort`
  state, updated via `_updateHeaderBarSort()` (see §3f) — only on sortable buttons
- `position: sticky` so column context remains visible when scrolling

The modes differ only in group header presentation:
- **Sectioned:** Prominent section headings — large text, chevron, section summary
- **Spreadsheet:** Compact inline headers — minimal padding, dense appearance

The `groupDisplay` prop adds a CSS class (`sectioned` vs `spreadsheet`) to the
outer wrapper. Content rendering (per-group `<pages-table>` with data subsets)
is identical across modes.

**Keyboard navigation:** Within each per-group table, arrow keys navigate rows
via `RovingTabindexMixin`. Tab moves focus between tables (standard browser
tab order). Cross-table arrow-key navigation (last row of group A → first row
of group B) is deferred to the `groupBy` native property follow-up (#189).

**Virtual scroll in embedded tables:** PagesTable's `mode: 'auto'` (the default)
triggers virtual scroll when a group has more than 50 rows (`AUTO_THRESHOLD`).
The table renders a fixed-height scrollable area within the group section.
PagesGroupedView sets `max-height: 480px` (10 × default `rowHeight` of 48px)
on each per-group table's host element to bound the scroll area. If the consumer
sets a custom `rowHeight`, PagesGroupedView recalculates: `10 × rowHeight`. When
`getRowDetail` is set, virtual scroll is disabled regardless of row count — all
rows render, and large groups expand the section naturally. Consumers can override
this by setting `mode: 'scroll'` (always virtual) or `mode: 'auto'` with a custom
threshold via programmatic API.

#### 3e. List mode — unchanged

`render-content-list.ts` is edited to return DOM elements instead of HTML strings,
consistent with the programmatic DOM build. List mode doesn't compose
`<pages-table>` — it's a genuinely different rendering model (`<dl>` elements).

#### 3f. Event coordination across per-group tables

Per-group `<pages-table>` elements emit events independently. PagesGroupedView
coordinates:

**Sort:**
The shared header bar's sort buttons dispatch `pages-sort` from PagesGroupedView
itself — both modes use the same code path. Per-group tables have
`headerVisible = false`, so no sort interaction originates from child tables.
The pipeline re-sorts the full dataset and re-delivers to PagesGroupedView.

Sort click handler (`_handleHeaderSort`):

```typescript
private _handleHeaderSort(columnId: ColumnId): void {
  const current = this.activeSort;
  let order: 'ASCENDING' | 'DESCENDING';
  if (current?.columnId === columnId) {
    order = current.order === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING';
  } else {
    order = 'ASCENDING';
  }
  this.dispatchEvent(new CustomEvent('pages-sort', {
    detail: { columnId, order },
    bubbles: true,
    composed: true,
  }));
}
```

The handler reads from `this.activeSort` (the authoritative sort state on
`DataSourceController`) rather than maintaining a private `_sortState` field.
This avoids desynchronization when sort state is set externally — URL-restored
sort (`?sort=name:asc`), programmatic `activeSort` assignment, or pipeline
state delivery (data-pipeline.ts line 327: `target.activeSort = compState.sort`).
All of these set `activeSort` without going through `_handleHeaderSort`, so a
private field would go stale and produce a dead first click.

Design choices:
- **2-state toggle** (asc ↔ desc) rather than PagesTable's 3-state (none → asc →
  desc → none). In pipeline mode, PagesTable's 'none' state does not dispatch
  `pages-sort` (pages-table.ts line 1461: `if (this._pipelineMode && newDirection
  !== 'none')`), making it a dead click with no visual feedback — the sort
  indicators stay at the last direction because `activeSort` is never updated.
  The 2-state toggle eliminates this UX gap.
- **No multi-column sort** (shift+click). PagesTable supports `_sortStack` for
  multi-column sort, but the pipeline's `pages-sort` event carries a single
  `{ columnId, order }`. Multi-column sort from the shared header bar is deferred
  to #189 (groupBy native property).
- **Single click, different column** → resets to ascending for the new column.
- **Only dispatched for sortable columns.** `_handleHeaderSort` is only attached
  as a click handler on columns that pass the sortability check (see §3d). The
  check mirrors PagesTable's `_handleHeaderClick` guard (pages-table.ts line 1429:
  `if (!config?.sortable) return`).

**Selection:**
Per-group by default — each table manages its own `_internalSelectedKeys`.
Cross-group unified selection is deferred (#193). PagesGroupedView does NOT
intercept selection events; each table's `pages-event` with topic
`selection-change` bubbles to consuming applications scoped to that group's data.

**Pagination:**
Suppressed via `embedded = true`. Per-group pagination is semantically wrong for
grouped data.

**Filter:**
Cell-click filter events (`pages-filter`) bubble from per-group tables with
`composed: true`. The runtime captures them and re-runs the pipeline. No
PagesGroupedView interception needed — the filter applies to the full dataset,
which re-groups and re-delivers.

**Row detail expansion:**
Per-group — each table manages its own `_internalExpandedDetailKeys` independently.
This is correct behaviour: expanding a row detail in group A has no semantic
relationship to group B.

**activeSort forwarding and shared header bar update:**
PagesGroupedView overrides the `activeSort` setter to (1) forward sort state to
all per-group tables (for screen-reader accessibility of hidden headers) and
(2) update the shared header bar's sort indicators:

```typescript
override set activeSort(value: SortColumn | undefined) {
  super.activeSort = value;
  for (const table of this._groupTables.values()) {
    (table as PagesTableHost).activeSort = value;
  }
  this._updateHeaderBarSort(value);
}

private _updateHeaderBarSort(sort: SortColumn | undefined): void {
  const buttons = this.shadowRoot.querySelectorAll('.col-header');
  for (const btn of buttons) {
    btn.removeAttribute('aria-sort');
    btn.classList.remove('sort-asc', 'sort-desc');
  }
  if (!sort) return;
  const active = this.shadowRoot.querySelector(
    `.col-header[data-column="${sort.columnId}"]`
  );
  if (!active) return;
  const dir = sort.order === 'ASCENDING' ? 'ascending' : 'descending';
  active.setAttribute('aria-sort', dir);
  active.classList.add(sort.order === 'ASCENDING' ? 'sort-asc' : 'sort-desc');
}
```

### 4. Column Alignment Guarantee

**Invariant:** Every per-group `<pages-table>` receives identical
`columnConfig[].width` values. No table ever auto-sizes its own columns.
The shared header bar's grid template includes the same prefix columns
(row-detail toggle, multi-select checkbox) as the per-group tables, ensuring
the content columns align between header bar and table rows.

#### Width computation

`computeColumnWidths()` runs once per render against the full dataset (all rows,
all groups). Pixel widths are converted to proportional `fr` units:

```typescript
const rawWidths = computeColumnWidths(dataset, contentColumns, font);
const minWidth = Math.min(...rawWidths);
const frWidths = rawWidths.map(w => `${(w / minWidth).toFixed(2)}fr`);
```

`fr` units over absolute pixels because:
- CSS Grid distributes `fr` proportionally to available space — correct on resize
- Absolute pixels overflow or leave gaps when the container resizes
- All tables with identical `fr` ratios produce identical column geometry

#### Config assembly

Consumer-provided `columnConfig[].width` values take priority. Computed
proportional widths fill in where absent:

```typescript
const columnConfig = contentColumns.map((id, i) => {
  const userConfig = props.columnConfig?.find(c => c.id === id);
  return {
    id,
    width: userConfig?.width ?? frWidths[i],
    ...userConfig,
  };
});
```

Every table gets the same config array — alignment guaranteed.

### 5. Web Component Composition — No Package Dependency

PagesGroupedView creates `<pages-table>` elements via `document.createElement`
with no runtime or devDependency on pages-table. A local interface provides
type-safe property assignment:

```typescript
interface PagesTableHost extends HTMLElement {
  dataSet?: TypedDataSet;
  columnConfig?: readonly TableColumnConfig[];
  columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  rowStyle?: readonly RowStyleRule[];
  selection?: SelectionMode;
  getRowKey?: (row: TypedRow) => string;
  getRowDetail?: (row: TypedRow) => unknown;
  getRowClass?: (row: TypedRow) => string;
  mode?: string;
  pageSize?: number;
  loading?: boolean;
  error?: string;
  sortable?: boolean;
  clientSort?: boolean;
  embedded?: boolean;
  headerVisible?: boolean;
  activeSort?: SortColumn;
}
```

All types in `PagesTableHost` come from pages-data or pages-component — no
pages-table import needed. The consuming app ensures both custom elements are
registered.

`embedded` and `headerVisible` are new `@property()` additions to PagesTable
(see File Changes). `sortable` and `rowStyle` are promoted from the props bag
to direct `@property()` — backed by the same internal fields (`_sortableFromProps`,
`_rowStyleRules`), so the props bag path continues to work for pipeline mode.

### 6. CSS Changes

**Remove** from `GROUPED_VIEW_CSS`:
- `.pages-grouped-view table`, `th`, `td` — cell styling (delegated to pages-table)
- `tr:nth-child(even) td` — zebra stripes
- `.group-header td` — spreadsheet group header row
- `.column-header-table` — old table-based shared header (replaced by `.column-header-bar` grid)

**Keep:**
- `:host` — display block, font defaults
- `.section-toggle`, `.section-chevron`, `.section-summary` — section headers
- `.section-content` — overflow, transition
- `.column-header-bar`, `.col-header`, `.col-label` — shared header bar (sectioned + spreadsheet modes)
- `.aligned-list`, `.list-item` — list mode
- `.visually-hidden` — accessibility
- `@media (prefers-reduced-motion)` — motion preference

**Add:**
- `.group-toggle` styles for spreadsheet compact headers
- `.spreadsheet` overrides — zero margin between header and table, dense spacing
- `.spreadsheet pages-table` — host-level overrides if needed

## File Changes

| File | Action |
|------|--------|
| `packages/pages-component/src/model/displayer-types.ts` | Edit — add TableColumnConfig, ColumnAlign, SelectionMode, base ColumnRenderer |
| `packages/pages-component/src/model/grouped-view-types.ts` | Edit — add passthrough properties to GroupedViewProps |
| `packages/pages-table/src/types.ts` | Edit — remove moved types, import from pages-component, narrow ColumnRenderer |
| `packages/pages-table/src/pages-table.ts` | Edit — delete local RowStyleRule (import from pages-component); promote `sortable`, `rowStyle` from props bag to `@property`; add `embedded`, `headerVisible` properties |
| `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` | Rewrite — lifecycle-aware rendering, per-group pages-table composition |
| `packages/pages-viz/src/components/grouped-view/render-content-table.ts` | Delete |
| `packages/pages-viz/src/components/grouped-view/render-content-list.ts` | Edit — returns DOM elements instead of HTML strings |
| `packages/pages-viz/src/components/grouped-view/render-group-section.ts` | Edit — returns DOM element (createElement) instead of HTML string, so event listeners can be attached directly without querySelectorAll |
| `packages/pages-viz/src/components/grouped-view/render-group-table-row.ts` | Edit — returns DOM element for compact group header between per-group tables (no longer a `<tr>` inside a shared `<table>`) |
| `packages/pages-viz/src/components/grouped-view/group-view-styles.ts` | Edit — remove table styles, add spreadsheet bridge styles |
| `packages/pages-viz/src/components/grouped-view/column-widths.ts` | Keep |
| `packages/pages-viz/src/components/grouped-view/group-extraction.ts` | Keep |
| `packages/pages-viz/src/components/grouped-view/presets.ts` | Keep |
| `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts` | Rewrite |
| `packages/pages-ui/src/parser/grouped-view-desugar.ts` | Edit — pass through new properties |
| `packages/pages-ui/src/parser/grouped-view-desugar.test.ts` | Edit — tests for new passthrough |
| `examples/samples/Tables/Grouped View.dash.yaml` | Edit — add column renderer demo tab |

## Testing

### Ported tests (from existing PagesGroupedView.test.ts)

| Existing test | Fate |
|--------------|------|
| renders in sectioned mode by default | Adapted — query for `pages-table` instead of `<table>` |
| renders spreadsheet mode with single table | Adapted — assert per-group `pages-table` elements |
| renders list mode with dl elements | Unchanged |
| toggles expand/collapse on group click | Adapted — adjusted selectors |
| has unique aria-controls IDs | Adapted — adjusted selectors |
| emits pages-event on group toggle | Unchanged |
| shows column header table in sectioned mode | Replaced — shared column header bar renders once; per-group tables have `headerVisible = false` |
| shows col-label spans in list mode | Unchanged |
| hides content when defaultExpanded is false | Adapted — adjusted selectors |
| sectioned mode renders column headers inside a table | Replaced — identical columnConfig widths test |

### New tests

| Test | What it verifies |
|------|-----------------|
| Each table receives correct data subset | `table.dataSet.rows.length === boundary.rowCount` |
| All tables receive identical columnConfig widths | Every table's columnConfig has same width values |
| Expand/collapse preserves table DOM references | Same element reference survives toggle |
| Expand/collapse preserves table state | Property set before toggle persists after |
| Data refresh reuses tables (same groups) | Table DOM references reused, not recreated |
| Data refresh rebuilds tables (groups changed) | New tables created for new group structure |
| columnRenderers passthrough | Set on grouped view, verify on each table |
| rowStyle passthrough from props | Set in props, verify on each table |
| columnConfig merge with computed widths | Consumer width overrides computed; others get fr |
| Empty group creates table with empty dataset | No crash |
| DOM reorder preserves table state (reconciliation case 2) | Reorder groups → same table references, state survives detach/reattach |
| `embedded` property suppresses toolbar and pagination | Per-group table has no column picker, filter input, CSV export, or pagination footer |
| `headerVisible = false` hides column headers | Per-group table's `<thead>` has `visually-hidden` class |
| Shared header bar renders once at top | Single `.column-header-bar` element outside any `.group-section` |
| Sort buttons on shared bar dispatch `pages-sort` | Click sort button → `pages-sort` event dispatched from PagesGroupedView |
| Sort indicators update when `activeSort` changes | Set `activeSort` → active column button has `aria-sort` and directional CSS class |
| `pages-filter` bubbles from per-group table to runtime | Click cell filter → `pages-filter` event reaches document |
| Virtual scroll activates for groups >50 rows | Group with 60 rows renders scrollable area with `max-height` constraint |
| Shared header bar includes spacer columns for selection | `selection: 'multi'` → header bar grid has 40px prefix, columns align with table |
| Shared header bar includes spacer columns for row-detail | `getRowDetail` set → header bar grid has 40px prefix, columns align with table |
| Sort click toggles direction asc ↔ desc | Click column → asc, click again → desc, click again → asc |
| Sort click on different column resets to ascending | Sort by A (desc), click B → B is asc |
| Sort click after URL-restored sort toggles correctly | Pipeline sets `activeSort` externally → user click toggles direction, no dead click |
| Sort buttons not rendered when `sortable: false` | Global `sortable: false` → all column cells are `<span>` not `<button>` |
| Sort buttons respect per-column sortable config | `columnConfig[col].sortable: false` → that column renders as static label |

### Desugar tests

- `columnConfig`, `rowStyle`, `selection`, `sortable` round-trip through desugar

## Scope

**In scope:**
- Type migration to pages-component
- GroupedViewProps extension
- PagesGroupedView rewrite with lifecycle-aware rendering
- render-content-table.ts deletion
- Spreadsheet mode conversion to per-group tables
- Column alignment guarantee via shared fr widths
- CSS cleanup
- Desugar extension
- Test rewrite and additions
- Example dashboard update

**Out of scope:**
- Adding `groupBy` as a native pages-table property (#189 — would unify
  spreadsheet preset into pages-table itself, enabling continuous keyboard nav
  and single-table screen reader semantics)
- Column renderers for list mode (#190 — list mode stays innerHTML-based)
- Synchronized column visibility across groups (#191 — each table manages its own)
- Changing PagesElement base class to Lit (#192)
- Cross-group unified selection (#193 — selection is per-group in this design)
