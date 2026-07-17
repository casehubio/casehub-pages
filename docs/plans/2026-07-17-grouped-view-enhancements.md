# Grouped View Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #189 — feat: add groupBy as native pages-table property
**Issue group:** #189, #190, #191, #193

**Goal:** Add column renderers to list mode, synchronize column visibility
and selection across grouped tables, and add native groupBy to pages-table.

**Architecture:** Four sequential enhancements to the grouped-view system.
#190 adds renderer support to list mode. #191 adds a `hiddenColumns` property
to PagesTable and a column picker to PagesGroupedView's shared header. #193
adds unified cross-group selection coordination. #189 moves group extraction
to pages-data and adds native `groupBy` rendering to PagesTable.

**Tech Stack:** TypeScript, Lit (pages-table), vanilla Web Components
(pages-viz/PagesGroupedView), Vitest

## Global Constraints

- Pre-release platform — breaking changes are free
- PagesTable extends LitElement; PagesGroupedView extends PagesElement (vanilla)
- Events follow `pages-event-contract.md` — component-internal events
  (`column-change`, `selection-change`) are separate CustomEvents, not
  `pages-event` topics
- All code navigation and editing via IntelliJ MCP (`mcp__intellij-index__*`)
- Tests in Vitest with happy-dom environment

---

### Task 1: Column Renderers for List Mode (#190)

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/render-content-list.ts`
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts:225-230` (list mode call site)
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `ColumnRenderer` type from `@casehubio/pages-component` — `(cell: CellValue, row: TypedRow, column: Column) => unknown`
- Produces: `renderContentList()` with optional `renderers` parameter (5th arg)

- [ ] **Step 1: Write failing test — renderer returns string**

In `PagesGroupedView.test.ts`, add a new describe block:

```typescript
describe("list mode column renderers", () => {
  it("applies column renderer returning string in list mode", async () => {
    const renderers = new Map([
      ["name" as ColumnId, ((cell: any) => `[${String(cell.value)}]`) as unknown as ColumnRenderer],
    ]);
    element.props = makeProps({ preset: "list" });
    element.dataSet = makeGroupedDataset();
    (element as any).setColumnRenderers(renderers);
    await new Promise((r) => setTimeout(r, 0));
    const dds = element.shadowRoot!.querySelectorAll("dd");
    const nameValues = Array.from(dds).filter((_, i) => i % 2 === 0).map((dd) => dd.textContent);
    expect(nameValues[0]).toBe("[Server outage]");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose -t "applies column renderer returning string"`
Expected: FAIL — renderers not passed to `renderContentList`, dd shows plain text

- [ ] **Step 3: Write failing test — renderer returns HTMLElement**

```typescript
  it("applies column renderer returning HTMLElement in list mode", async () => {
    const renderers = new Map([
      ["name" as ColumnId, ((cell: any) => {
        const span = document.createElement("span");
        span.className = "custom-render";
        span.textContent = String(cell.value);
        return span;
      }) as unknown as ColumnRenderer],
    ]);
    element.props = makeProps({ preset: "list" });
    element.dataSet = makeGroupedDataset();
    (element as any).setColumnRenderers(renderers);
    await new Promise((r) => setTimeout(r, 0));
    const customSpans = element.shadowRoot!.querySelectorAll(".custom-render");
    expect(customSpans.length).toBeGreaterThan(0);
    expect(customSpans[0]!.textContent).toBe("Server outage");
  });
```

- [ ] **Step 4: Write failing test — no renderer falls back to plain text**

```typescript
  it("falls back to plain text when no renderer for column", async () => {
    const renderers = new Map([
      ["nonexistent" as ColumnId, (() => "nope") as unknown as ColumnRenderer],
    ]);
    element.props = makeProps({ preset: "list" });
    element.dataSet = makeGroupedDataset();
    (element as any).setColumnRenderers(renderers);
    await new Promise((r) => setTimeout(r, 0));
    const dds = element.shadowRoot!.querySelectorAll("dd");
    expect(dds[0]!.textContent).toBe("Server outage");
    expect(dds[0]!.children.length).toBe(0);
  });
});
```

- [ ] **Step 5: Implement renderContentList renderer support**

In `render-content-list.ts`, add the imports and modify the function:

