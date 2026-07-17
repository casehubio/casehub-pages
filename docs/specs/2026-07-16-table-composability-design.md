# Table Composability Enhancements — Design Spec

**Issue:** #196
**Date:** 2026-07-16
**Branch:** issue-196-table-composability

## Overview

Eight enhancements to the table and grouped-view composability stack, organized as four foundational fixes and four additive features. All validated against a real-world cross-repo roadmap dashboard example.

## Foundational Fixes

### 1. Desugar passthrough ordering (systemic)

**Problem:** `desugarDisplayer` runs table defaults (`pageSize=10`, `filter.enabled=true`) before the passthrough loop that copies user values from `raw` to `props`. The passthrough checks `!(key in props)` and silently drops the user's explicit value.

**Fix:** Reorder the flow in `desugarDisplayer`:

```
extract known sections (general, chart, table, meter, etc.)
→ passthrough: copy remaining raw keys to props (skips keys already in props)
→ set table defaults: only fill gaps (props.X ??= default)
```

**Files:** `packages/pages-ui/src/parser/displayer-desugar.ts`

**Behavioral change:** User-specified `pageSize`, `filter`, and any future table defaults now win over built-in defaults. Zero change for consumers who don't set the property.

### 2. Column display hints on `ColumnSettings`

**Problem:** `_rebuildConfigFromProps()` hardcodes `width: '1fr'` for every column. YAML consumers cannot control column widths, alignment, or per-column sortable state without a separate `columnConfig` — which isn't read in pipeline mode.

**Fix:** Extend `ColumnSettings` in `packages/pages-data/src/dataset/types.ts` with display hint fields, preserving all existing fields and the branded `ColumnId` type:

```typescript
export interface ColumnSettings {
  readonly id: ColumnId;
  readonly name?: string;
  readonly expression?: string;
  readonly pattern?: string;
  readonly empty?: string;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
  readonly sortable?: boolean;
  readonly minWidth?: string;
}
```

In `_rebuildConfigFromProps()`, merge hints from `_propsColumns` into each generated config entry:

```typescript
const override = this._propsColumns?.find(c => c.id === col.id);
return {
  id: col.id,
  label: override?.name ?? col.name,
  sortable: override?.sortable ?? this._sortableFromProps,
  width: override?.width ?? '1fr',
  ...(override?.align && { align: override.align }),
  ...(override?.minWidth && { minWidth: override.minWidth }),
};
```

**Files:**
- `packages/pages-data/src/dataset/types.ts` — extend `ColumnSettings`
- `packages/pages-table/src/pages-table.ts` — `_rebuildConfigFromProps()`

**YAML usage:**
```yaml
columns:
  - id: title
    name: Title
    width: "3fr"
  - id: status
    name: Status
    width: "120px"
    align: center
```

The separate `columnConfig` Lit property continues working for programmatic callers.

### 3. Container styling for data components

**Problem:** Content components (html, markdown, title) can receive CSS via YAML `properties` → `style`. Data components (table, grouped-view) cannot — their `properties` goes entirely to `props`. This prevents rounded borders, padding, margins on data component containers.

**Fix:** In `component-desugar.ts`, extract an explicit `style` key from the raw YAML object for data components:

```typescript
if (DATA_COMPONENT_TYPES.has(normalized)) {
  const rawProps = (raw.properties as Record<string, unknown> | undefined) ?? {};
  const style = extractStyle(raw.style);
  const displayerInput = { type: rawType, ...rawProps };
  const component = desugarDisplayer(displayerInput);
  return {
    ...component,
    ...(style ? { style } : {}),
    ...(rawId ? { id: rawId } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
  };
}
```

**Files:** `packages/pages-ui/src/parser/component-desugar.ts`

**YAML usage:**
```yaml
- type: table
  style:
    border: "1px solid var(--pages-neutral-6)"
    borderRadius: "var(--pages-radius-md)"
    padding: "var(--pages-space-4)"
  properties:
    lookup: { uuid: data }
```

Clean separation: `style` for CSS, `properties` for component props.

