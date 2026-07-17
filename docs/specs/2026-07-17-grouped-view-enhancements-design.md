# Grouped View Enhancements Design

**Issues:** #189, #190, #191, #193
**Branch:** issue-189-grouped-view-enhancements
**Date:** 2026-07-17

## Problem

PagesGroupedView gained multi-table composition in #188 but has gaps:
list mode ignores column renderers (#190), column visibility and selection
are per-table with no cross-group coordination (#191, #193), and there is
no simple path for flat grouped tables without the full PagesGroupedView
machinery (#189).

## Implementation Order

#190 → #191 → #193 → #189

| Order | Issue | Scale | Complexity | Rationale |
|-------|-------|-------|------------|-----------|
| 1 | #190 | S | Low | Independent, no API changes to PagesTable |
| 2 | #191 | S | Med | Adds `hiddenColumns` property to PagesTable, column picker in grouped view header |
| 3 | #193 | S | Med | Same coordination pattern as #191; `selectedKeys` already exists as public property |
| 4 | #189 | M | High | Largest scope — moves code to pages-data, adds groupBy to PagesTable rendering pipeline |

## Architecture After This Branch

| Want this | Use this |
|-----------|----------|
| Flat table with group header rows (spreadsheet) | `<pages-table groupBy="status">` (#189) |
| Collapsible sections with tables per group | `<pages-grouped-view preset="sectioned">` |
| Compact list per group | `<pages-grouped-view preset="list">` |
| Multi-level hierarchy | `<pages-grouped-view :groupBy="[k1, k2]">` |

PagesGroupedView's multi-table composition (from #188) remains the architecture
for rich grouping. Native groupBy on pages-table serves the simple flat case.

---

## #190 — Column Renderers for List Mode

### Changes

**`render-content-list.ts`** — Function gains a `renderers` parameter:

```typescript
export function renderContentList(
  dataset: TypedDataSet,
  boundary: GroupBoundary,
  contentColumns: readonly ColumnId[],
  colWidthsCss: string,
  renderers?: ReadonlyMap<ColumnId, ColumnRenderer>,
): HTMLElement
```

For each cell:
- If `renderers` has an entry for that column → call `renderer(cell, row, column)`
- Check result: `instanceof HTMLElement` → `dd.appendChild(result)`, otherwise `dd.textContent = String(result)`
- No renderer → existing `cellToDisplay()` path unchanged

**`PagesGroupedView.ts`** — List mode branch in `render()` passes `this._columnRenderers`
to `renderContentList()`. Currently renderers are only forwarded to table-mode child
tables via `_forwardPropsToTable`.

### Unchanged

- `ColumnRenderer` type in pages-component (already returns `unknown`)
- Table mode rendering
- `setColumnRenderers()` API on PagesGroupedView

---

## #191 — Synchronized Column Visibility Across Groups

### PagesTable API Addition

New public property:

```typescript
@property({ type: Array, attribute: false }) hiddenColumns?: readonly string[];
```

In `willUpdate`:

```typescript
if (changed.has('hiddenColumns') && this.hiddenColumns !== undefined) {
  this._hiddenColumnIds = new Set(this.hiddenColumns);
}
```

Mirrors the `selectedKeys` → `_internalSelectedKeys` pattern. When set externally,
internal state follows. When not set (standalone PagesTable), `_toggleColumnVisibility`
manages `_hiddenColumnIds` directly — no behavior change.

### PagesGroupedView Changes

**New state:** `_hiddenColumnIds: Set<string>` — single source of truth for column
visibility across all groups.

**Column picker in the shared header bar.** `_buildHeaderBar()` gains a "⋮" button
with a dropdown (checkboxes per column, matching PagesTable's picker structure).
When toggled:

1. Update PagesGroupedView's `_hiddenColumnIds`
2. Set `hiddenColumns` on every child table in `_groupTables`
3. Update the shared header bar grid template columns (hide the header cell too)
4. Emit `column-change` from PagesGroupedView with the unified `visibleColumns`

**Forward on table creation.** `_createGroupTable` and `_createGroupTableFromNode`
pass `hiddenColumns`. `_forwardPropsToTable` includes it.

**List mode.** Hidden columns are filtered out of `contentColumnIds` before passing
to `renderContentList()`.

### Unchanged

- Standalone PagesTable behavior
- PagesTable's own `_toggleColumnVisibility` and `column-change` event
- Multi-level tree rendering (gets `hiddenColumns` forwarded via `_groupTables`)

---

## #193 — Cross-Group Unified Selection

### PagesGroupedView Changes

**New state:** `_selectedKeys: Set<string>` — unified selection set across all groups.

**Select-all checkbox in the shared header bar.** Added to `_buildHeaderBar()` when
`props.selection === 'multi'`. A 40px column prefix (matching PagesTable's layout):

- Checked = all rows across all groups selected
- Indeterminate = some but not all selected
- Click toggles all/none
- Updates `_selectedKeys`, propagates `selectedKeys` to all child tables

**Intercept `selection-change` from child tables.** On table creation with selection
enabled, add a `selection-change` event listener:

- Merge changed table's selected keys into unified `_selectedKeys`
- Propagate unified `selectedKeys` to ALL child tables
- Emit unified `selection-change` from PagesGroupedView

**Coordination flow:**

```
User clicks row in Table A
  → Table A emits selection-change (local keys)
  → PagesGroupedView merges into unified set
  → PagesGroupedView sets selectedKeys on ALL tables
  → Each table's willUpdate syncs selectedKeys → _internalSelectedKeys
```

**Shift-click across groups:** Not supported — range selection works within a single
table only. Cross-table range selection requires global row indices and is a separate
concern.

**`getRowKey` requirement:** PagesTable throws if selection enabled without `getRowKey`.
PagesGroupedView already forwards `getRowKey` via `_forwardPropsToTable`.

### Unchanged

- PagesTable's selection internals
- Single-table selection behavior
- List mode (no selection in list mode)

---

## #189 — Native groupBy on pages-table

### New Property

```typescript
@property({ attribute: false }) groupBy?: ColumnId;
```

Single column only. Multi-column grouping uses PagesGroupedView.

### Code Movement — extractGroupBoundaries to pages-data

`extractGroupBoundaries` and `extractGroupTree` move from
`packages/pages-viz/src/components/grouped-view/group-extraction.ts` to
`packages/pages-data/src/group-extraction.ts`. These are pure data operations
with no DOM dependency. Both pages-table (Lit) and pages-viz (vanilla) import
from pages-data.

`GroupBoundary` type moves to pages-data alongside the functions.

PagesGroupedView's imports update to the new location. No logic changes.

### Rendering

When `groupBy` is set, `willUpdate` computes group boundaries (cached, recomputed
when `dataSet` or `groupBy` changes).

In the body rendering, instead of flat `_visibleRows.map(...)`, iterate by group:

```
for each boundary:
  render group header (full-width div, role="row", spans entire grid)
  render data rows for this boundary
```

**Group header row:** `div` with `role="row"` spanning the full grid. Contains group
name and row count. Styled with distinct background and font weight. Not selectable,
not keyboard-focusable as a data row. Uses `aria-rowindex` in sequence.

**The groupBy column stays visible** in data rows. The header provides group context;
the column provides per-row values. Users hide it via the column picker if desired.

### Feature Interactions

| Feature | Behavior with groupBy |
|---------|----------------------|
| Virtual scroll | Disabled (group headers break fixed-height assumption) |
| Sorting | Works — clientSort sorts flat dataset, boundaries recompute |
| Column picker | Works — group headers adjust span to match visible columns |
| Selection | Works — operates over data rows, ignores group headers |
| Keyboard nav | Skips group headers — arrow keys move between data rows |
| Pagination | Disabled — mode forced to `auto` |
| Filter | Works — boundaries recompute from filtered set |
| Tree rows | Incompatible — `groupBy` and `getChildren` mutually exclusive (throws) |
| Row detail | Works — detail panel renders below data row within its group |

### Unchanged

- PagesTable's existing rendering pipeline for non-grouped mode
- PagesGroupedView (imports updated, no logic changes)
- All existing PagesTable properties and events