```typescript
import type { TypedDataSet, ColumnId, CellValue, Column } from "@casehubio/pages-data";
import type { ColumnRenderer } from "@casehubio/pages-component";
import type { GroupBoundary } from "./group-extraction.js";

function cellToDisplay(cell: CellValue): string {
  if (cell.type === "NULL") return "";
  return String(cell.value);
}

export function renderContentList(
  dataset: TypedDataSet,
  boundary: GroupBoundary,
  contentColumns: readonly ColumnId[],
  colWidthsCss: string,
  renderers?: ReadonlyMap<ColumnId, ColumnRenderer>,
): HTMLElement {
  const dl = document.createElement("dl");
  dl.className = "aligned-list";
  dl.style.gridTemplateColumns = colWidthsCss;

  for (let r = boundary.startRow; r < boundary.startRow + boundary.rowCount; r++) {
    const row = dataset.rows[r]!;
    const item = document.createElement("div");
    item.className = "list-item";

    for (const id of contentColumns) {
      const col = dataset.columns.find((c) => c.id === id);
      const dt = document.createElement("dt");
      dt.className = "visually-hidden";
      dt.textContent = col?.name ?? String(id);
      const dd = document.createElement("dd");

      const renderer = renderers?.get(id);
      if (renderer && col) {
        const cell = row.cell(id);
        const result = renderer(cell, row, col);
        if (result instanceof HTMLElement) {
          dd.appendChild(result);
        } else {
          dd.textContent = String(result);
        }
      } else {
        dd.textContent = cellToDisplay(row.cell(id));
      }

      item.append(dt, dd);
    }
    dl.appendChild(item);
  }

  return dl;
}
```

- [ ] **Step 6: Pass renderers from PagesGroupedView**

In `PagesGroupedView.ts`, in the `render()` method, find the list mode branch
(the block `if (isListMode)` inside the boundary loop, around line 225).
Change the `renderContentList` call to pass `this._columnRenderers`:

```typescript
const listEl = renderContentList(dataset, b, contentColumnIds, colWidthsCss, this._columnRenderers);
```

- [ ] **Step 7: Run all tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose`
Expected: All tests PASS including the three new list mode renderer tests

- [ ] **Step 8: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add packages/pages-viz/src/components/grouped-view/render-content-list.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts
git commit -m "feat: column renderers for grouped-view list mode (#190)

renderContentList accepts optional renderers map. Renderer return values
are checked: HTMLElement → appendChild, otherwise textContent.
PagesGroupedView forwards _columnRenderers to list mode rendering.

Refs #190"
```

---

### Task 2: hiddenColumns Property on PagesTable (#191 — part 1)

**Files:**
- Modify: `packages/pages-table/src/pages-table.ts` (add property + willUpdate sync)
- Modify: `packages/pages-table/src/types.ts` (export ColumnChangeDetail — already exported)
- Test: `packages/pages-table/src/pages-table.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `hiddenColumns?: readonly string[]` property on PagesTable. When set externally, syncs to `_hiddenColumnIds`. Emits `column-change` event (existing).

- [ ] **Step 1: Write failing test — hiddenColumns hides columns**

In `pages-table.test.ts`, add tests:

```typescript
describe("hiddenColumns external control", () => {
  it("hides columns when hiddenColumns is set", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeDataSet();
    el.hiddenColumns = ["status"];
    await el.updateComplete;
    const headers = el.shadowRoot!.querySelectorAll(".header-cell");
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim());
    expect(headerTexts).not.toContain("Status");
    el.remove();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/pages-data-table run test -- --run --reporter=verbose -t "hides columns when hiddenColumns is set"`
Expected: FAIL — `hiddenColumns` property does not exist

- [ ] **Step 3: Write failing test — hiddenColumns syncs with column-change event**

```typescript
  it("emits column-change reflecting hiddenColumns", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeDataSet();
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener("column-change", (e: Event) => events.push(e as CustomEvent));
    el.hiddenColumns = ["status"];
    await el.updateComplete;
    // hiddenColumns is external control — no event emitted (same as selectedKeys)
    // The column should just be hidden in rendering
    const headers = el.shadowRoot!.querySelectorAll(".header-cell");
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim());
    expect(headerTexts).not.toContain("Status");
    el.remove();
  });

  it("shows column again when removed from hiddenColumns", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeDataSet();
    el.hiddenColumns = ["status"];
    await el.updateComplete;
    el.hiddenColumns = [];
    await el.updateComplete;
    const headers = el.shadowRoot!.querySelectorAll(".header-cell");
    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim());
    expect(headerTexts).toContain("Status");
    el.remove();
  });
});
```

- [ ] **Step 4: Implement hiddenColumns property**

In `pages-table.ts`, add the property declaration near the other `@property` declarations (around line 44):

```typescript
@property({ type: Array, attribute: false }) hiddenColumns?: readonly string[];
```

In `willUpdate`, add the sync (after the `selectedKeys` sync block, around line 1137):

```typescript
if (changed.has('hiddenColumns') && this.hiddenColumns !== undefined) {
  this._hiddenColumnIds = new Set(this.hiddenColumns);
}
```

- [ ] **Step 5: Update MockTable interface in PagesGroupedView.test.ts**

Add `hiddenColumns` to both `MockTable` interface and `MockPagesTable` class:

```typescript
// In interface MockTable:
hiddenColumns: any;

// In class MockPagesTable:
hiddenColumns: any;
```

- [ ] **Step 6: Run all pages-table tests**

Run: `yarn workspace @casehubio/pages-data-table run test -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add packages/pages-table/src/pages-table.ts packages/pages-table/src/pages-table.test.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts
git commit -m "feat: add hiddenColumns property to PagesTable (#191)

