# Chart Click → Cross-Filter Event Protocol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the `casehub-filter` event protocol across all emitters (charts, tables, selectors, iframe plugins) with a self-contained discriminated union, toggle semantics, visual feedback, and generalized record selection.

**Architecture:** Discriminated union type (`CasehubFilterApply | CasehubFilterReset`) in `filter-types.ts`. Every emitter resolves `row` and `value` at dispatch time — the runtime never falls back or guesses. Toggle via value-based tracking (`_selectedValue`). Visual feedback via ECharts `highlight`/`downplay` for charts, `.selected` CSS class for tables. Record selection generalized from table-only to data-shape-inferred.

**Tech Stack:** TypeScript, Vitest, ECharts 5.6.x, Web Components

## Global Constraints

- Build order: `yarn build:packages` (must rebuild pages-viz before pages-runtime picks up the new type export).
- Run tests: `yarn workspace @casehubio/pages-viz run test` and `yarn workspace @casehubio/pages-runtime run test`.
- Typecheck: `yarn typecheck`.
- ECharts version: `^5.6.0` — use `highlight`/`downplay` actions, NOT `selectedMode`/`select`.
- `CasehubFilterDetail` is a public API export from `@casehubio/pages-viz/dist/index.js` — the re-export in `index.ts` must be updated when the type moves.
- All emitters skip events when resolved cell value is NULL. Selectors exclude null values from distinct values.

---

### Task 1: Unified Event Detail Type + Chart Emitter Alignment

The foundation: define the new type, update the chart emitter to produce it, update chart tests. This is the largest task because it introduces the new type, removes the old one, updates the public API export, and implements chart toggle + visual feedback in one cohesive unit.

**Files:**
- Create: `packages/pages-viz/src/base/filter-types.ts`
- Modify: `packages/pages-viz/src/base/CasehubChartElement.ts`
- Modify: `packages/pages-viz/src/index.ts` (re-export update)
- Modify: `packages/pages-viz/src/base/CasehubChartElement.test.ts`

**Interfaces:**
- Consumes: `TypedRow`, `CellValue`, `ColumnId`, `Column` from `@casehubio/pages-data`; `cellToRaw` from `./cell-extract.js`; `FilterSettings` from `@casehubio/pages-component`
- Produces: `CasehubFilterDetail`, `CasehubFilterApply`, `CasehubFilterReset`, `ChartClickParams` types exported from `filter-types.ts`. Chart emits events conforming to the discriminated union. `resolveFilterColumn()` protected method on `CasehubChartElement`.

- [ ] **Step 1: Create `filter-types.ts` with the discriminated union and `ChartClickParams`**

Create `packages/pages-viz/src/base/filter-types.ts`:

```typescript
import type { TypedRow, Column } from "@casehubio/pages-data/dist/dataset/types.js";

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

export interface ChartClickParams {
  readonly dataIndex: number;
  readonly seriesIndex: number;
  readonly seriesName: string;
  readonly name: string;
  readonly data: unknown;
}
```

Note: `Column` import is for `resolveFilterColumn` return type — used by the chart element, not the types file itself. Remove the import here; the chart will import `Column` directly.

- [ ] **Step 2: Update `index.ts` — re-export from `filter-types.ts` instead of `CasehubChartElement.ts`**

In `packages/pages-viz/src/index.ts`, change:

```typescript
// OLD
export type { CasehubFilterDetail } from "./base/CasehubChartElement.js";

// NEW
export type { CasehubFilterDetail, CasehubFilterApply, CasehubFilterReset, ChartClickParams } from "./base/filter-types.js";
```

- [ ] **Step 3: Write failing tests for the new chart event shape**

In `packages/pages-viz/src/base/CasehubChartElement.test.ts`, update the existing `click-to-filter` tests and add toggle + highlight tests. Replace the existing "click with filter enabled" test:

```typescript
import type { CasehubFilterApply, CasehubFilterReset } from "./filter-types.js";
import { toTypedDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";
import type { DataSet } from "@casehubio/pages-data/dist/dataset/types.js";

// Replace mockDataSet with one that produces real TypedRows:
function mockTypedDataSet(columnId = "col1" as ColumnId): TypedDataSet {
  const ds: DataSet = {
    columns: [{ id: columnId, name: "Column 1", type: "LABEL" as ColumnType }],
    data: [["Alpha"], ["Beta"], ["Gamma"]],
  };
  return toTypedDataSet(ds);
}

// In the click-to-filter describe block:

it("click emits CasehubFilterApply with value and row", () => {
  const columnId = "region" as ColumnId;
  const props: TestChartProps = {
    lookup: mockLookup("sales"),
    filter: { enabled: true, group: "g1" },
  };
  el.props = props;
  document.body.appendChild(el);

  const ds = mockTypedDataSet(columnId);
  el.dataSet = ds;

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  const filterEvents: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => filterEvents.push(e as CustomEvent));

  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });

  expect(filterEvents).toHaveLength(1);
  const detail = filterEvents[0]!.detail as CasehubFilterApply;
  expect(detail.columnId).toBe(columnId);
  expect(detail.value).toBe("Beta");
  expect(detail.row).toBe(ds.rows[1]);
  expect(detail.reset).toBe(false);
  expect(detail.group).toBe("g1");
});

it("click same value twice toggles — second emits CasehubFilterReset", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);
  el.dataSet = mockTypedDataSet(columnId);

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

  clickHandler({ dataIndex: 0, seriesIndex: 0, seriesName: "s0", name: "Alpha", data: "Alpha" });
  clickHandler({ dataIndex: 0, seriesIndex: 0, seriesName: "s0", name: "Alpha", data: "Alpha" });

  expect(events).toHaveLength(2);
  expect((events[0]!.detail as CasehubFilterApply).reset).toBe(false);
  expect((events[1]!.detail as CasehubFilterReset).reset).toBe(true);
  expect((events[1]!.detail as CasehubFilterReset).columnId).toBe(columnId);
});

it("click different value switches selection", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);
  el.dataSet = mockTypedDataSet(columnId);

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

  clickHandler({ dataIndex: 0, seriesIndex: 0, seriesName: "s0", name: "Alpha", data: "Alpha" });
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });

  expect(events).toHaveLength(2);
  expect((events[0]!.detail as CasehubFilterApply).value).toBe("Alpha");
  expect((events[1]!.detail as CasehubFilterApply).value).toBe("Beta");
});

it("skips event when cell value is NULL", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);

  const dsWithNull: DataSet = {
    columns: [{ id: columnId, name: "Region", type: "LABEL" as ColumnType }],
    data: [[null]],
  };
  el.dataSet = toTypedDataSet(dsWithNull);

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

  clickHandler({ dataIndex: 0, seriesIndex: 0, seriesName: "s0", name: "", data: null });

  expect(events).toHaveLength(0);
});

it("data re-push preserves selection when value exists in new data", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);
  el.dataSet = mockTypedDataSet(columnId);

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  // Select "Beta"
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });

  // Re-push with same data — selection should be preserved
  el.dataSet = mockTypedDataSet(columnId);

  // Click "Beta" again — should toggle OFF (selection was preserved)
  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });

  expect(events).toHaveLength(1);
  expect((events[0]!.detail as CasehubFilterReset).reset).toBe(true);
});

it("data re-push clears selection when value is absent from new data", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);
  el.dataSet = mockTypedDataSet(columnId); // Alpha, Beta, Gamma

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  // Select "Beta"
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });

  // Re-push with data that does NOT contain "Beta"
  const dsNoBeta: DataSet = {
    columns: [{ id: columnId, name: "Region", type: "LABEL" as ColumnType }],
    data: [["Alpha"], ["Gamma"]],
  };
  el.dataSet = toTypedDataSet(dsNoBeta);

  // Click "Alpha" — should be a fresh select, not a toggle
  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));
  clickHandler({ dataIndex: 0, seriesIndex: 0, seriesName: "s0", name: "Alpha", data: "Alpha" });

  expect(events).toHaveLength(1);
  expect((events[0]!.detail as CasehubFilterApply).reset).toBe(false);
  expect((events[0]!.detail as CasehubFilterApply).value).toBe("Alpha");
});

it("highlight dispatched on apply, downplay on reset", () => {
  const columnId = "region" as ColumnId;
  el.props = { lookup: mockLookup("sales"), filter: { enabled: true } };
  document.body.appendChild(el);
  el.dataSet = mockTypedDataSet(columnId);

  // Mock chart.getOption to return series array
  mockChart.getOption = vi.fn(() => ({ series: [{ type: "bar" }] }));
  mockChart.dispatchAction = vi.fn();

  const clickHandler = mockChart.on.mock.calls.find(
    (c: unknown[]) => c[0] === "click",
  )![1] as (params: { dataIndex: number; seriesIndex: number; seriesName: string; name: string; data: unknown }) => void;

  // Apply
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });
  expect(mockChart.dispatchAction).toHaveBeenCalledWith({
    type: "highlight",
    seriesIndex: [0],
    dataIndex: 1,
  });

  // Toggle off
  mockChart.dispatchAction.mockClear();
  clickHandler({ dataIndex: 1, seriesIndex: 0, seriesName: "s0", name: "Beta", data: "Beta" });
  expect(mockChart.dispatchAction).toHaveBeenCalledWith({
    type: "downplay",
    seriesIndex: [0],
    dataIndex: 1,
  });
});
```