**Note on content vs data component style authoring:** Content components (html, markdown, title) extract CSS from `properties` because their `properties` block IS CSS — they have no component props. Data components use `properties` for component data (lookup, columns, etc.), so CSS is in a separate `style` peer key. This divergence is intentional: the two component families have different authoring models because their `properties` carry different semantics.

### 4. Grouped-view property forwarding

**Problem:** `_createGroupTable()` explicitly forwards a fixed set of properties to child tables. Every new table property needs manual forwarding.

**Fix:** Extract a single `_forwardPropsToTable` method:

```typescript
private _forwardPropsToTable(table: PagesTableHost, props: GroupedViewProps): void {
  if (this._columnRenderers) table.columnRenderers = this._columnRenderers;
  if (props.rowStyle) table.rowStyle = props.rowStyle;
  if (props.rowAccent) table.rowAccent = props.rowAccent;
  if (props.selection) table.selection = props.selection;
  if (this._getRowKey) table.getRowKey = this._getRowKey;
  if (this._getRowDetail) table.getRowDetail = this._getRowDetail;
  if (this._getRowClass) table.getRowClass = this._getRowClass;
  table.sortable = props.sortable ?? false;
  table.clientSort = props.clientSort ?? false;
  table.activeSort = this._activeSort;
}
```

One place to maintain. `_createGroupTable` calls this instead of inline assignments.

**Supporting type changes:**
- `GroupedViewProps` in `grouped-view-types.ts`: add `readonly clientSort?: boolean` and `readonly rowAccent?: RowAccentConfig`
- `grouped-view-desugar.ts`: add passthrough lines `if (raw.clientSort != null) props.clientSort = raw.clientSort;` and `if (raw.rowAccent != null) props.rowAccent = raw.rowAccent;`

**rowAccent forwarding:** PagesGroupedView receives the declarative `rowAccent` config in its props. In its own `set props()`, it converts the config to a `getRowAccent` function (same logic as `PagesTable.set props()`) and stores the function. `_forwardPropsToTable` forwards the function, not the raw config. This keeps the declarative-to-function conversion in one place per component.

**Files:** `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`, `packages/pages-component/src/model/grouped-view-types.ts`, `packages/pages-ui/src/parser/grouped-view-desugar.ts`

## Additive Features

### 5. Interstitial hook on group headers

**API:** New property on `GroupedViewProps`:

```typescript
renderAfterHeader?: (node: GroupNode) => HTMLElement | undefined;
```

PagesGroupedView calls this after placing the section header, before appending the content wrapper. Consumer returns DOM content or undefined (no interstitial). The `GroupNode` provides `name`, `depth`, `children`, `rowCount`, and `aggregates` — enough for depth-aware decisions (e.g., interstitials at depth 0 only, or content that varies by group path). For single-level grouping, `depth` is always 0.

TypeScript-only (function prop). YAML consumers use markdown components outside the grouped-view for interstitial content.

**Files:** `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`

### 6. `rowAccent` — first-class left-border color

**TypeScript API:**

```typescript
@property({ attribute: false })
getRowAccent?: (row: TypedRow) => string | undefined;
```

Returns a CSS color string, rendered as a 4px left border on the row.

**Rendering mechanism:** In `_renderRow()`, after evaluating `_evaluateRowStyle(row)` to get the rowStyle result, `getRowAccent` is called. If it returns a color, `borderLeft: 4px solid ${color}` is appended to the inline style string AFTER the rowStyle properties. Since both target the same CSS property (`borderLeft`), the later declaration wins in the inline style string. If `rowStyle` uses the `border` shorthand, `borderLeft` still overrides the left side specifically because longhand properties override shorthand components when applied later.

**YAML API:**

```yaml
rowAccent:
  column: status
  colorMap:
    done: "#2e7d32"
    blocked: "#e65100"
    critical: "#d32f2f"
  default: "#9e9e9e"
```

`set props()` converts this to a `getRowAccent` function that maps column values to colors. If the row's column value is not in `colorMap`, the `default` color is used. If `default` is not specified, unmapped values produce no accent (`undefined`).