External control for column visibility — mirrors the selectedKeys
pattern. When set, syncs to internal _hiddenColumnIds in willUpdate.

Refs #191"
```

---

### Task 3: Column Picker in PagesGroupedView Header (#191 — part 2)

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`
- Modify: `packages/pages-viz/src/components/grouped-view/group-view-styles.ts` (picker CSS)
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `hiddenColumns` property on PagesTable (from Task 2)
- Produces: Column picker in shared header bar. `column-change` event from PagesGroupedView. Hidden columns applied to list mode via `contentColumnIds` filtering.

- [ ] **Step 1: Write failing test — picker renders in header bar**

```typescript
describe("column visibility", () => {
  it("renders column picker button in header bar", async () => {
    element.props = makeProps({ preset: "sectioned" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));
    const picker = element.shadowRoot!.querySelector(".column-picker-trigger");
    expect(picker).not.toBeNull();
  });
```

- [ ] **Step 2: Write failing test — toggling column hides it from all tables**

```typescript
  it("toggling column visibility hides column from all tables", async () => {
    element.props = makeProps({ preset: "sectioned" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    // Click picker to open
    const trigger = element.shadowRoot!.querySelector(".column-picker-trigger") as HTMLButtonElement;
    trigger.click();
    await new Promise((r) => setTimeout(r, 0));

    // Toggle the first column
    const checkboxes = element.shadowRoot!.querySelectorAll(".column-picker-item input[type='checkbox']");
    expect(checkboxes.length).toBeGreaterThan(0);
    (checkboxes[0] as HTMLInputElement).click();
    await new Promise((r) => setTimeout(r, 0));

    const tables = element.shadowRoot!.querySelectorAll("pages-table");
    for (const table of tables) {
      const t = table as MockTable;
      expect(t.hiddenColumns).toBeDefined();
      expect(t.hiddenColumns.length).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 3: Write failing test — column-change event emitted**

```typescript
  it("emits column-change event from grouped view", async () => {
    element.props = makeProps({ preset: "sectioned" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    const events: CustomEvent[] = [];
    element.addEventListener("column-change", (e: Event) => events.push(e as CustomEvent));

    const trigger = element.shadowRoot!.querySelector(".column-picker-trigger") as HTMLButtonElement;
    trigger.click();
    await new Promise((r) => setTimeout(r, 0));

    const checkboxes = element.shadowRoot!.querySelectorAll(".column-picker-item input[type='checkbox']");
    (checkboxes[0] as HTMLInputElement).click();
    await new Promise((r) => setTimeout(r, 0));

    expect(events.length).toBe(1);
    expect(events[0]!.detail.visibleColumns).toBeDefined();
  });
```

- [ ] **Step 4: Write failing test — hidden columns excluded from list mode**

```typescript
  it("hidden columns excluded from list mode rendering", async () => {
    element.props = makeProps({ preset: "list" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    // Verify both columns render initially
    const headerLabels = element.shadowRoot!.querySelectorAll(".column-header-bar .col-label");
    expect(headerLabels.length).toBe(2);

    // Programmatically hide first content column
    (element as any)._hiddenColumnIds = new Set(["name"]);
    // Trigger re-render
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    const updatedLabels = element.shadowRoot!.querySelectorAll(".column-header-bar .col-label");
    const labelTexts = Array.from(updatedLabels).map((l) => l.textContent?.trim());
    expect(labelTexts).not.toContain("Name");
  });

  it("prevents hiding the last visible column", async () => {
    element.props = makeProps({ preset: "sectioned" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    // Hide all but one column, then try to hide the last
    (element as any)._hiddenColumnIds = new Set(["date"]);
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    const trigger = element.shadowRoot!.querySelector(".column-picker-trigger") as HTMLButtonElement;
    trigger.click();
    await new Promise((r) => setTimeout(r, 0));

    const checkboxes = element.shadowRoot!.querySelectorAll(".column-picker-item input[type='checkbox']");
    const enabledUnchecked = Array.from(checkboxes).filter(
      (cb) => !(cb as HTMLInputElement).disabled && (cb as HTMLInputElement).checked
    );
    // Only one column visible — its checkbox should be disabled
    const disabledChecked = Array.from(checkboxes).filter(
      (cb) => (cb as HTMLInputElement).disabled && (cb as HTMLInputElement).checked
    );
    expect(disabledChecked.length).toBe(1);
  });
});
```

- [ ] **Step 5: Implement column picker in PagesGroupedView**

Add `_hiddenColumnIds` field and `_pickerOpen` state to PagesGroupedView:

```typescript
private _hiddenColumnIds = new Set<string>();
private _pickerOpen = false;
```

Add `_toggleColumnVisibility` method:

```typescript
private _toggleColumnVisibility(columnId: string, contentColumnIds: readonly ColumnId[]): void {
  const visibleCount = contentColumnIds.filter((id) => !this._hiddenColumnIds.has(String(id))).length;
  const isHidden = this._hiddenColumnIds.has(columnId);

  if (!isHidden && visibleCount <= 1) return;

  const newHidden = new Set(this._hiddenColumnIds);
  if (isHidden) {
    newHidden.delete(columnId);
  } else {
    newHidden.add(columnId);
  }
  this._hiddenColumnIds = newHidden;

  const hiddenArray = Array.from(newHidden);
  for (const table of this._groupTables.values()) {
    (table as unknown as Record<string, unknown>).hiddenColumns = hiddenArray;
  }

  const visibleColumns = contentColumnIds
    .filter((id) => !newHidden.has(String(id)))
    .map(String);

  this.dispatchEvent(new CustomEvent("column-change", {
    detail: { visibleColumns },
    bubbles: true,
    composed: true,
  }));
}
```

Modify `_buildHeaderBar` to append a column picker dropdown (after the
column headers, similar structure to PagesTable's picker but vanilla DOM):

```typescript
// At the end of _buildHeaderBar, before returning bar:
const pickerWrapper = document.createElement("div");
pickerWrapper.className = "column-picker-wrapper";

const trigger = document.createElement("button");
trigger.className = "column-picker-trigger";
trigger.setAttribute("aria-label", "Column options");
trigger.textContent = "⋮";
trigger.addEventListener("click", () => {
  this._pickerOpen = !this._pickerOpen;
  dropdown.hidden = !this._pickerOpen;
});

const dropdown = document.createElement("div");
dropdown.className = "column-picker-dropdown";
dropdown.hidden = true;

const label = document.createElement("div");
label.className = "picker-section-label";
label.textContent = "Columns";
dropdown.appendChild(label);

for (const id of contentColumnIds) {
  const col = dataset.columns.find((c) => c.id === id);
  const isHidden = this._hiddenColumnIds.has(String(id));
  const visibleCount = contentColumnIds.filter((cid) => !this._hiddenColumnIds.has(String(cid))).length;
  const isLastVisible = !isHidden && visibleCount === 1;

  const item = document.createElement("label");
  item.className = "column-picker-item";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !isHidden;
  cb.disabled = isLastVisible;
  cb.addEventListener("change", () => this._toggleColumnVisibility(String(id), contentColumnIds));
  const span = document.createElement("span");
  span.textContent = col?.name ?? String(id);
  item.append(cb, span);
  dropdown.appendChild(item);
}

pickerWrapper.append(trigger, dropdown);
bar.appendChild(pickerWrapper);
```

- [ ] **Step 6: Filter hidden columns from contentColumnIds**

In the `render()` method, after computing `contentColumnIds`, filter out hidden ones:

```typescript
const visibleContentColumnIds = contentColumnIds.filter(
  (id) => !this._hiddenColumnIds.has(String(id))
);
```

Use `visibleContentColumnIds` instead of `contentColumnIds` when:
- Building `columnConfig` (pass to `_buildColumnConfig`)
- Building the header bar column headers
- Building list mode header bar and calling `renderContentList`

Keep `contentColumnIds` (unfiltered) for the column picker dropdown
(so hidden columns appear as unchecked items).

- [ ] **Step 7: Forward hiddenColumns to tables**

In `_forwardPropsToTable`, add:

```typescript
(table as unknown as Record<string, unknown>).hiddenColumns = Array.from(this._hiddenColumnIds);
```

- [ ] **Step 8: Add picker CSS to group-view-styles.ts**

Add column picker styles to `GROUPED_VIEW_CSS` in `group-view-styles.ts`:

```css
.column-picker-wrapper {
  position: relative;
  margin-left: auto;
}
.column-picker-trigger {
  background: none;
  border: 1px solid var(--pages-neutral-6, #9e9e9e);
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  line-height: 1;
}
.column-picker-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  background: var(--pages-neutral-1, #fff);
  border: 1px solid var(--pages-neutral-6, #9e9e9e);
  border-radius: 4px;
  padding: 8px;
  z-index: 10;
  min-width: 160px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.picker-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--pages-neutral-9, #616161);
  margin-bottom: 4px;
}
.column-picker-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  cursor: pointer;
  font-size: 13px;
}
.column-picker-item input[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 9: Run all tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 10: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 11: Commit**

```bash
git add packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts packages/pages-viz/src/components/grouped-view/group-view-styles.ts
git commit -m "feat: synchronized column visibility across grouped-view tables (#191)

Column picker in shared header bar toggles visibility across all
per-group tables via hiddenColumns property. Hidden columns also
filtered from list mode and header bar. Emits unified column-change.

Closes #191"
```

---

### Task 4: Cross-Group Unified Selection (#193)

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `selectedKeys` property on PagesTable (already exists), `selection-change` event from PagesTable (existing)
- Produces: Unified `_selectedKeys` on PagesGroupedView, select-all checkbox in header bar, unified `selection-change` event from PagesGroupedView

- [ ] **Step 1: Write failing test — selection-change from child propagates**

```typescript
describe("cross-group unified selection", () => {
  it("selection in one group is reflected across all tables", async () => {
    const getRowKey = (row: any) => String(row.cell("name" as ColumnId).value);
    element.props = makeProps({ preset: "sectioned", selection: "multi" });
    element.dataSet = makeGroupedDataset();
    (element as any).setGetRowKey(getRowKey);
    await new Promise((r) => setTimeout(r, 0));

    const tables = element.shadowRoot!.querySelectorAll("pages-table") as NodeListOf<MockTable>;
    expect(tables.length).toBe(2);

    // Simulate selection-change from first table
    tables[0]!.dispatchEvent(new CustomEvent("selection-change", {
      detail: { selectedKeys: ["Server outage"], selectedRows: [] },
      bubbles: true,
      composed: true,
    }));
    await new Promise((r) => setTimeout(r, 0));

    // All tables should reflect the unified selection
    for (const table of tables) {
      expect((table as MockTable).selectedKeys).toBeDefined();
    }
  });
```

- [ ] **Step 2: Write failing test — unified selection-change event emitted**

```typescript
  it("emits unified selection-change from grouped view", async () => {
    const getRowKey = (row: any) => String(row.cell("name" as ColumnId).value);
    element.props = makeProps({ preset: "sectioned", selection: "multi" });
    element.dataSet = makeGroupedDataset();
    (element as any).setGetRowKey(getRowKey);
    await new Promise((r) => setTimeout(r, 0));

    const events: CustomEvent[] = [];
    element.addEventListener("selection-change", (e: Event) => events.push(e as CustomEvent));

    const tables = element.shadowRoot!.querySelectorAll("pages-table");
    tables[0]!.dispatchEvent(new CustomEvent("selection-change", {
      detail: { selectedKeys: ["Server outage"], selectedRows: [] },
      bubbles: true,
      composed: true,
    }));
    await new Promise((r) => setTimeout(r, 0));

    expect(events.length).toBe(1);
    expect(events[0]!.detail.selectedKeys).toContain("Server outage");
  });
```

- [ ] **Step 3: Write failing test — select-all checkbox in header**

```typescript
  it("renders select-all checkbox in header when selection=multi", async () => {
    const getRowKey = (row: any) => String(row.cell("name" as ColumnId).value);
    element.props = makeProps({ preset: "sectioned", selection: "multi" });
    element.dataSet = makeGroupedDataset();
    (element as any).setGetRowKey(getRowKey);
    await new Promise((r) => setTimeout(r, 0));

    const selectAll = element.shadowRoot!.querySelector(".select-all-checkbox");
    expect(selectAll).not.toBeNull();
  });
```

- [ ] **Step 4: Write failing test — select-all toggles all rows across groups**

```typescript
  it("select-all toggles all rows across all groups", async () => {
    const getRowKey = (row: any) => String(row.cell("name" as ColumnId).value);
    element.props = makeProps({ preset: "sectioned", selection: "multi" });
    element.dataSet = makeGroupedDataset();
    (element as any).setGetRowKey(getRowKey);
    await new Promise((r) => setTimeout(r, 0));

    const events: CustomEvent[] = [];
    element.addEventListener("selection-change", (e: Event) => events.push(e as CustomEvent));

    const selectAll = element.shadowRoot!.querySelector(".select-all-checkbox") as HTMLInputElement;
    selectAll.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(events.length).toBe(1);
    // 3 rows in dataset: Server outage, Data loss, Slow query
    expect(events[0]!.detail.selectedKeys.length).toBe(3);
  });

  it("no select-all when selection is not multi", async () => {
    element.props = makeProps({ preset: "sectioned", selection: "single" });
    element.dataSet = makeGroupedDataset();
    await new Promise((r) => setTimeout(r, 0));

    const selectAll = element.shadowRoot!.querySelector(".select-all-checkbox");
    expect(selectAll).toBeNull();
  });
});
```

- [ ] **Step 5: Implement unified selection state**

Add fields to PagesGroupedView:

```typescript
private _selectedKeys = new Set<string>();
private _selectionListeners = new Map<PagesTableHost, (e: Event) => void>();
```

Add `_handleChildSelectionChange` method:

```typescript
private _handleChildSelectionChange(e: CustomEvent): void {
  e.stopPropagation();
  const childKeys: readonly string[] = e.detail.selectedKeys ?? [];

  // Replace this table's contribution with the new keys
  // We need to know which keys belong to which table
  // Strategy: maintain unified set, merge incoming
  const newSelected = new Set(this._selectedKeys);

  // Determine which keys belong to the emitting table
  const table = e.target as PagesTableHost;
  const tableRows = table.dataSet?.rows ?? [];
  const getRowKey = this._getRowKey;
  if (!getRowKey) return;

  const tableKeys = new Set(tableRows.map((row) => getRowKey(row)));
  // Remove all keys from this table, then add back the selected ones
  for (const key of tableKeys) {
    newSelected.delete(key);
  }
  for (const key of childKeys) {
    newSelected.add(key);
  }

  this._selectedKeys = newSelected;
  const selectedArray = Array.from(newSelected);

  // Propagate to all tables
  for (const t of this._groupTables.values()) {
    (t as unknown as Record<string, unknown>).selectedKeys = selectedArray;
  }

  // Emit unified event
  this.dispatchEvent(new CustomEvent("selection-change", {
    detail: { selectedKeys: selectedArray, selectedRows: [] },
    bubbles: true,
    composed: true,
  }));

  // Update select-all checkbox state
  this._updateSelectAllCheckbox();
}
```

- [ ] **Step 6: Wire selection listener on table creation**

In `_createGroupTable` and `_createGroupTableFromNode`, after creating the table
and before returning, if selection is enabled:

```typescript
if (props.selection && props.selection !== "none") {
  const listener = (e: Event) => this._handleChildSelectionChange(e as CustomEvent);
  table.addEventListener("selection-change", listener);
  this._selectionListeners.set(table, listener);
}
```

Also in `_forwardPropsToTable`, propagate selectedKeys:

```typescript
if (this._selectedKeys.size > 0) {
  (table as unknown as Record<string, unknown>).selectedKeys = Array.from(this._selectedKeys);
}
```

- [ ] **Step 7: Add select-all checkbox to header bar**

In `_buildHeaderBar`, when `props.selection === 'multi'`, prepend a select-all
checkbox in the 40px prefix column:

```typescript
if (props.selection === "multi") {
  const selectAllWrapper = document.createElement("div");
  selectAllWrapper.className = "select-all-wrapper";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "select-all-checkbox";
  cb.setAttribute("aria-label", "Select all rows");
  cb.addEventListener("click", () => this._handleSelectAll(dataset));
  selectAllWrapper.appendChild(cb);
  bar.insertBefore(selectAllWrapper, bar.firstChild);
}
```

Add `_handleSelectAll` method:

```typescript
private _handleSelectAll(dataset: TypedDataSet): void {
  const getRowKey = this._getRowKey;
  if (!getRowKey) return;

  const allKeys = dataset.rows.map((row) => getRowKey(row));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => this._selectedKeys.has(k));

  if (allSelected) {
    this._selectedKeys = new Set();
  } else {
    this._selectedKeys = new Set(allKeys);
  }

  const selectedArray = Array.from(this._selectedKeys);
  for (const t of this._groupTables.values()) {
    (t as unknown as Record<string, unknown>).selectedKeys = selectedArray;
  }

  this.dispatchEvent(new CustomEvent("selection-change", {
    detail: { selectedKeys: selectedArray, selectedRows: [] },
    bubbles: true,
    composed: true,
  }));

  this._updateSelectAllCheckbox();
}

private _updateSelectAllCheckbox(): void {
  const cb = this.shadowRoot.querySelector(".select-all-checkbox") as HTMLInputElement | null;
  if (!cb) return;
  const totalRows = Array.from(this._groupTables.values())
    .reduce((sum, t) => sum + (t.dataSet?.rows.length ?? 0), 0);
  cb.checked = this._selectedKeys.size > 0 && this._selectedKeys.size >= totalRows;
  cb.indeterminate = this._selectedKeys.size > 0 && this._selectedKeys.size < totalRows;
}
```

- [ ] **Step 8: Clean up selection listeners on re-render**

At the top of the `render()` method, before clearing `_groupTables`:

```typescript
for (const [table, listener] of this._selectionListeners) {
  table.removeEventListener("selection-change", listener);
}
this._selectionListeners.clear();
```

- [ ] **Step 9: Run all tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 10: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 11: Commit**

```bash
git add packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts
git commit -m "feat: cross-group unified selection in pages-grouped-view (#193)

PagesGroupedView intercepts selection-change events from child tables,
maintains a unified selectedKeys set, and propagates via the existing
selectedKeys property. Select-all checkbox in the shared header bar
toggles all rows across all groups.

Closes #193"
```

---

### Task 5: Move Group Extraction to pages-data (#189 — part 1)

**Files:**
- Create: `packages/pages-data/src/group-extraction.ts`
- Create: `packages/pages-data/src/group-extraction.test.ts`
- Modify: `packages/pages-data/src/index.ts` (export new module)
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` (update imports)
- Modify: `packages/pages-viz/src/components/grouped-view/group-extraction.ts` (re-export from pages-data)
- Test: `packages/pages-data/src/group-extraction.test.ts`

**Interfaces:**
- Consumes: `TypedDataSet`, `ColumnId`, `CellValue`, `GroupingKey` from `@casehubio/pages-data`; `GroupNode` from `@casehubio/pages-component`
- Produces: `extractGroupBoundaries()`, `extractGroupTree()`, `GroupBoundary` type — all exported from `@casehubio/pages-data`

- [ ] **Step 1: Create group-extraction.ts in pages-data**

Copy the functions and types from `packages/pages-viz/src/components/grouped-view/group-extraction.ts`
to `packages/pages-data/src/group-extraction.ts`. The file is identical — pure data operations
with no DOM dependency. Imports stay the same except `GroupNode` comes from `@casehubio/pages-component`.

```typescript
import type { TypedDataSet, ColumnId, CellValue, GroupingKey } from "./dataset/types.js";
import type { GroupNode } from "@casehubio/pages-component";

export interface GroupBoundary {
  readonly name: string;
  readonly startRow: number;
  readonly rowCount: number;
  readonly aggregates: ReadonlyMap<ColumnId, unknown>;
}

// ... rest of file identical to current group-extraction.ts
// (extractGroupBoundaries, extractGroupTree, buildLevel, computeAggregates, cellToString)
```

- [ ] **Step 2: Copy tests to pages-data**

Copy `packages/pages-viz/src/components/grouped-view/group-extraction.test.ts`
to `packages/pages-data/src/group-extraction.test.ts`. Update the import:

```typescript
import { extractGroupBoundaries, extractGroupTree } from "./group-extraction.js";
```

- [ ] **Step 3: Export from pages-data index**

Add to `packages/pages-data/src/index.ts`:

```typescript
export type { GroupBoundary } from "./group-extraction.js";
export { extractGroupBoundaries, extractGroupTree } from "./group-extraction.js";
```

- [ ] **Step 4: Run pages-data tests**

Run: `yarn workspace @casehubio/pages-data run test -- --run --reporter=verbose`
Expected: All tests PASS (including moved group-extraction tests)

- [ ] **Step 5: Update pages-viz imports to use pages-data**

In `packages/pages-viz/src/components/grouped-view/group-extraction.ts`, replace
the entire file with re-exports:

```typescript
export type { GroupBoundary } from "@casehubio/pages-data";
export { extractGroupBoundaries, extractGroupTree } from "@casehubio/pages-data";
```

This preserves backward compatibility — any file importing from
`./group-extraction.js` still works. No other files need import changes.

- [ ] **Step 6: Run all pages-viz tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose`
Expected: All tests PASS (imports resolve through re-exports)

- [ ] **Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add packages/pages-data/src/group-extraction.ts packages/pages-data/src/group-extraction.test.ts packages/pages-data/src/index.ts packages/pages-viz/src/components/grouped-view/group-extraction.ts
git commit -m "refactor: move group extraction to pages-data (#189)

extractGroupBoundaries, extractGroupTree, and GroupBoundary are pure
data operations with no DOM dependency. Moving them to pages-data
lets pages-table import them directly without depending on pages-viz.
pages-viz re-exports for backward compatibility.

Refs #189"
```

---

### Task 6: Native groupBy on PagesTable (#189 — part 2)

**Files:**
- Modify: `packages/pages-table/src/pages-table.ts` (add groupBy property, group rendering)
- Test: `packages/pages-table/src/pages-table.test.ts`

**Interfaces:**
- Consumes: `extractGroupBoundaries` and `GroupBoundary` from `@casehubio/pages-data` (from Task 5)
- Produces: `groupBy?: ColumnId` property on PagesTable. When set, renders group header rows interleaved with data rows.

- [ ] **Step 1: Write failing test — groupBy renders group headers**

```typescript
describe("groupBy", () => {
  function makeGroupedDataSet() {
    return toTypedDataSet({
      columns: [
        { id: "status" as ColumnId, name: "Status", type: ColumnType.LABEL },
        { id: "name" as ColumnId, name: "Name", type: ColumnType.LABEL },
        { id: "value" as ColumnId, name: "Value", type: ColumnType.NUMBER },
      ],
      data: [
        ["Critical", "Outage", "100"],
        ["Critical", "Data loss", "90"],
        ["Warning", "Slow query", "30"],
      ],
    });
  }

  it("renders group header rows when groupBy is set", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeGroupedDataSet();
    el.groupBy = "status" as ColumnId;
    await el.updateComplete;
    const groupHeaders = el.shadowRoot!.querySelectorAll(".group-header");
    expect(groupHeaders.length).toBe(2);
    expect(groupHeaders[0]!.textContent).toContain("Critical");
    expect(groupHeaders[0]!.textContent).toContain("2");
    expect(groupHeaders[1]!.textContent).toContain("Warning");
    expect(groupHeaders[1]!.textContent).toContain("1");
    el.remove();
  });
```

- [ ] **Step 2: Write failing test — data rows render within groups**

```typescript
  it("renders data rows after each group header", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeGroupedDataSet();
    el.groupBy = "status" as ColumnId;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll(".row:not(.group-header)");
    expect(rows.length).toBe(3);
    el.remove();
  });
```

- [ ] **Step 3: Write failing test — groupBy disables virtual scroll**

```typescript
  it("disables virtual scroll when groupBy is set", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeGroupedDataSet();
    el.groupBy = "status" as ColumnId;
    el.mode = "scroll";
    await el.updateComplete;
    const bodyContent = el.shadowRoot!.querySelector(".body-content");
    // No virtual scroll means no translateY transform
    expect(bodyContent?.querySelector("[style*='translateY']")).toBeNull();
    el.remove();
  });
```

- [ ] **Step 4: Write failing test — groupBy incompatible with getChildren**

```typescript
  it("throws when groupBy and getChildren are both set", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeGroupedDataSet();
    el.groupBy = "status" as ColumnId;
    el.getChildren = () => [];
    el.getRowKey = (row) => String(row.cell("name" as ColumnId).value);
    expect(() => el.requestUpdate()).not.toThrow();
    // The throw happens in willUpdate
    try {
      await el.updateComplete;
    } catch (e: any) {
      expect(e.message).toContain("groupBy");
    }
    el.remove();
  });
```

- [ ] **Step 5: Write failing test — no group headers without groupBy**

```typescript
  it("no group headers when groupBy is not set", async () => {
    const el = document.createElement("pages-table") as TableEl;
    document.body.appendChild(el);
    el.dataSet = makeGroupedDataSet();
    await el.updateComplete;
    const groupHeaders = el.shadowRoot!.querySelectorAll(".group-header");
    expect(groupHeaders.length).toBe(0);
    el.remove();
  });
});
```

- [ ] **Step 6: Add groupBy property and boundary computation**

In `pages-table.ts`, add the import and property:

```typescript
import { extractGroupBoundaries, type GroupBoundary } from "@casehubio/pages-data";
```

Property declaration (near other `@property` declarations):

```typescript
@property({ attribute: false }) groupBy?: ColumnId;
```

Private state for cached boundaries:

```typescript
@state() private _groupBoundaries: readonly GroupBoundary[] = [];
```

In `willUpdate`, add boundary computation and validation:

```typescript
if (this.groupBy && this.getChildren) {
  throw new Error("groupBy and getChildren are mutually exclusive — use PagesGroupedView for grouped trees");
}

if (changed.has('dataSet') || changed.has('groupBy')) {
  if (this.groupBy && this.dataSet) {
    this._groupBoundaries = extractGroupBoundaries(this.dataSet, this.groupBy, []);
  } else {
    this._groupBoundaries = [];
  }
}
```

- [ ] **Step 7: Override _useVirtualScroll and _usePagination**

Modify the getters to disable when groupBy is set:

```typescript
private get _useVirtualScroll(): boolean {
  if (this.groupBy) return false;
  if (this.getRowDetail) return false;
  if (this.mode === 'scroll') return true;
  return this.mode === 'auto' && this._dataRows.length > AUTO_THRESHOLD;
}

private get _usePagination(): boolean {
  if (this.groupBy) return false;
  return this.mode === 'paginated';
}
```

- [ ] **Step 8: Implement grouped rendering in render()**

In the `render()` method, replace the body content rendering when groupBy is set.
Find the body section (the `<div class="body">` block). Add a conditional branch:

```typescript
${this.groupBy && this._groupBoundaries.length > 0
  ? html`
      <div class="body-content">
        ${this._groupBoundaries.map((boundary, gi) => {
          const rows = this._dataRows.slice(boundary.startRow, boundary.startRow + boundary.rowCount);
          const baseIndex = boundary.startRow;
          return html`
            <div class="group-header" role="row" aria-rowindex="${baseIndex + 2}">
              <div class="group-header-content" style="grid-column: 1 / -1">
                <span class="group-header-name">${boundary.name}</span>
                <span class="group-header-count">${boundary.rowCount}</span>
              </div>
            </div>
            ${rows.map((row, idx) => this._renderRow(row, baseIndex + idx, baseIndex + idx))}
          `;
        })}
      </div>
    `
  : /* existing body content rendering */
}
```

- [ ] **Step 9: Add group header styles**

In the `static styles` block, add:

```css
.group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--pages-neutral-3, #f5f5f5);
  border-bottom: 1px solid var(--pages-neutral-5, #e0e0e0);
  font-weight: 600;
  font-size: 13px;
  gap: 8px;
}
.group-header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-header-count {
  font-weight: 400;
  color: var(--pages-neutral-9, #616161);
  font-size: 12px;
}
.group-header-count::before {
  content: "(";
}
.group-header-count::after {
  content: ")";
}
```

- [ ] **Step 10: Run all pages-table tests**

Run: `yarn workspace @casehubio/pages-data-table run test -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 11: Run all tests across packages**

Run: `yarn workspace @casehubio/pages-viz run test -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 12: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

- [ ] **Step 13: Commit**

```bash
git add packages/pages-table/src/pages-table.ts packages/pages-table/src/pages-table.test.ts
git commit -m "feat: add groupBy as native pages-table property (#189)

When groupBy is set, PagesTable renders group header rows interleaved
with data rows. Single ARIA grid, continuous keyboard navigation,
unified selection. Virtual scroll and pagination disabled with groupBy.
groupBy and getChildren are mutually exclusive.

Closes #189"
```