Also update the existing "click with filter disabled" and "click with no filter setting" tests — they stay the same (no event emitted). Update the "click handler uses current dataSet" test to check `detail.value` instead of `detail.columnId` plus `detail.rowIndex`.

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test`
Expected: Failures on new tests (old `CasehubFilterDetail` shape, no toggle, no highlight)

- [ ] **Step 5: Implement `CasehubChartElement` changes**

In `packages/pages-viz/src/base/CasehubChartElement.ts`:

1. Remove the old `CasehubFilterDetail` interface (lines 12-17).
2. Add imports: `import type { CasehubFilterDetail, CasehubFilterApply, CasehubFilterReset, ChartClickParams } from "./filter-types.js";` and `import type { Column } from "@casehubio/pages-data/dist/dataset/types.js";` and `import { cellToRaw } from "./cell-extract.js";`.
3. Add `_selectedValue: string | undefined` field.
4. Add `_selectedDataIndex: number | undefined` field (for downplay dispatch).
5. Override `set dataSet` to run existence check:
   ```typescript
   override set dataSet(value: TypedDataSet | undefined) {
     super.dataSet = value;
     if (this._selectedValue !== undefined && value) {
       const filterCol = this.resolveFilterColumn();
       if (filterCol) {
         const idx = value.rows.findIndex(r => {
           const cell = r.cell(filterCol.id);
           return cell.type !== "NULL" && String(cellToRaw(cell)) === this._selectedValue;
         });
         if (idx >= 0) {
           this._selectedDataIndex = idx;
         } else {
           this._selectedValue = undefined;
           this._selectedDataIndex = undefined;
         }
       }
     }
   }
   ```
6. Add `protected resolveFilterColumn(): Column | undefined` returning `this.dataSet?.columns[0]`.
7. Replace `registerClickHandler`:
   ```typescript
   private registerClickHandler(chart: ECharts): void {
     chart.on("click", (params: ChartClickParams) => {
       const filter = this.props.filter;
       if (!filter?.enabled) return;

       const ds = this.dataSet;
       if (!ds) return;

       const filterCol = this.resolveFilterColumn();
       if (!filterCol) return;

       const row = ds.rows[params.dataIndex];
       if (!row) return;

       const cell = row.cell(filterCol.id);
       if (cell.type === "NULL") return;

       const value = String(cellToRaw(cell));

       if (value === this._selectedValue) {
         // Toggle off
         const prevIndex = this._selectedDataIndex;
         this._selectedValue = undefined;
         this._selectedDataIndex = undefined;
         this.syncHighlight(chart, prevIndex, undefined);
         this.dispatchEvent(
           new CustomEvent<CasehubFilterDetail>("casehub-filter", {
             bubbles: true,
             composed: true,
             detail: { columnId: filterCol.id, reset: true, group: filter.group } satisfies CasehubFilterReset,
           }),
         );
       } else {
         // Apply (new or switch)
         const prevIndex = this._selectedDataIndex;
         this._selectedValue = value;
         this._selectedDataIndex = params.dataIndex;
         this.syncHighlight(chart, prevIndex, params.dataIndex);
         this.dispatchEvent(
           new CustomEvent<CasehubFilterDetail>("casehub-filter", {
             bubbles: true,
             composed: true,
             detail: { columnId: filterCol.id, value, row, reset: false, group: filter.group } satisfies CasehubFilterApply,
           }),
         );
       }
     });
   }
   ```
8. Add `syncHighlight` method:
   ```typescript
   private syncHighlight(chart: ECharts, prevIndex: number | undefined, newIndex: number | undefined): void {
     const seriesCount = (chart.getOption().series as unknown[]).length;
     const seriesIndex = Array.from({ length: seriesCount }, (_, i) => i);

     if (prevIndex !== undefined) {
       chart.dispatchAction({ type: "downplay", seriesIndex, dataIndex: prevIndex });
     }
     if (newIndex !== undefined) {
       chart.dispatchAction({ type: "highlight", seriesIndex, dataIndex: newIndex });
     }
   }
   ```
9. In the `render()` method, after `chart.setOption(option, true)`, add:
   ```typescript
   if (this._selectedValue !== undefined && this._selectedDataIndex !== undefined) {
     this.syncHighlight(chart, undefined, this._selectedDataIndex);
   }
   ```
10. In `disconnectedCallback`, also clear `_selectedValue` and `_selectedDataIndex`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test`
Expected: All tests pass.

- [ ] **Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: No errors. If pages-runtime has import errors for the old `CasehubFilterDetail` location, those will be addressed in Task 4.

- [ ] **Step 8: Commit**

```bash
git add packages/pages-viz/src/base/filter-types.ts packages/pages-viz/src/base/CasehubChartElement.ts packages/pages-viz/src/base/CasehubChartElement.test.ts packages/pages-viz/src/index.ts
git commit -m "feat: unified CasehubFilterDetail type, chart emitter alignment with toggle and highlight

Discriminated union (CasehubFilterApply | CasehubFilterReset) in
filter-types.ts. Chart emitter resolves row and value at dispatch time.
Toggle via _selectedValue tracking. Visual feedback via ECharts
highlight/downplay. Protected resolveFilterColumn() for subclass
override. NULL cell guard.

Refs #20"
```

---

### Task 2: Table Emitter — Value, Toggle, Visual Feedback, Re-push Preservation

**Files:**
- Modify: `packages/pages-viz/src/components/CasehubTable.ts`
- Modify: `packages/pages-viz/src/components/CasehubTable.test.ts`