**Files:**
- `packages/pages-table/src/pages-table.ts` — property, rendering, props parsing
- `packages/pages-table/src/types.ts` — `RowAccentConfig` type
- `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` — forwarding

### 7. Legend companion component

**Element:** `<pages-legend>` registered as `pages-legend`.

**Base class:** `PagesContentElement` — simple display, props + render, no data binding.

**Props:**

```typescript
interface LegendProps {
  entries: readonly { label: string; color: string }[];
  layout?: 'linear' | 'horizontal' | 'grid';
  swatchShape?: 'square' | 'circle';
}
```

**Layout modes:**
- `linear` (default) — `display: flex; flex-wrap: wrap; gap` — wraps naturally
- `horizontal` — `display: flex; flex-wrap: nowrap; overflow-x: auto; gap` — single row, scrolls horizontally without wrapping
- `grid` — `display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`

**Rendering:** The container is a `<ul>` element (for semantic list structure). Each entry is an `<li class="legend-entry">` with a 12×12px swatch (`<span class="legend-swatch" aria-hidden="true">`) and a text label. The swatch is decorative and hidden from assistive technology. The label provides the accessible name for each entry.

**Tokens:** `--pages-font-size-sm`, `--pages-space-2`, `--pages-space-3`, `--pages-neutral-11`, `--pages-radius-sm`.

**Registration:** Handled as a content component — NOT added to `DATA_COMPONENT_TYPES`. The legend is a simple display component with no dataset binding:
- `component-desugar.ts`: type-specific handler for `type: "legend"` returns `{ type: "legend", props: {...} }` without routing through `desugarDisplayer()`. This avoids the TYPE_MAP fallback that would misclassify it as a table and apply table defaults.
- `activation.ts`: type-specific handler creates `<pages-legend>` element and sets `props` directly, following the same pattern as `action-button` and `alert`.

**Files:**
- `packages/pages-viz/src/components/PagesLegend.ts` — new component
- `packages/pages-viz/src/index.ts` — export
- `packages/pages-ui/src/parser/component-desugar.ts` — type-specific handler
- `packages/pages-runtime/src/activation.ts` — type-specific handler

**YAML usage:**
```yaml
- type: legend
  properties:
    entries:
      - label: devtown
        color: "#1976d2"
      - label: engine
        color: "#388e3c"
    layout: linear
```

### 8. Recursive multi-level grouping

**API change:** `groupBy` accepts `GroupingKey | GroupingKey[]`. Single key = current behavior. Array = recursive.

**Data model:** `GroupNode` is defined in `packages/pages-component/src/model/grouped-view-types.ts` alongside `GroupedViewProps` — not in pages-viz. This is necessary because `GroupedViewProps.renderAfterHeader` references `GroupNode` in its signature, and pages-component cannot import from downstream pages-viz. The interface is pure data (primitives + `ColumnId` from upstream pages-data), so it has no dependency on pages-viz.

```typescript
export interface GroupNode {
  readonly name: string;
  readonly depth: number;
  readonly startRow: number;
  readonly rowCount: number;
  readonly children: readonly GroupNode[];
  readonly aggregates?: ReadonlyMap<ColumnId, unknown>;
}
```

**Pipeline integration:** Multi-level grouping requires data pre-sorted by ALL grouping columns in hierarchical order. The desugar produces:
1. A multi-column sort ensuring rows are ordered by `keys[0]`, then `keys[1]` within each `keys[0]` group, etc. This is achieved by producing `SortOp`s for all grouping keys in order (the pipeline's stable sort guarantees correct hierarchical ordering).
2. The existing `GroupOp` applies to the primary key (`keys[0]`). Sub-group partitioning is performed client-side by `extractGroupTree`, which walks the pre-sorted dataset.

**Aggregate computation:** `extractGroupTree` computes ALL aggregates client-side at every level — it does not rely on the pipeline's first-row pre-computation convention. This is necessary because the pipeline's `GroupOp` only pre-computes aggregates for the primary key (`keys[0]`). For K2+ sub-groups that the pipeline didn't create, the first row either contains the wrong aggregate (the parent group's K1-level value) or no pre-computed value at all.

