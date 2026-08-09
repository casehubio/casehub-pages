# Chart Click → Cross-Filter Event Protocol

**Issue:** [#20](https://github.com/casehubio/casehub-pages/issues/20)
**Date:** 2026-06-23
**Status:** Design (revision 4 — final pass findings resolved)
**ECharts version:** 5.6.x (`"echarts": "^5.6.0"` in pages-viz/package.json)

## Problem

The `casehub-filter` event protocol has inconsistencies across emitters that create impedance mismatches, fragile runtime fallback logic, and missing UX affordances.

| Concern | Table | Selector | Chart | IframePlugin |
|---------|-------|----------|-------|-------------|
| `row` reference | ✅ sends | ❌ omits | ❌ omits | ❌ omits |
| `value` in event | ❌ runtime extracts | ❌ runtime extracts | ❌ runtime extracts | ❌ runtime extracts |
| Column identity | clicked column | column[0] | column[0] | from iframe msg |
| Toggle (re-click = deselect) | ❌ | ✅ labels only | ❌ | ❌ (iframe-owned) |
| Visual feedback | hover only | ✅ label chips | ❌ | iframe-owned |
| Record selection (DataScope) | ✅ table-only guard | ❌ blocked | ❌ blocked | ❌ blocked |

The runtime compensates with `const row = eventRow ?? ds.rows[rowIndex]` — a fallback that breaks when client-side filtering or sorting reorders rows (garden gotcha GE-20260621-fe3944).

## Design

### 1. Unified Event Detail Type

A single discriminated union replaces the separate `CasehubFilterDetail` (in `CasehubChartElement.ts`) and `FilterDetail` (in `site.ts`). Defined in `pages-viz/src/base/filter-types.ts`, importable by both `pages-viz` and `pages-runtime`.

```typescript
export type CasehubFilterDetail = CasehubFilterApply | CasehubFilterReset;

export interface CasehubFilterApply {
  readonly columnId: string;
  readonly value: string;
  readonly row: TypedRow;
  readonly reset: false;
  readonly group: string | undefined;
}

export interface CasehubFilterReset {
  readonly columnId: string;
  readonly reset: true;
  readonly group: string | undefined;
}
```

- **`rowIndex` removed.** Positional display-order index is fragile and unnecessary when `row` is always present.
- **`value` added to apply events.** Emitter resolves the filter value at dispatch time. Runtime never extracts from the row.
- **`row` required on apply, absent on reset.** Discriminated union enforces this at the type level.

### 2. Emitter Alignment

Every emitter resolves `row` and `value` at dispatch time. The runtime receives a self-contained event.

#### Charts (CasehubChartElement)

- Widen ECharts click params to an explicit `ChartClickParams` interface:
  ```typescript
  interface ChartClickParams {
    readonly dataIndex: number;
    readonly seriesIndex: number;
    readonly seriesName: string;
    readonly name: string;
    readonly data: unknown;
  }
  ```
  This replaces the current `{ dataIndex: number }`. Fields beyond `dataIndex` are available to subclass overrides and to the visual feedback dispatch (which needs series count).
- Resolve `row` as `this.dataSet.rows[params.dataIndex]`. Confirmed correct: `datasetToSource()` maps `dataIndex` directly to `dataset.rows[dataIndex]` (header row is excluded by ECharts).
- Resolve `value` as `String(cellToRaw(row.cell(filterColumn.id)))`.
- Guard: skip event if `row` is undefined (out of bounds) or cell value is NULL.
- Add protected `resolveFilterColumn(): Column | undefined` — no-arg method, returns `this.dataSet?.columns[0]` by default. Subclasses can override when column[0] isn't the right filter axis. No `params` or `dataset` arguments — no current subclass needs them, and `this.dataSet` is available at call time. If a subclass needs ECharts params in the future, the method signature can be widened or the subclass can override `registerClickHandler` entirely.

#### Tables (CasehubTable)

- Add `value` — resolve `String(cellToRaw(row.cell(columnId)))` at dispatch time.
- Remove `rowIndex` from event detail. Already sends `row`.

#### Selectors (CasehubSelector)

- Add `row` — resolve from `dataset.rows[rowIndex]` at dispatch time (rowIndex from `extractDistinctValues`).
- Add `value` — already available from distinct values extraction.
- For reset events (dropdown "All", label deselect): emit `CasehubFilterReset`.
- Remove `rowIndex` from event detail.

#### IframePlugin (CasehubIframePlugin)

- For apply: resolve `row` as `dataset.rows[msg.row]`, resolve `value` from the row.
- For reset: emit `CasehubFilterReset`.
- Guard: skip if `dataset.rows[msg.row]` is undefined.

### 3. Toggle Semantics

Click-to-select, click-again-to-deselect as default behavior.

#### Charts

Track `_selectedValue: string | undefined` on `CasehubChartElement`:

- Click with no selection → set `_selectedValue`, emit apply.
- Click same value → clear `_selectedValue`, emit reset.
- Click different value → update `_selectedValue`, emit apply.
- Data re-push (`set dataSet`) → check if `_selectedValue` exists in new data. Present → preserve selection, find new dataIndex. Absent → clear selection. This handles:
  - **selfApply:** re-pushed with filtered data → selected value still present → persists.
  - **External filter change:** re-pushed with different data → value gone → clears.
  - **Non-listening (listening: false):** not re-pushed → persists until user toggles.

Value-based tracking (not index) because row objects and indices change across re-pushes; the string value is the stable identity.

#### Tables

Track `_selectedColumnId: ColumnId | undefined` and `_selectedValue: string | undefined`:

- Click a cell → compute value.
  - If matches stored column+value → clear both, emit reset. (Toggle off.)
  - If different column → capture `oldColumnId` from stored values. Store new column+value BEFORE dispatching (ensures any selfApply re-push sees the current intended selection, not stale state). Emit reset with `oldColumnId`. Emit apply with new column+value. (Column switch — single-column-at-a-time. Prevents orphaned filters.)
  - If same column, different value → store new value, emit apply. (Value switch within same column — FilterState replaces the old value.)
- Data re-push (`set dataSet`) → the existence check runs in the `set dataSet` path, before `update()` triggers `render()`. If `_selectedColumnId` and `_selectedValue` are set, scan new rows for a matching cell value at that column. Present → preserve selection (`.selected` class applied during rendering). Absent → clear both before the DOM is rebuilt. This is consistent with the chart re-push strategy and handles selfApply tables correctly.

Both column and value tracked because tables can filter by any column.

#### Selectors

Labels: convert `_selectedLabelIndex: number | undefined` to `_selectedValue: string | undefined` for consistency with charts and tables. Index-based tracking is fragile if data is re-pushed with different ordering. Value-based tracking survives re-ordering. The toggle logic itself (click-to-deselect, dropdown "All") is unchanged — only the tracking mechanism and event detail shape change.

Data re-push: override `set dataSet` to check if `_selectedValue` exists in the new data's distinct values. Present → preserve selection (`.selected` chip applied during rendering). Absent → clear `_selectedValue`. This completes the same existence-check pattern used by charts and tables. Without it, `_selectedValue` can become stale: data re-pushed without the value (clears the chip visually), then later re-pushed with the value (chip re-appears with `.selected` even though the filter was externally cleared).

Slider: no toggle — continuous values don't have natural re-select semantics.

#### IframePlugin

No toggle — iframe owns its own UI state.

### 4. Visual Feedback

#### Charts — ECharts `highlight` / `downplay`

Use `highlight`/`downplay` actions, NOT `selectedMode: 'single'` + `select`/`unselect`. Three reasons:

1. **No double-selection conflict.** `selectedMode: 'single'` makes ECharts internally toggle selection on click, conflicting with our manual `dispatchAction`. `highlight`/`downplay` have no built-in click behavior — the handler has full control.
2. **Multi-series consistency.** `selectedMode: 'single'` selects one series element, not all series at a dataIndex. For a stacked bar with 3 series, only one bar highlights while the filter applies to the entire category. `highlight` accepts `seriesIndex` as an array, highlighting all series at a dataIndex simultaneously.
3. **No setOption reset conflict.** `setOption(option, true)` resets `select` state. `highlight` state is also reset, but since we re-issue the action after `setOption`, the timing is straightforward.

Implementation:
- No `selectedMode` injection needed. No series option mutation.
- On apply: `chart.dispatchAction({ type: 'highlight', seriesIndex: allSeriesIndices, dataIndex })`.
- On previous selection (switching to different value): `chart.dispatchAction({ type: 'downplay', seriesIndex: allSeriesIndices, dataIndex: prevIndex })` before highlighting new.
- On reset: `chart.dispatchAction({ type: 'downplay', seriesIndex: allSeriesIndices, dataIndex })`.
- On data re-push with preserved selection: after `setOption()` in `render()`, re-issue `highlight` for the new dataIndex matching `_selectedValue`.
- `allSeriesIndices`: derived from the live chart option after `setOption()`, NOT from column count. The "column count minus 1" heuristic assumes 1:1 column-to-series mapping, which only holds for bar/line/area. Scatter charts map multiple columns ([x, y, size]) to 1 series. Bubble charts map [x, y, size] or [x, y, size, color] to 1 series. Pie charts map [name, value] to 1 series. The correct derivation:
  ```typescript
  const seriesCount = (chart.getOption().series as unknown[]).length;
  const allSeriesIndices = Array.from({ length: seriesCount }, (_, i) => i);
  ```
  This is always correct regardless of chart type because it reads the actual series configuration.

**Known limitation:** `highlight` uses the emphasis style, which is the same visual treatment as mouse hover. The user cannot visually distinguish "I'm hovering" from "this is the active filter." Acceptable for a first pass. A future refinement could inject per-item `itemStyle` into the option object to provide a distinct selected appearance, but this requires per-chart-type support and is out of scope.

#### Tables — `.selected` CSS class + immediate re-render

- Add `.selected` row style: `background: var(--casehub-bg-selected, #e8f0fe)`.
- During row rendering: if `_selectedColumnId` and `_selectedValue` are set and the current row's cell at `_selectedColumnId` matches `_selectedValue`, add `selected` class to `<tr>`.
- After updating selection state and dispatching the filter event, call `rerender()` to apply the `.selected` class immediately. This is necessary because the table is skipped during its own event re-push unless `selfApply` is set. Charts apply visual feedback in-place via `chart.dispatchAction()`, but tables have no equivalent — DOM rebuild via `rerender()` is the table's feedback mechanism.

#### Selectors

Already have visual feedback. No changes.

#### IframePlugin

Iframe-owned. No changes.

### 5. Record Selection Generalization

Remove the `isTableClick` guard. Any component can trigger DataScope record selection if the data supports it.

**New logic:**

1. Find child DataScope (same-page first, then child pages) — unchanged search.
2. If DataScope found AND event is **apply**:
   - Try `detail.row.cell(childScope.idColumn)`.
   - Column exists and value non-NULL → record selection path.
   - Column missing (`DataSetError` thrown) or value NULL → cross-filter path.
3. If DataScope found AND event is **reset**:
   - Check `ds.columns.some(c => c.id === childScope.idColumn)` (column metadata, not row data — reset events carry no `row`).
   - Column exists in schema → record selection reset (clear at `childScopePath`).
   - Column absent → cross-filter reset (clear at `entry.pagePath`).
   - Same first principle as the apply path: the component's dataset schema determines the path, not the component type.
4. No DataScope → cross-filter path (apply or reset).

This is safe because `TypedRow.cell()` throws `DataSetError("UNKNOWN_COLUMN")` for missing columns. A try/catch cleanly distinguishes "row has idColumn" from "row lacks idColumn." No configuration needed — the runtime infers the path from the data shape.

**Edge case — naming collision:** If a DataScope's `idColumn` (e.g., `"name"`) coincidentally matches a column in a chart's dataset that has different semantics, the runtime will false-positive into record selection. This is unlikely with typical idColumn values (`"id"`, `"uuid"`, `"record_id"`) but is a real edge case. Accepted risk — the alternative (requiring explicit configuration) adds configuration overhead that costs more than the edge case. If this becomes a problem in practice, a `recordSelection: false` opt-out on `FilterSettings` would be a clean fix.

Edit state flush (`isDirty → flushSave`) already runs inside the DataScope block. Removing the `isTableClick` guard above it means flush applies to all component types.

### 6. Runtime Simplification

The filter listener in `site.ts` simplifies:

- **Value resolution eliminated.** No more `cellToRaw(row.cell(columnId))` in the runtime. `detail.value` is authoritative.
- **Fallback logic eliminated.** No more `eventRow ?? ds.rows[rowIndex]`. `detail.row` is authoritative on apply events.
- **`FilterDetail` interface deleted.** Import `CasehubFilterDetail` from `@casehubio/pages-viz/dist/base/filter-types.js`. Type-narrow on `detail.reset`.
- **Record selection generalized.** `isTableClick` guard removed. try/catch on idColumn lookup replaces it.

### 7. Edge Cases

- **NULL values:** Emitters skip the event when the resolved cell value is NULL. Selectors exclude null values from distinct values.
- **Empty datasets:** Existing `if (!firstColumn) return` guard handles this. `rows[dataIndex]` returns undefined, caught by `if (!row) return`.
- **dataIndex out of bounds:** Guard `if (!row) return` handles timing races between `setOption` and click.
- **Column expressions:** `value` uses raw cell value (`cellToRaw`), not expression-transformed display value. FilterState stores raw values; data pipeline filters against raw cells.
- **Date values:** `String(Date)` produces locale-dependent strings. Current behavior, not a regression. Out of scope.
- **Web Component reconnect:** `_selectedValue` persists on the element instance. Chart re-created on reconnect; render path re-issues `highlight` action if value is present in data.

## Files Changed

| File | Change |
|------|--------|
| `packages/pages-viz/src/base/filter-types.ts` | New file: `CasehubFilterDetail` union type, `ChartClickParams` interface |
| `packages/pages-viz/src/base/CasehubChartElement.ts` | Rich event detail, toggle, visual feedback, `resolveFilterColumn()`. Remove old `CasehubFilterDetail` export. |
| `packages/pages-viz/src/components/CasehubTable.ts` | Add `value`, toggle with re-push preservation, `.selected` CSS, remove `rowIndex` |
| `packages/pages-viz/src/components/CasehubSelector.ts` | Add `row` and `value`, convert `_selectedLabelIndex` → `_selectedValue`, remove `rowIndex` |
| `packages/pages-viz/src/components/CasehubIframePlugin.ts` | Resolve `row` and `value` before dispatch |
| `packages/pages-runtime/src/site.ts` | Import unified type, simplify listener, generalize record selection |
| `packages/pages-component/src/model/component-props.ts` | No changes to `FilterSettings` |
| `packages/pages-viz/src/base/CasehubChartElement.test.ts` | Update for new event shape, add toggle and highlight tests |
| `packages/pages-viz/src/components/CasehubTable.test.ts` | Update for new event shape, add toggle and re-push preservation tests |
| `packages/pages-viz/src/components/CasehubSelector.test.ts` | Update for new event shape, value-based label tracking |
| `packages/pages-viz/src/components/CasehubIframePlugin.test.ts` | Update for new event shape |
| `packages/pages-runtime/src/site.test.ts` | Update for simplified listener, record selection from non-table components |
| `docs/CASEHUB-PAGES.md` | Update event protocol section |

## Not In Scope

- **Series-level filtering.** Clicking a specific series bar filters by that series column. Column[0] is the category axis; series dimension is ignored. Future enhancement.
- **Slider reset button.** Slider always emits apply. No natural toggle semantic for continuous values.
- **Locale-independent date filtering.** Current `String(Date)` behavior is preserved.
- **Multi-value selection.** Clicking multiple bars to create an OR filter. Single selection only.
- **FilterSettings.column property.** Explicit override for which column to filter by. `resolveFilterColumn()` override point is sufficient.
- **Drill-down navigation.** `FilterSettings.drillDown` is defined in the type model (`component-props.ts:49-54`) and has a type test, but is NOT referenced in any emitter or runtime handler. It is an unimplemented planned feature. Orthogonal to cross-filtering — drill-down navigates to a different page; cross-filtering filters the current page. If both are eventually needed on the same click, they would be two separate event dispatches.
- **FilterSettings.notification legacy synonym.** `notification` is defined in `FilterSettings` and used in several tests, but is NOT desugared to `enabled` anywhere in the codebase. Emitters check `filter?.enabled` only. `notification: true` without `enabled: true` does not activate filtering. This is a pre-existing issue from the GWT migration — it is not introduced or addressed by this spec.
- **Highlight vs. hover visual distinction.** `highlight/downplay` uses emphasis style, same as hover. A future refinement could inject per-item `itemStyle` for a distinct selected appearance.