**Interfaces:**
- Consumes: `CasehubFilterDetail`, `CasehubFilterApply`, `CasehubFilterReset` from `../base/filter-types.js`; `cellToRaw` from `../base/cell-extract.js`
- Produces: Table emits `casehub-filter` events with the discriminated union shape. Selection tracked via `_selectedColumnId` and `_selectedValue`.

- [ ] **Step 1: Write failing tests for table toggle, `.selected` class, and re-push preservation**

Add to `packages/pages-viz/src/components/CasehubTable.test.ts`:

```typescript
import type { CasehubFilterApply, CasehubFilterReset } from "../base/filter-types.js";

describe("click-to-filter", () => {
  it("click emits CasehubFilterApply with value and row", () => {
    const ds = makeDataSet(
      [["region", "LABEL"], ["sales", "NUMBER"]],
      [["North", 100], ["South", 200]],
    );
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true, group: "g1" } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    const events: CustomEvent[] = [];
    el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

    const rows = queryRows(el);
    const firstCell = rows[0]!.querySelector("td")!;
    firstCell.click();

    expect(events).toHaveLength(1);
    const detail = events[0]!.detail as CasehubFilterApply;
    expect(detail.columnId).toBe("region");
    expect(detail.value).toBe("North");
    expect(detail.row).toBe(ds.rows[0]);
    expect(detail.reset).toBe(false);
    expect(detail.group).toBe("g1");
  });

  it("click same cell twice toggles — second emits reset", () => {
    const ds = makeDataSet([["region", "LABEL"]], [["North"], ["South"]]);
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    const events: CustomEvent[] = [];
    el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

    const firstCell = queryRows(el)[0]!.querySelector("td")!;
    firstCell.click();
    firstCell.click();

    expect(events).toHaveLength(2);
    expect((events[0]!.detail as CasehubFilterApply).reset).toBe(false);
    expect((events[1]!.detail as CasehubFilterReset).reset).toBe(true);
  });

  it("column switch emits reset for old column then apply for new", () => {
    const ds = makeDataSet(
      [["region", "LABEL"], ["quarter", "LABEL"]],
      [["North", "Q1"], ["South", "Q2"]],
    );
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    const events: CustomEvent[] = [];
    el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

    // Click region=North
    queryRows(el)[0]!.querySelectorAll("td")[0]!.click();
    // Click quarter=Q2 (different column)
    queryRows(el)[1]!.querySelectorAll("td")[1]!.click();

    expect(events).toHaveLength(3); // apply + reset + apply
    expect((events[0]!.detail as CasehubFilterApply).columnId).toBe("region");
    expect((events[1]!.detail as CasehubFilterReset).columnId).toBe("region");
    expect((events[1]!.detail as CasehubFilterReset).reset).toBe(true);
    expect((events[2]!.detail as CasehubFilterApply).columnId).toBe("quarter");
    expect((events[2]!.detail as CasehubFilterApply).value).toBe("Q2");
  });

  it("selected row gets .selected CSS class after click", () => {
    const ds = makeDataSet([["region", "LABEL"]], [["North"], ["South"]]);
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    queryRows(el)[0]!.querySelector("td")!.click();

    const rows = queryRows(el);
    expect(rows[0]!.classList.contains("selected")).toBe(true);
    expect(rows[1]!.classList.contains("selected")).toBe(false);
  });

  it("toggle off removes .selected class", () => {
    const ds = makeDataSet([["region", "LABEL"]], [["North"]]);
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    queryRows(el)[0]!.querySelector("td")!.click();
    expect(queryRows(el)[0]!.classList.contains("selected")).toBe(true);

    queryRows(el)[0]!.querySelector("td")!.click();
    expect(queryRows(el)[0]!.classList.contains("selected")).toBe(false);
  });

  it("data re-push preserves selection when value exists", () => {
    const ds1 = makeDataSet([["region", "LABEL"]], [["North"], ["South"]]);
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds1;

    queryRows(el)[0]!.querySelector("td")!.click();

    // Re-push with same data
    const ds2 = makeDataSet([["region", "LABEL"]], [["South"], ["North"]]);
    el.dataSet = ds2;

    // "North" is still present → selection preserved → row with North gets .selected
    const rows = queryRows(el);
    const northRow = rows.find(r => queryCells(r)[0] === "North");
    expect(northRow!.classList.contains("selected")).toBe(true);
  });

  it("data re-push clears selection when value absent", () => {
    const ds1 = makeDataSet([["region", "LABEL"]], [["North"], ["South"]]);
    const props: TableProps = { lookup: mockLookup("test"), filter: { enabled: true } };
    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds1;

    queryRows(el)[0]!.querySelector("td")!.click();

    // Re-push WITHOUT "North"
    const ds2 = makeDataSet([["region", "LABEL"]], [["South"], ["East"]]);
    el.dataSet = ds2;

    const rows = queryRows(el);
    expect(rows.every(r => !r.classList.contains("selected"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test -- --grep "click-to-filter"`