The function signature accepts `AggregationBinding[]` (not just `ColumnId[]`) so it knows both the column and the aggregation function (SUM, COUNT, AVERAGE, etc.) for each aggregate:

```typescript
function extractGroupTree(
  dataset: TypedDataSet,
  keys: readonly GroupingKey[],
  aggregations: readonly AggregationBinding[],
): readonly GroupNode[]
```

At each level, aggregates are computed by iterating the node's row range and applying the aggregation function directly. Intermediate (non-leaf) nodes compute aggregates over their full row range (not rolled up from children) — this ensures correct semantics for non-decomposable aggregations like MEDIAN and AVERAGE, which cannot be computed from sub-group results.

**Extraction:** `extractGroupTree` recursively partitions rows: level 0 by `keys[0]`, level 1 within each level-0 node by `keys[1]`, etc. Leaf nodes have `children = []`. Requires data pre-sorted by all keys in order — unsorted input produces fragmented/duplicate groups.

**Rendering:** Recursive function replaces the current flat loop:

```
renderNode(node, wrapper):
  header = renderGroupHeader(node)  // styled by node.depth
  wrapper.appendChild(header)
  if node.children.length > 0:
    for child in node.children:
      renderNode(child, wrapper)
  else:
    contentWrapper = createTable(node.startRow, node.rowCount)
    wrapper.appendChild(contentWrapper)
```

**Header styling by depth:**
- depth 0: current section heading (16px, bold, 2px bottom border)
- depth 1+: lighter heading (base font, semibold, 1px border, indented by `depth * --pages-space-4`)

**Expand state:** Keys are full paths joined by `\x1F` (ASCII unit separator, cannot appear in column values): `"Engineering"` at depth 0, `"Engineering\x1FActive"` at depth 1. Using `\x1F` instead of `/` avoids key collisions when group names contain `/`.

**Reconciliation:** The `_groupTables` map is keyed by full path (same `\x1F`-separated key as expand state). `_canReconcile` compares the old and new `GroupNode` trees structurally:
- Same tree shape (same paths at all depths) → update data in-place for each leaf table (no DOM rebuild)
- Different shape → full rebuild of the affected subtree. A change at depth 0 invalidates the entire subtree; a change at depth 1 only invalidates that branch.

**Backward compatibility:** Single `GroupingKey` (not array) normalizes to `[key]` internally. Zero change for existing consumers.

**YAML:**
```yaml
- type: grouped-view
  properties:
    groupBy:
      - column: phase
      - column: status
    preset: sectioned
```

The desugar handles both `groupBy: { column: x }` (object → single key) and `groupBy: [{ column: x }, { column: y }]` (array → multi-level).

**Files:**
- `packages/pages-component/src/model/grouped-view-types.ts` — `GroupNode` interface (alongside `GroupedViewProps`)
- `packages/pages-viz/src/components/grouped-view/group-extraction.ts` — `extractGroupTree` (imports `GroupNode` from pages-component)
- `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` — recursive render
- `packages/pages-ui/src/parser/grouped-view-desugar.ts` — array groupBy parsing

## Implementation Order

1. Desugar passthrough ordering (unblocks all YAML prop fixes)
2. Column display hints on ColumnSettings (unblocks column width example)
3. Container styling for data components (unblocks bordered containers)
4. rowAccent (table feature, independent)
5. Grouped-view property forwarding (consolidation, must include rowAccent)
6. Interstitial hook (grouped-view feature, independent)
7. Legend component (new component, independent)
8. Recursive multi-level grouping (grouped-view refactor, largest item)
9. Update Project Roadmap example to demonstrate all features

## Example Update

The `examples/samples/Tables/Project Roadmap.dash.yaml` example will be updated to demonstrate:
- Column widths via `columns[].width`
- Container styling via `style` key (rounded borders on each section table)
- Status icons via JSONata column expressions
- Row coloring via `rowStyle` with background colors
- Row accents via `rowAccent` with column-based color mapping
- Legend component showing repo colors
- Multi-level grouping (if using grouped-view variant) or composed tables with interstitial content