- [ ] **Step 3: Implement table changes**

In `packages/pages-viz/src/components/CasehubTable.ts`:

1. Add imports: `import type { CasehubFilterDetail, CasehubFilterApply, CasehubFilterReset } from "../base/filter-types.js";`
2. Add fields: `private _selectedColumnId: ColumnId | undefined;` and `private _selectedValue: string | undefined;`.
3. Override `set dataSet` for existence check:
   ```typescript
   override set dataSet(value: TypedDataSet | undefined) {
     if (this._selectedColumnId !== undefined && this._selectedValue !== undefined && value) {
       const colId = this._selectedColumnId;
       const selVal = this._selectedValue;
       const found = value.rows.some(row => {
         try {
           const cell = row.cell(colId);
           return cell.type !== "NULL" && String(cellToRaw(cell)) === selVal;
         } catch { return false; }
       });
       if (!found) {
         this._selectedColumnId = undefined;
         this._selectedValue = undefined;
       }
     }
     super.dataSet = value;
   }
   ```
4. Add `.selected` style to TABLE_CSS: `tr.selected { background: var(--casehub-bg-selected, #e8f0fe); }`
5. Replace the cell click handler (inside the row-rendering loop). The new handler implements toggle with column-switch semantics and calls `rerender()`:
   ```typescript
   if (props.filter?.enabled) {
     const columnId = col.id;
     const clickedRow = row;
     td.addEventListener("click", () => {
       const cellVal = row.cell(columnId);
       if (cellVal.type === "NULL") return;
       const value = String(cellToRaw(cellVal));

       if (columnId === this._selectedColumnId && value === this._selectedValue) {
         // Toggle off
         this._selectedColumnId = undefined;
         this._selectedValue = undefined;
         this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
           bubbles: true, composed: true,
           detail: { columnId, reset: true, group: props.filter?.group } satisfies CasehubFilterReset,
         }));
       } else if (this._selectedColumnId !== undefined && this._selectedColumnId !== columnId) {
         // Column switch — reset old, apply new
         const oldColumnId = this._selectedColumnId;
         this._selectedColumnId = columnId;
         this._selectedValue = value;
         this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
           bubbles: true, composed: true,
           detail: { columnId: oldColumnId, reset: true, group: props.filter?.group } satisfies CasehubFilterReset,
         }));
         this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
           bubbles: true, composed: true,
           detail: { columnId, value, row: clickedRow, reset: false, group: props.filter?.group } satisfies CasehubFilterApply,
         }));
       } else {
         // Same column new value, or first selection
         this._selectedColumnId = columnId;
         this._selectedValue = value;
         this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
           bubbles: true, composed: true,
           detail: { columnId, value, row: clickedRow, reset: false, group: props.filter?.group } satisfies CasehubFilterApply,
         }));
       }
       this.rerender(props, dataset);
     });
   }
   ```
6. In the row-rendering loop, apply `.selected` class:
   ```typescript
   if (props.filter?.enabled) tr.className = "clickable";
   if (this._selectedColumnId !== undefined && this._selectedValue !== undefined) {
     try {
       const selCell = row.cell(this._selectedColumnId);
       if (selCell.type !== "NULL" && String(cellToRaw(selCell)) === this._selectedValue) {
         tr.classList.add("selected");
       }
     } catch { /* column not present in this row — skip */ }
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test`

- [ ] **Step 5: Commit**

```bash
git add packages/pages-viz/src/components/CasehubTable.ts packages/pages-viz/src/components/CasehubTable.test.ts
git commit -m "feat: table emitter — value, toggle, .selected CSS, re-push preservation

Table emits CasehubFilterApply/Reset with value and row. Toggle with
single-column-at-a-time semantics (column switch emits reset before
apply). .selected row style. Selection preserved across data re-push
when value exists.

Refs #20"
```

---

### Task 3: Selector + IframePlugin Emitter Alignment

**Files:**
- Modify: `packages/pages-viz/src/components/CasehubSelector.ts`
- Modify: `packages/pages-viz/src/components/CasehubSelector.test.ts`
- Modify: `packages/pages-viz/src/components/CasehubIframePlugin.ts`
- Modify: `packages/pages-viz/src/components/CasehubIframePlugin.test.ts`

**Interfaces:**
- Consumes: `CasehubFilterDetail`, `CasehubFilterApply`, `CasehubFilterReset` from `../base/filter-types.js`
- Produces: Selector and IframePlugin emit events with the discriminated union shape. Selector uses `_selectedValue` instead of `_selectedLabelIndex`.

- [ ] **Step 1: Write failing tests for selector new event shape and value-based tracking**

Update `packages/pages-viz/src/components/CasehubSelector.test.ts`:

```typescript
import type { CasehubFilterApply, CasehubFilterReset } from "../base/filter-types.js";

// Update "selection change emits casehub-filter" test:
it("selection change emits CasehubFilterApply with value and row", () => {
  const ds = makeDataSet([["category", "LABEL"]], [["A"], ["B"], ["C"]]);
  const props: SelectorProps = {
    lookup: mockLookup("test"),
    filter: { enabled: true, group: "myGroup" },
  };
  el.props = props;
  document.body.appendChild(el);
  el.dataSet = ds;

  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

  const select = el.shadowRoot.querySelector("select")!;
  select.selectedIndex = 2; // Select "B"
  select.dispatchEvent(new Event("change"));

  expect(events).toHaveLength(1);
  const detail = events[0]!.detail as CasehubFilterApply;
  expect(detail.columnId).toBe("category");
  expect(detail.value).toBe("B");
  expect(detail.row).toBe(ds.rows[1]);
  expect(detail.reset).toBe(false);
  expect(detail.group).toBe("myGroup");
});

// Update "selecting All emits reset" test:
it("selecting All emits CasehubFilterReset", () => {
  const ds = makeDataSet([["category", "LABEL"]], [["A"], ["B"]]);
  const props: SelectorProps = { lookup: mockLookup("test") };
  el.props = props;
  document.body.appendChild(el);
  el.dataSet = ds;

  const events: CustomEvent[] = [];
  el.addEventListener("casehub-filter", (e) => events.push(e as CustomEvent));

  const select = el.shadowRoot.querySelector("select")!;
  select.selectedIndex = 0;
  select.dispatchEvent(new Event("change"));

  expect(events).toHaveLength(1);
  const detail = events[0]!.detail as CasehubFilterReset;
  expect(detail.reset).toBe(true);
  expect(detail.columnId).toBe("category");
  expect(detail).not.toHaveProperty("value");
  expect(detail).not.toHaveProperty("row");
});

// Add label re-push preservation test:
it("label selection clears when data re-push removes selected value", () => {
  const ds1 = makeDataSet([["tag", "LABEL"]], [["Red"], ["Blue"]]);
  const props: SelectorProps = { lookup: mockLookup("test"), subtype: "labels" };
  el.props = props;
  document.body.appendChild(el);
  el.dataSet = ds1;

  // Select "Red"
  (el.shadowRoot.querySelector(".label-chip") as HTMLButtonElement).click();
  expect(el.shadowRoot.querySelector(".label-chip.selected")).toBeTruthy();

  // Re-push without "Red"
  const ds2 = makeDataSet([["tag", "LABEL"]], [["Blue"], ["Green"]]);
  el.dataSet = ds2;

  // No chip should be selected
  expect(el.shadowRoot.querySelector(".label-chip.selected")).toBeNull();
});
```

- [ ] **Step 2: Write failing tests for iframe new event shape**

Update `packages/pages-viz/src/components/CasehubIframePlugin.test.ts` — the "handles FILTER messages from iframe" test:

```typescript
import type { CasehubFilterApply } from "../base/filter-types.js";
import { toTypedDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";
import type { DataSet } from "@casehubio/pages-data/dist/dataset/types.js";

it("handles FILTER messages — emits CasehubFilterApply with row and value", () => {
  const props: IframePluginProps = {
    componentId: "echarts",
    filter: { group: "test-group" },
  };

  const rawDs: DataSet = {
    columns: [{ id: "col1" as ColumnId, name: "col1", type: "TEXT" as ColumnType }],
    data: [["Alpha"], ["Beta"], ["Gamma"], ["Delta"], ["Echo"], ["Foxtrot"]],
  };
  const dataset = toTypedDataSet(rawDs);

  element.props = props;
  element.dataSet = dataset;

  const filterHandler = vi.fn();
  element.addEventListener("casehub-filter", filterHandler);

  window.dispatchEvent(new MessageEvent("message", {
    data: {
      type: "FILTER",
      properties: {
        COMPONENT_ID: "echarts",
        FILTER: { column: 0, row: 5, reset: false },
      },
    },
  }));

  expect(filterHandler).toHaveBeenCalledTimes(1);
  const detail = filterHandler.mock.calls[0][0].detail as CasehubFilterApply;
  expect(detail.columnId).toBe("col1");
  expect(detail.value).toBe("Foxtrot");
  expect(detail.row).toBe(dataset.rows[5]);
  expect(detail.reset).toBe(false);
  expect(detail.group).toBe("test-group");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test`

- [ ] **Step 4: Implement selector changes**

In `packages/pages-viz/src/components/CasehubSelector.ts`:

1. Add imports: `import type { CasehubFilterDetail, CasehubFilterApply, CasehubFilterReset } from "../base/filter-types.js";`
2. Replace `_selectedLabelIndex: number | undefined` with `_selectedValue: string | undefined`.
3. Override `set dataSet` for existence check:
   ```typescript
   override set dataSet(value: TypedDataSet | undefined) {
     if (this._selectedValue !== undefined && value && value.columns.length > 0) {
       const colId = value.columns[0]!.id;
       const found = value.rows.some(row => {
         const cell = row.cell(colId);
         return cell.type !== "NULL" && String(cellToRaw(cell)) === this._selectedValue;
       });
       if (!found) this._selectedValue = undefined;
     }
     super.dataSet = value;
   }
   ```
4. Update dropdown handler to include `row` and `value`, emit `CasehubFilterReset` for "All".
5. Update slider handler to include `row` and `value`.
6. Update labels handler to use `_selectedValue` instead of `_selectedLabelIndex`. Check chip text against `_selectedValue` for `.selected` class.

- [ ] **Step 5: Implement iframe plugin changes**

In `packages/pages-viz/src/components/CasehubIframePlugin.ts`:

1. Add import: `import type { CasehubFilterDetail, CasehubFilterApply, CasehubFilterReset } from "../base/filter-types.js";` and `import { cellToRaw } from "../base/cell-extract.js";`
2. In `handleMessage`, resolve `row` and `value` before dispatching:
   ```typescript
   const rowObj = dataset.rows[row];
   if (!rowObj) return;

   if (typeof reset === "boolean" && reset) {
     this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
       bubbles: true, composed: true,
       detail: { columnId, reset: true, group: props.filter?.group } satisfies CasehubFilterReset,
     }));
   } else {
     const cell = rowObj.cell(columnId);
     if (cell.type === "NULL") return;
     const value = String(cellToRaw(cell));
     this.dispatchEvent(new CustomEvent<CasehubFilterDetail>("casehub-filter", {
       bubbles: true, composed: true,
       detail: { columnId, value, row: rowObj, reset: false, group: props.filter?.group } satisfies CasehubFilterApply,
     }));
   }
   ```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test`

- [ ] **Step 7: Run typecheck**

Run: `yarn typecheck`

- [ ] **Step 8: Commit**

```bash
git add packages/pages-viz/src/components/CasehubSelector.ts packages/pages-viz/src/components/CasehubSelector.test.ts packages/pages-viz/src/components/CasehubIframePlugin.ts packages/pages-viz/src/components/CasehubIframePlugin.test.ts
git commit -m "feat: selector and iframe plugin emitter alignment

Selector emits CasehubFilterApply/Reset with row and value. Labels
use _selectedValue (value-based) instead of _selectedLabelIndex
(index-based). set dataSet existence check clears stale selection.
IframePlugin resolves row and value from dataset before dispatching.

Refs #20"
```

---

### Task 4: Runtime Simplification + Record Selection Generalization

**Files:**
- Modify: `packages/pages-runtime/src/site.ts`
- Modify: `packages/pages-runtime/src/site.test.ts`

**Interfaces:**
- Consumes: `CasehubFilterDetail`, `CasehubFilterApply`, `CasehubFilterReset` from `@casehubio/pages-viz/dist/base/filter-types.js`
- Produces: Simplified filter listener with generalized record selection

- [ ] **Step 1: Build packages first (runtime depends on viz)**

Run: `yarn build:packages`

- [ ] **Step 2: Write/update failing tests for the runtime filter listener**

In `packages/pages-runtime/src/site.test.ts`, update the existing cross-filter test (the one using `notification: true`) to verify the new event shape is handled, and add a test for the selector emitting `CasehubFilterReset` (no `row`/`value`).

The existing test at line 344 ("selector filter updates bar chart data") uses `select.value = "0"` and `select.dispatchEvent(new Event("change"))` which triggers the selector's internal handler — after Task 3, that handler now emits the new event shape. So this test should pass if the runtime handles the new shape.

Key test to add: verify the runtime uses `detail.value` directly instead of extracting from the row.

- [ ] **Step 3: Implement runtime changes**

In `packages/pages-runtime/src/site.ts`:

1. Remove the local `FilterDetail` interface (lines 51-57).
2. Add import: `import type { CasehubFilterDetail, CasehubFilterApply } from "@casehubio/pages-viz/dist/base/filter-types.js";`
3. Remove unused import: `cellToRaw` from `@casehubio/pages-viz` (no longer needed in the filter listener).
4. Replace the filter listener (lines 308-400). The new listener:
   ```typescript
   target.addEventListener("casehub-filter", ((e: Event) => {
     const detail = (e as CustomEvent<CasehubFilterDetail>).detail;
     const componentId = findComponentId(e);
     if (!componentId) return;

     const entry = registry.get(componentId);
     if (!entry?.vizElement) return;

     const ds = entry.vizElement.dataSet as TypedDataSet | undefined;
     if (!ds) return;

     const { columnId, group } = detail;

     // --- Record selection vs cross-filter path ---
     let childScopePath: string | undefined;
     let childScope: ReturnType<typeof getDataScope> | undefined;

     // Check same-page DataScope first
     const samePage = getDataScope(dataScopeRegistry, entry.pagePath);
     if (samePage) {
       childScopePath = entry.pagePath;
       childScope = samePage;
     }
     // Then check child pages
     if (!childScope) {
       const prefix = entry.pagePath === "" ? "" : entry.pagePath + "/";
       for (const [path, scope] of dataScopeRegistry) {
         if (path.startsWith(prefix)) {
           childScopePath = path;
           childScope = scope;
           break;
         }
       }
     }

     // Determine if this is record selection or cross-filter
     let isRecordSelection = false;
     if (childScope && childScopePath) {
       if (!detail.reset) {
         // Apply: check via row cell lookup
         try {
           const idCell = detail.row.cell(childScope.idColumn as ColumnId);
           if (idCell.type !== "NULL") {
             isRecordSelection = true;
           }
         } catch {
           // Column not found → cross-filter
         }
       } else {
         // Reset: check via column schema
         isRecordSelection = (ds.columns as readonly { id: string }[]).some(
           c => c.id === childScope!.idColumn,
         );
       }
     }

     if (isRecordSelection && childScopePath && childScope) {
       if (!detail.reset) {
         // Record selection apply
         if (isDirty(editState, childScopePath)) {
           flushSave(childScopePath).catch((err: unknown) => { console.error("Pre-switch save failed:", err); });
         }
         const childFilters = filterState.get(childScopePath);
         if (childFilters) {
           for (const [, columnMap] of childFilters) columnMap.clear();
         }
         const idCell = (detail as CasehubFilterApply).row.cell(childScope.idColumn as ColumnId);
         const idValue = String(cellToRaw(idCell));
         updateFilter(filterState, childScopePath, group, childScope.idColumn, [idValue], false);
       } else {
         // Record selection reset
         updateFilter(filterState, childScopePath, group, childScope.idColumn, [], true);
       }
     } else {
       // Cross-filter path
       if (!detail.reset) {
         updateFilter(filterState, entry.pagePath, group, columnId, [(detail as CasehubFilterApply).value], false);
       } else {
         updateFilter(filterState, entry.pagePath, group, columnId, [], true);
       }
     }

     // Re-push same-page components
     for (const [id, candidate] of registry) {
       if (candidate.pagePath !== entry.pagePath) continue;
       const filterProps = (candidate.component.props as Record<string, unknown> | undefined)
         ?.filter as { listening?: boolean; selfApply?: boolean; group?: string } | undefined;

       if (filterProps?.listening === false) continue;
       if (id === componentId && !filterProps?.selfApply) continue;
       if (group !== undefined && filterProps?.group !== undefined && filterProps.group !== group) continue;

       if (candidate.vizElement && candidate.originalLookup) {
         pipeline.handleDataRequest(candidate.vizElement, candidate.originalLookup, id);
       }
     }

     // Re-push child dataScope pages
     const parentPrefix = entry.pagePath === "" ? "" : entry.pagePath + "/";
     for (const [id, candidate] of registry) {
       if (candidate.pagePath === entry.pagePath) continue;
       if (!candidate.pagePath.startsWith(parentPrefix)) continue;
       if (!hasDataScope(dataScopeRegistry, candidate.pagePath)) continue;

       if (candidate.vizElement && candidate.originalLookup) {
         pipeline.handleDataRequest(candidate.vizElement, candidate.originalLookup, id);
       }
     }

     syncUrl("replaceState");
   }), { signal: abortController.signal });
   ```

- [ ] **Step 4: Run tests**

Run: `yarn workspace @casehubio/pages-runtime run test`

- [ ] **Step 5: Run full build + typecheck**

Run: `yarn build && yarn typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/pages-runtime/src/site.ts packages/pages-runtime/src/site.test.ts
git commit -m "feat: runtime simplification — self-contained events, generalized record selection

Remove FilterDetail interface, import CasehubFilterDetail from
pages-viz. Use detail.value directly (no row extraction). Remove
isTableClick guard — any component triggers record selection if
dataset schema contains idColumn. Apply: try/catch on row.cell().
Reset: check ds.columns schema.

Refs #20"
```

---

### Task 5: Documentation Update

**Files:**
- Modify: `docs/CASEHUB-PAGES.md`

**Interfaces:**
- Consumes: All prior tasks
- Produces: Updated event protocol documentation

- [ ] **Step 1: Read the current event protocol section in CASEHUB-PAGES.md**

Find the event protocol section (referenced by the Explore agent as lines 298-337).

- [ ] **Step 2: Update the event protocol section**

Update to reflect the new discriminated union, the `value` and `row` fields on apply events, toggle behavior, and visual feedback. Remove references to `rowIndex`. Document that any component can trigger record selection if its dataset contains the DataScope's `idColumn`.

- [ ] **Step 3: Commit**

```bash
git add docs/CASEHUB-PAGES.md
git commit -m "docs: update CASEHUB-PAGES.md event protocol for unified cross-filter

Document CasehubFilterApply/Reset discriminated union, emitter-resolved
value/row, toggle semantics, visual feedback (highlight/downplay for
charts, .selected for tables), and generalized record selection.

Refs #20"
```

---

### Task 6: Full Verification

- [ ] **Step 1: Full build**

Run: `yarn build`

- [ ] **Step 2: Full test suite**

Run: `yarn test`

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`

- [ ] **Step 4: Lint**

Run: `yarn lint`

- [ ] **Step 5: Fix any issues, commit**

If any failures, fix and commit. Otherwise, the implementation is complete.
