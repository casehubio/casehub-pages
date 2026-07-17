# Table Composability Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #196 — feat: table composability enhancements
**Issue group:** #196

**Goal:** Fix foundational YAML-to-component pipeline bugs and add composability features (rowAccent, legend, interstitial hooks, recursive grouping) to pages-table and pages-grouped-view.

**Architecture:** Four foundation fixes in the desugar/pipeline layer, then four additive features in the component layer. Each task is independently testable. Build order follows the dependency graph: `pages-data` → `pages-component` → `pages-ui` → `pages-table` / `pages-viz` → `pages-runtime` → `examples`.

**Tech Stack:** TypeScript 5, Vitest, Lit (pages-table), vanilla Web Components (pages-viz), YAML parser (pages-ui)

## Global Constraints

- All CSS custom properties use `--pages-` prefix (protocol: css-design-tokens)
- Web Components use `pages-` prefix for tag names (protocol: web-component-strategy)
- Lit for interactive UI, vanilla `PagesElement`/`PagesContentElement` for display-only (protocol: web-component-strategy)
- Inter-component events use `pages-event` CustomEvent with topic/payload (protocol: pages-event-contract)
- All new interfaces use `readonly` fields
- All ColumnId values use the branded `ColumnId` type, never plain `string`
- Run tests per-package: `yarn workspace @casehubio/<pkg> run test`

---

### Task 1: Desugar passthrough ordering fix

**Files:**
- Modify: `packages/pages-ui/src/parser/displayer-desugar.ts`
- Test: `packages/pages-ui/src/parser/displayer-desugar.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `desugarDisplayer` now applies user-specified `pageSize`/`filter` over defaults

- [ ] **Step 1: Write failing test — user pageSize wins over default**

Add to `packages/pages-ui/src/parser/displayer-desugar.test.ts`:

```typescript
it("user-specified pageSize wins over table default", () => {
  const result = desugarDisplayer({
    type: "TABLE",
    pageSize: 25,
    lookup: { uuid: "data" },
  });
  expect(result.props?.["pageSize"]).toBe(25);
});

it("user-specified filter wins over table default", () => {
  const result = desugarDisplayer({
    type: "TABLE",
    filter: { enabled: false },
    lookup: { uuid: "data" },
  });
  expect(result.props?.["filter"]).toEqual({ enabled: false });
});

it("table defaults still apply when user omits pageSize and filter", () => {
  const result = desugarDisplayer({
    type: "TABLE",
    lookup: { uuid: "data" },
  });
  expect(result.props?.["pageSize"]).toBe(10);
  expect((result.props?.["filter"] as Record<string, unknown>)?.["enabled"]).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify the first two fail**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: first two FAIL (pageSize=10 instead of 25, filter overwritten), third PASSES.

- [ ] **Step 3: Fix ordering in `desugarDisplayer`**

In `packages/pages-ui/src/parser/displayer-desugar.ts`, move the passthrough block (lines 383–394) to BEFORE the table defaults block (lines 368–381). The result:

```typescript
  // Pass through component-specific props not handled above
  const handledKeys = new Set([
    "type", "component", "general", "chart", "axis", "external", "table", "meter",
    "badge", "countdown", "timeline", "graph", "subtype", "filter", "lookup",
    "dataSetLookup", "columns", "refresh", "extraConfiguration", "dataSet",
    "visibleWhen", "html", "properties",
  ]);
  for (const [key, value] of Object.entries(raw)) {
    if (!handledKeys.has(key) && !(key in props)) {
      props[key] = value;
    }
  }

  // Table defaults: pageSize 10 and filter enabled (matching GWT behaviour)
  // Runs AFTER passthrough so user-specified values win
  if (type === "table") {
    if (props.pageSize === undefined) {
      props.pageSize = 10;
    }
    if (props.filter === undefined) {
      props.filter = { enabled: true };
    } else {
      const filterObj = props.filter as Record<string, unknown>;
      if (filterObj["enabled"] === undefined) {
        props.filter = { ...filterObj, enabled: true };
      }
    }
  }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-ui/src/parser/displayer-desugar.ts packages/pages-ui/src/parser/displayer-desugar.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "fix: desugar passthrough ordering — user props win over table defaults

Refs #196"
```

---

### Task 2: Column display hints on ColumnSettings

**Files:**
- Modify: `packages/pages-data/src/dataset/types.ts`
- Modify: `packages/pages-table/src/pages-table.ts` (method `_rebuildConfigFromProps`)
- Test: `packages/pages-table/src/pages-table.test.ts` (or create if not exists)

**Interfaces:**
- Consumes: `ColumnSettings` from pages-data
- Produces: Extended `ColumnSettings` with `width?`, `align?`, `sortable?`, `minWidth?`; `_rebuildConfigFromProps` merges these into generated `TableColumnConfig`

- [ ] **Step 1: Extend `ColumnSettings` interface**

Use `ide_edit_member` on `packages/pages-data/src/dataset/types.ts`, member `ColumnSettings`:

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

- [ ] **Step 2: Write failing test — column width from ColumnSettings**

Find or create the pipeline integration test file. Add:

```typescript
it("_rebuildConfigFromProps merges width from ColumnSettings", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.props = {
    columns: [
      { id: "name", name: "Name", width: "3fr" },
      { id: "status", name: "Status", width: "120px", align: "center" },
    ],
  };
  // Simulate dataset arrival
  table.dataSet = {
    columns: [
      { id: "name" as ColumnId, name: "name", type: ColumnType.LABEL },
      { id: "status" as ColumnId, name: "status", type: ColumnType.LABEL },
    ],
    rows: [],
  };
  expect(table.columnConfig[0]?.width).toBe("3fr");
  expect(table.columnConfig[1]?.width).toBe("120px");
  expect(table.columnConfig[1]?.align).toBe("center");
});

it("_rebuildConfigFromProps defaults to 1fr when no width hint", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.props = {
    columns: [{ id: "name", name: "Name" }],
  };
  table.dataSet = {
    columns: [
      { id: "name" as ColumnId, name: "name", type: ColumnType.LABEL },
    ],
    rows: [],
  };
  expect(table.columnConfig[0]?.width).toBe("1fr");
});

it("per-column sortable overrides global sortable", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.props = {
    sortable: true,
    columns: [
      { id: "name", name: "Name", sortable: false },
      { id: "status", name: "Status" },
    ],
  };
  table.dataSet = {
    columns: [
      { id: "name" as ColumnId, name: "name", type: ColumnType.LABEL },
      { id: "status" as ColumnId, name: "status", type: ColumnType.LABEL },
    ],
    rows: [],
  };
  expect(table.columnConfig[0]?.sortable).toBe(false);
  expect(table.columnConfig[1]?.sortable).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-table run test -- --reporter verbose 2>&1 | tail -20`
Expected: FAIL — width is `1fr` for all, align undefined.

- [ ] **Step 4: Implement — update `_rebuildConfigFromProps`**

Use `ide_replace_member` on `packages/pages-table/src/pages-table.ts`, method `_rebuildConfigFromProps`. Replace the config-building map:

```typescript
const config: TableColumnConfig[] = cols.map(col => {
  const override = this._propsColumns?.find(c => String(c.id) === String(col.id));
  const label = override
    ? (override.name ?? col.name)
    : col.name;
  return {
    id: col.id,
    label,
    sortable: override?.sortable ?? this._sortableFromProps,
    width: override?.width ?? '1fr',
    ...(override?.align && { align: override.align }),
    ...(override?.minWidth && { minWidth: override.minWidth }),
  };
});
```

This replaces the old code that used `resolveColumnName` and hardcoded `width: '1fr'`. The `resolveColumnName` function is no longer needed here since we read the override directly.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-table run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 6: Run pages-data tests too (interface changed)**

Run: `yarn workspace @casehubio/pages-data run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS (all new fields are optional)

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-data/src/dataset/types.ts packages/pages-table/src/pages-table.ts packages/pages-table/src/pages-table.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: column display hints (width, align, sortable, minWidth) on ColumnSettings

_rebuildConfigFromProps merges hints from ColumnSettings into generated
TableColumnConfig. YAML consumers use one columns array instead of
separate columnConfig.

Refs #196"
```

---

### Task 3: Container styling for data components

**Files:**
- Modify: `packages/pages-ui/src/parser/component-desugar.ts`
- Test: `packages/pages-ui/src/parser/component-desugar.test.ts`

**Interfaces:**
- Consumes: `extractStyle` (already exists in same file)
- Produces: Data components accept a `style` peer key in YAML, routed to `Component.style`

- [ ] **Step 1: Write failing test**

Add to `packages/pages-ui/src/parser/component-desugar.test.ts`:

```typescript
it("extracts style key for data components", () => {
  const result = desugarComponent({
    type: "table",
    style: {
      border: "1px solid #ccc",
      borderRadius: "8px",
    },
    properties: {
      lookup: { uuid: "data" },
    },
  });
  expect(result.style).toEqual({
    border: "1px solid #ccc",
    borderRadius: "8px",
  });
  expect(result.props?.["lookup"]).toBeDefined();
});

it("data component without style key has no style", () => {
  const result = desugarComponent({
    type: "table",
    properties: {
      lookup: { uuid: "data" },
    },
  });
  expect(result.style).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify the first fails**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: FAIL — style is undefined on data components.

- [ ] **Step 3: Implement — extract `style` in data component path**

In `packages/pages-ui/src/parser/component-desugar.ts`, in the data component block (the `if (DATA_COMPONENT_TYPES.has(normalized))` section), add style extraction:

```typescript
if (DATA_COMPONENT_TYPES.has(normalized)) {
  const rawProps = (raw.properties as Record<string, unknown> | undefined) ?? {};
  const style = extractStyle(raw.style);
  const displayerInput = { type: rawType, ...rawProps };
  const component = desugarDisplayer(displayerInput);
  const visibleWhen = raw.visibleWhen as string | undefined;
  const rawId = raw.id as string | undefined;
  return {
    ...component,
    ...(style ? { style } : {}),
    ...(rawId ? { id: rawId } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
  };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-ui/src/parser/component-desugar.ts packages/pages-ui/src/parser/component-desugar.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: data components accept style key for container CSS

YAML authors use a separate 'style' peer key (not inside 'properties')
to set border, borderRadius, padding etc. on data component containers.

Refs #196"
```

---

### Task 4: rowAccent on pages-table

**Files:**
- Modify: `packages/pages-table/src/types.ts` — add `RowAccentConfig`
- Modify: `packages/pages-table/src/pages-table.ts` — add property, props parsing, rendering
- Test: `packages/pages-table/src/pages-table.test.ts`

**Interfaces:**
- Consumes: `TypedRow`, `ColumnId`, `CellValue` from pages-data
- Produces: `getRowAccent` property, `RowAccentConfig` type, YAML `rowAccent` prop parsing

- [ ] **Step 1: Add `RowAccentConfig` type**

Use `ide_insert_member` at the end of `packages/pages-table/src/types.ts`:

```typescript
export interface RowAccentConfig {
  readonly column: string;
  readonly colorMap: Readonly<Record<string, string>>;
  readonly default?: string;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
it("getRowAccent renders left border on row", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.getRowAccent = (row) => {
    const val = row.text("status" as ColumnId);
    return val === "blocked" ? "#e65100" : undefined;
  };
  table.dataSet = makeDataSet([
    { status: "done" },
    { status: "blocked" },
  ]);
  // After render, check the second row has border-left
  const rows = table.shadowRoot!.querySelectorAll(".row");
  const blockedRow = rows[1] as HTMLElement;
  expect(blockedRow.style.cssText).toContain("border-left");
  expect(blockedRow.style.cssText).toContain("#e65100");
});

it("YAML rowAccent config converts to getRowAccent function", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.props = {
    rowAccent: {
      column: "status",
      colorMap: { done: "#2e7d32", blocked: "#e65100" },
      default: "#9e9e9e",
    },
  };
  expect(table.getRowAccent).toBeDefined();
});

it("rowAccent default color applies for unmapped values", () => {
  const table = document.createElement("pages-table") as PagesTable;
  table.props = {
    rowAccent: {
      column: "status",
      colorMap: { done: "#2e7d32" },
      default: "#9e9e9e",
    },
  };
  table.dataSet = makeDataSet([{ status: "unknown" }]);
  // getRowAccent for unmapped value should return default
  const row = table.dataSet!.rows[0]!;
  expect(table.getRowAccent!(row)).toBe("#9e9e9e");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-table run test -- --reporter verbose 2>&1 | tail -20`

- [ ] **Step 4: Implement getRowAccent property and props parsing**

Add to `PagesTable` class:

Property declaration:
```typescript
@property({ attribute: false })
getRowAccent?: (row: TypedRow) => string | undefined;
```

In `set props()`, after the rowStyle extraction block:
```typescript
const rowAccent = p.rowAccent as RowAccentConfig | undefined;
if (rowAccent) {
  const colId = rowAccent.column as ColumnId;
  const map = rowAccent.colorMap;
  const fallback = rowAccent.default;
  this.getRowAccent = (row: TypedRow) => {
    const cell = row.cell(colId);
    if (cell.type === 'NULL') return fallback;
    const color = map[String(cell.value)];
    return color ?? fallback;
  };
}
```

- [ ] **Step 5: Implement rendering in `_renderRow`**

In the `_renderRow` method, after the existing `rowInlineStyle` computation, add:

```typescript
const accent = this.getRowAccent?.(row);
const accentStyle = accent ? `border-left: 4px solid ${accent}` : '';
```

Then include `accentStyle` in the row's `style` attribute, after `rowInlineStyle`:

```typescript
style="grid-template-columns: ${this._gridTemplateColumns}; ${rowInlineStyle}${accentStyle ? `; ${accentStyle}` : ''}"
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-table run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-table/src/types.ts packages/pages-table/src/pages-table.ts packages/pages-table/src/pages-table.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: rowAccent — first-class left-border color for table rows

Adds getRowAccent function property (TypeScript) and rowAccent
declarative config (YAML) with column-based color mapping and
optional default color.

Refs #196"
```

---

### Task 5: Grouped-view property forwarding + GroupNode type

**Files:**
- Modify: `packages/pages-component/src/model/grouped-view-types.ts` — add `GroupNode`, `RowAccentConfig`, `clientSort`, `rowAccent` to `GroupedViewProps`
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` — extract `_forwardPropsToTable`, add `rowAccent` forwarding
- Modify: `packages/pages-ui/src/parser/grouped-view-desugar.ts` — add `clientSort`, `rowAccent` passthrough
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`
- Test: `packages/pages-ui/src/parser/grouped-view-desugar.test.ts`

**Interfaces:**
- Consumes: `RowAccentConfig` from pages-table/types, `PagesTableHost` interface
- Produces: `GroupNode` interface (in pages-component), updated `GroupedViewProps`, `_forwardPropsToTable` method

- [ ] **Step 1: Add GroupNode and update GroupedViewProps**

Use `ide_edit_member` on `packages/pages-component/src/model/grouped-view-types.ts`:

Add `GroupNode` interface and `RowAccentConfig` type. Update `GroupedViewProps` with `clientSort` and `rowAccent`:

```typescript
export interface GroupNode {
  readonly name: string;
  readonly depth: number;
  readonly startRow: number;
  readonly rowCount: number;
  readonly children: readonly GroupNode[];
  readonly aggregates?: ReadonlyMap<ColumnId, unknown>;
}

export interface RowAccentConfig {
  readonly column: string;
  readonly colorMap: Readonly<Record<string, string>>;
  readonly default?: string;
}
```

Add to `GroupedViewProps`:
```typescript
readonly clientSort?: boolean;
readonly rowAccent?: RowAccentConfig;
readonly renderAfterHeader?: (node: GroupNode) => HTMLElement | undefined;
```

- [ ] **Step 2: Update PagesTableHost interface and add rowAccent to it**

In `PagesGroupedView.ts`, update the `PagesTableHost` interface to include:
```typescript
rowAccent?: readonly RowStyleRule[];  // not needed — use getRowAccent
getRowAccent?: (row: TypedRow) => string | undefined;
```

- [ ] **Step 3: Write test — rowAccent forwarded to child tables**

```typescript
it("forwards rowAccent to child tables", () => {
  // Set rowAccent on grouped view props, verify child table receives getRowAccent function
});
```

- [ ] **Step 4: Extract `_forwardPropsToTable` method**

Replace the inline property assignments in `_createGroupTable` with a call to the new method. The method consolidates all property forwarding:

```typescript
private _forwardPropsToTable(table: PagesTableHost, props: GroupedViewProps): void {
  if (this._columnRenderers) table.columnRenderers = this._columnRenderers;
  if (props.rowStyle) table.rowStyle = props.rowStyle;
  if (this._getRowAccent) table.getRowAccent = this._getRowAccent;
  if (props.selection) table.selection = props.selection;
  if (this._getRowKey) table.getRowKey = this._getRowKey;
  if (this._getRowDetail) table.getRowDetail = this._getRowDetail;
  if (this._getRowClass) table.getRowClass = this._getRowClass;
  table.sortable = props.sortable ?? false;
  table.clientSort = props.clientSort ?? false;
  table.activeSort = this._activeSort;
}
```

- [ ] **Step 5: Add rowAccent props parsing in PagesGroupedView**

When `props` is set, if `props.rowAccent` exists, convert to a `getRowAccent` function (same pattern as PagesTable):

```typescript
if (props.rowAccent) {
  const colId = props.rowAccent.column as ColumnId;
  const map = props.rowAccent.colorMap;
  const fallback = props.rowAccent.default;
  this._getRowAccent = (row: TypedRow) => {
    const cell = row.cell(colId);
    if (cell.type === 'NULL') return fallback;
    return map[String(cell.value)] ?? fallback;
  };
}
```

- [ ] **Step 6: Update grouped-view-desugar with new passthrough lines**

In `packages/pages-ui/src/parser/grouped-view-desugar.ts`, add:

```typescript
if (raw.clientSort != null) props.clientSort = raw.clientSort;
if (raw.rowAccent != null) props.rowAccent = raw.rowAccent;
```

- [ ] **Step 7: Run tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter verbose 2>&1 | tail -20`
Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-component/src/model/grouped-view-types.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-ui/src/parser/grouped-view-desugar.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: grouped-view property forwarding consolidation + GroupNode type

Extracts _forwardPropsToTable for single-point maintenance.
Adds GroupNode to pages-component (avoids circular dep with pages-viz).
Forwards rowAccent and clientSort through grouped-view.

Refs #196"
```

---

### Task 6: Interstitial hook on group headers

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `GroupNode` from pages-component, `GroupedViewProps.renderAfterHeader`
- Produces: Interstitial DOM insertion between group header and content

- [ ] **Step 1: Write failing test**

```typescript
it("renderAfterHeader inserts content between header and table", () => {
  const view = document.createElement("pages-grouped-view") as PagesGroupedView;
  // ... set dataset with groups, set renderAfterHeader that returns a div for group "Critical"
  // Verify the returned element appears in the DOM between the header button and the section-content div
});
```

- [ ] **Step 2: Implement in render loop**

In `PagesGroupedView.render()`, after creating the section header and before creating the content wrapper, call `renderAfterHeader`:

```typescript
if (props.renderAfterHeader) {
  const node: GroupNode = {
    name: b.name,
    depth: 0,
    startRow: b.startRow,
    rowCount: b.rowCount,
    children: [],
    aggregates: b.aggregates,
  };
  const interstitial = props.renderAfterHeader(node);
  if (interstitial) {
    section.appendChild(interstitial);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter verbose 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: interstitial hook — renderAfterHeader on grouped-view

Consumers render custom DOM between group header and table content.
Receives GroupNode with name, depth, rowCount, aggregates.

Refs #196"
```

---

### Task 7: Legend companion component

**Files:**
- Create: `packages/pages-viz/src/components/PagesLegend.ts`
- Create: `packages/pages-viz/src/components/PagesLegend.test.ts`
- Modify: `packages/pages-viz/src/index.ts` — export
- Modify: `packages/pages-viz/src/custom-elements.ts` — registration (if this file handles `customElements.define`)
- Modify: `packages/pages-ui/src/parser/component-desugar.ts` — type handler
- Modify: `packages/pages-runtime/src/activation.ts` — activation handler

**Interfaces:**
- Consumes: `PagesContentElement` base class
- Produces: `<pages-legend>` custom element with `LegendProps`

- [ ] **Step 1: Create PagesLegend component**

Create `packages/pages-viz/src/components/PagesLegend.ts`:

```typescript
import { PagesContentElement } from "../base/PagesContentElement.js";

interface LegendEntry {
  readonly label: string;
  readonly color: string;
}

interface LegendProps {
  readonly entries: readonly LegendEntry[];
  readonly layout?: "linear" | "horizontal" | "grid";
  readonly swatchShape?: "square" | "circle";
}

export class PagesLegend extends PagesContentElement<LegendProps> {
  protected override render(container: HTMLDivElement, props: LegendProps): void {
    container.textContent = "";

    const style = document.createElement("style");
    style.textContent = `
      .pages-legend { display: flex; flex-wrap: wrap; gap: var(--pages-space-3, 12px); list-style: none; margin: 0; padding: 0; font-size: var(--pages-font-size-sm, 12px); color: var(--pages-neutral-11, #404040); }
      .pages-legend.horizontal { flex-wrap: nowrap; overflow-x: auto; }
      .pages-legend.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
      .legend-entry { display: flex; align-items: center; gap: var(--pages-space-1, 4px); }
      .legend-swatch { width: 12px; height: 12px; border-radius: var(--pages-radius-sm, 4px); flex-shrink: 0; }
      .legend-swatch.circle { border-radius: 50%; }
    `;
    container.appendChild(style);

    const layout = props.layout ?? "linear";
    const shape = props.swatchShape ?? "square";

    const ul = document.createElement("ul");
    ul.className = `pages-legend ${layout === "horizontal" ? "horizontal" : layout === "grid" ? "grid" : ""}`;

    for (const entry of props.entries) {
      const li = document.createElement("li");
      li.className = "legend-entry";

      const swatch = document.createElement("span");
      swatch.className = `legend-swatch ${shape === "circle" ? "circle" : ""}`;
      swatch.style.background = entry.color;
      swatch.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = entry.label;

      li.appendChild(swatch);
      li.appendChild(label);
      ul.appendChild(li);
    }

    container.appendChild(ul);
  }
}

customElements.define("pages-legend", PagesLegend);
```

- [ ] **Step 2: Write tests**

Create `packages/pages-viz/src/components/PagesLegend.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import "./PagesLegend.js";

describe("PagesLegend", () => {
  beforeAll(() => {
    // Ensure custom element is registered
  });

  it("renders entries as list items with swatches", () => {
    const el = document.createElement("pages-legend") as any;
    el.props = {
      entries: [
        { label: "Alpha", color: "#ff0000" },
        { label: "Beta", color: "#00ff00" },
      ],
    };
    document.body.appendChild(el);

    const items = el.shadowRoot!.querySelectorAll(".legend-entry");
    expect(items.length).toBe(2);

    const firstSwatch = items[0]!.querySelector(".legend-swatch") as HTMLElement;
    expect(firstSwatch.style.background).toContain("rgb(255, 0, 0)");
    expect(firstSwatch.getAttribute("aria-hidden")).toBe("true");

    const firstLabel = items[0]!.querySelector("span:not(.legend-swatch)");
    expect(firstLabel!.textContent).toBe("Alpha");

    document.body.removeChild(el);
  });

  it("uses semantic ul/li structure", () => {
    const el = document.createElement("pages-legend") as any;
    el.props = { entries: [{ label: "A", color: "#000" }] };
    document.body.appendChild(el);

    expect(el.shadowRoot!.querySelector("ul")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("li")).toBeTruthy();

    document.body.removeChild(el);
  });

  it("applies horizontal layout class", () => {
    const el = document.createElement("pages-legend") as any;
    el.props = { entries: [{ label: "A", color: "#000" }], layout: "horizontal" };
    document.body.appendChild(el);

    const ul = el.shadowRoot!.querySelector("ul");
    expect(ul!.classList.contains("horizontal")).toBe(true);

    document.body.removeChild(el);
  });

  it("applies circle swatch shape", () => {
    const el = document.createElement("pages-legend") as any;
    el.props = { entries: [{ label: "A", color: "#000" }], swatchShape: "circle" };
    document.body.appendChild(el);

    const swatch = el.shadowRoot!.querySelector(".legend-swatch");
    expect(swatch!.classList.contains("circle")).toBe(true);

    document.body.removeChild(el);
  });
});
```

- [ ] **Step 3: Add export to pages-viz index**

Add to `packages/pages-viz/src/index.ts`:
```typescript
export { PagesLegend } from "./components/PagesLegend.js";
```

- [ ] **Step 4: Add type handler in component-desugar**

In `packages/pages-ui/src/parser/component-desugar.ts`, add a handler for `type: "legend"` in the type-based dispatch section (before the `DATA_COMPONENT_TYPES` check):

```typescript
if (rawType === "legend") {
  const properties = (raw.properties as Record<string, unknown> | undefined) || {};
  const style = extractStyle(raw.style);
  const visibleWhen = raw.visibleWhen as string | undefined;
  return {
    type: "legend",
    props: properties,
    ...(style ? { style } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
  };
}
```

- [ ] **Step 5: Add activation handler in activation.ts**

In `packages/pages-runtime/src/activation.ts`, add a handler for `legend` type (near the `alert` handler):

```typescript
if (component.type === "legend" && component.props) {
  const legend = document.createElement("pages-legend");
  (legend as unknown as PagesContentElement<Record<string, unknown>>).props = component.props;
  el.appendChild(legend);
  if (component.visibleWhen && contextManager) {
    registerVisibleWhenConsumer(el, null, component.visibleWhen, contextManager);
  }
  return;
}
```

- [ ] **Step 6: Run tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter verbose 2>&1 | tail -20`
Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/PagesLegend.ts packages/pages-viz/src/components/PagesLegend.test.ts packages/pages-viz/src/index.ts packages/pages-ui/src/parser/component-desugar.ts packages/pages-runtime/src/activation.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: pages-legend companion component

Standalone <pages-legend> with linear/horizontal/grid layouts,
square/circle swatches, semantic ul/li, aria-hidden swatches.
Registered as content component — no dataset binding.

Refs #196"
```

---

### Task 8: Recursive multi-level grouping

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/group-extraction.ts` — add `extractGroupTree`
- Modify: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` — recursive render
- Modify: `packages/pages-ui/src/parser/grouped-view-desugar.ts` — array groupBy parsing
- Test: `packages/pages-viz/src/components/grouped-view/group-extraction.test.ts`
- Test: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `GroupNode` from pages-component, `GroupingKey` and `AggregationBinding` from pages-data
- Produces: `extractGroupTree` function, recursive render in `PagesGroupedView`, array `groupBy` in desugar

- [ ] **Step 1: Write failing test for extractGroupTree**

Add to `packages/pages-viz/src/components/grouped-view/group-extraction.test.ts`:

```typescript
import { extractGroupTree } from "./group-extraction.js";

describe("extractGroupTree", () => {
  it("single key produces flat GroupNode list (backward compat)", () => {
    const { dataset, keyCol } = makeGroupedDataset([
      { key: "A", rows: [["x", "1"], ["y", "2"]] },
      { key: "B", rows: [["z", "3"]] },
    ]);
    const nodes = extractGroupTree(dataset, [keyCol], []);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.name).toBe("A");
    expect(nodes[0]!.depth).toBe(0);
    expect(nodes[0]!.children).toHaveLength(0);
    expect(nodes[0]!.rowCount).toBe(2);
    expect(nodes[1]!.name).toBe("B");
  });

  it("two keys produce nested GroupNode tree", () => {
    // Dataset: phase=UI, status=done (2 rows); phase=UI, status=open (1 row); phase=API, status=done (1 row)
    const ds = makeMultiLevelDataset([
      { phase: "UI", status: "done", name: "a" },
      { phase: "UI", status: "done", name: "b" },
      { phase: "UI", status: "open", name: "c" },
      { phase: "API", status: "done", name: "d" },
    ]);
    const nodes = extractGroupTree(ds.dataset, [ds.phaseCol, ds.statusCol], []);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.name).toBe("UI");
    expect(nodes[0]!.depth).toBe(0);
    expect(nodes[0]!.children).toHaveLength(2);
    expect(nodes[0]!.children[0]!.name).toBe("done");
    expect(nodes[0]!.children[0]!.depth).toBe(1);
    expect(nodes[0]!.children[0]!.rowCount).toBe(2);
    expect(nodes[0]!.children[1]!.name).toBe("open");
    expect(nodes[0]!.children[1]!.rowCount).toBe(1);
    expect(nodes[1]!.name).toBe("API");
    expect(nodes[1]!.children).toHaveLength(1);
  });

  it("computes aggregates at every level", () => {
    // ... test with aggregation bindings, verify intermediate and leaf aggregates
  });

  it("empty dataset produces empty array", () => {
    // ...
  });
});
```

- [ ] **Step 2: Implement `extractGroupTree`**

Add to `packages/pages-viz/src/components/grouped-view/group-extraction.ts`:

```typescript
import type { GroupNode } from "@casehubio/pages-component";

export function extractGroupTree(
  dataset: TypedDataSet,
  keys: readonly ColumnId[],
  aggregations: readonly { column: ColumnId; fn: { fn: string } }[],
): readonly GroupNode[] {
  if (keys.length === 0 || dataset.rows.length === 0) return [];
  return buildLevel(dataset, keys, 0, 0, dataset.rows.length, aggregations);
}

function buildLevel(
  dataset: TypedDataSet,
  keys: readonly ColumnId[],
  depth: number,
  startRow: number,
  endRow: number,
  aggregations: readonly { column: ColumnId; fn: { fn: string } }[],
): GroupNode[] {
  if (depth >= keys.length) return [];

  const keyCol = keys[depth]!;
  const nodes: GroupNode[] = [];
  let currentName = cellToString(dataset.rows[startRow]!.cell(keyCol));
  let segStart = startRow;

  for (let i = startRow + 1; i <= endRow; i++) {
    const name = i < endRow ? cellToString(dataset.rows[i]!.cell(keyCol)) : null;
    if (name !== currentName) {
      const children = buildLevel(dataset, keys, depth + 1, segStart, i, aggregations);
      const aggregates = computeAggregates(dataset, segStart, i, aggregations);
      nodes.push({
        name: currentName,
        depth,
        startRow: segStart,
        rowCount: i - segStart,
        children,
        aggregates: aggregates.size > 0 ? aggregates : undefined,
      });
      if (name !== null) {
        currentName = name;
        segStart = i;
      }
    }
  }

  return nodes;
}

function computeAggregates(
  dataset: TypedDataSet,
  startRow: number,
  endRow: number,
  aggregations: readonly { column: ColumnId; fn: { fn: string } }[],
): ReadonlyMap<ColumnId, unknown> {
  // Compute each aggregation over the row range
  const result = new Map<ColumnId, unknown>();
  for (const agg of aggregations) {
    const values: number[] = [];
    for (let i = startRow; i < endRow; i++) {
      const cell = dataset.rows[i]!.cell(agg.column);
      if (cell.type !== "NULL" && typeof cell.value === "number") {
        values.push(cell.value);
      }
    }
    switch (agg.fn.fn) {
      case "COUNT": result.set(agg.column, endRow - startRow); break;
      case "SUM": result.set(agg.column, values.reduce((a, b) => a + b, 0)); break;
      case "AVERAGE": result.set(agg.column, values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0); break;
      case "MIN": result.set(agg.column, values.length > 0 ? Math.min(...values) : null); break;
      case "MAX": result.set(agg.column, values.length > 0 ? Math.max(...values) : null); break;
      default: result.set(agg.column, null);
    }
  }
  return result;
}
```

- [ ] **Step 3: Run extraction tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter verbose 2>&1 | tail -20`

- [ ] **Step 4: Update PagesGroupedView to use recursive rendering**

Replace the flat `for (let gi = 0; ...)` loop in `render()` with a call to a recursive `_renderNode` method. Normalize single `GroupingKey` to `[key]`. Use `extractGroupTree` instead of `extractGroupBoundaries` when keys.length > 1.

The `_renderNode` method:
```typescript
private _renderNode(
  node: GroupNode,
  wrapper: HTMLElement,
  columnConfig: TableColumnConfig[],
  props: GroupedViewProps,
  dataset: TypedDataSet,
  contentColumnIds: ColumnId[],
): void {
  const expanded = this._expandState.get(this._nodeKey(node)) ?? true;
  const section = renderGroupSectionHeader(/* adapted for GroupNode */);

  // Interstitial hook
  if (props.renderAfterHeader) {
    const interstitial = props.renderAfterHeader(node);
    if (interstitial) section.appendChild(interstitial);
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "section-content";
  if (!expanded) contentWrapper.hidden = true;

  if (node.children.length > 0) {
    for (const child of node.children) {
      this._renderNode(child, contentWrapper, columnConfig, props, dataset, contentColumnIds);
    }
  } else {
    const table = this._createGroupTable(dataset, node, columnConfig, props);
    this._groupTables.set(this._nodeKey(node), table);
    contentWrapper.appendChild(table);
  }

  // Toggle handler
  const toggleBtn = section.querySelector("[data-group]") as HTMLButtonElement;
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => this._handleToggle(toggleBtn, this._nodeKey(node), contentWrapper));
  }

  section.appendChild(contentWrapper);
  wrapper.appendChild(section);
}

private _nodeKey(node: GroupNode): string {
  // Build path using \x1F separator by walking up from the node
  // For now, a simple approach using depth and name
  return node.depth === 0 ? node.name : `${node.name}`; // Will need parent context
}
```

Note: the node key needs full path context. This requires passing the parent path down through recursion:
```typescript
private _renderNode(node: GroupNode, wrapper: HTMLElement, ..., parentPath: string): void {
  const path = parentPath ? `${parentPath}\x1F${node.name}` : node.name;
  // Use path for expand state and table map keys
}
```

- [ ] **Step 5: Update grouped-view-desugar for array groupBy**

In `packages/pages-ui/src/parser/grouped-view-desugar.ts`, detect whether `groupByRaw` is an array:

```typescript
const groupByRaw = raw.groupBy;
const groupByArray = Array.isArray(groupByRaw) ? groupByRaw : [groupByRaw];
// Parse each entry as a GroupingKey
const groupByKeys = groupByArray.map((g: Record<string, unknown>) => {
  const column = g.column as string;
  return {
    sourceId: column as ColumnId,
    columnId: column as ColumnId,
    strategy: parseStrategy(g),
    maxIntervals: (g.maxIntervals as number) ?? 100,
    emptyIntervals: false,
    ascendingOrder: true,
  } as GroupingKey;
});

// For single key, use first element directly (backward compat)
// For multi-key, store array
const groupBy = groupByKeys.length === 1 ? groupByKeys[0]! : groupByKeys;
props.groupBy = groupBy;
```

- [ ] **Step 6: Write desugar test for array groupBy**

```typescript
it("parses array groupBy into multiple GroupingKeys", () => {
  const result = desugarGroupedView({
    groupBy: [{ column: "phase" }, { column: "status" }],
    lookup: { uuid: "data" },
  });
  const gb = result.props?.["groupBy"];
  expect(Array.isArray(gb)).toBe(true);
  expect((gb as any[]).length).toBe(2);
});

it("parses single object groupBy as before", () => {
  const result = desugarGroupedView({
    groupBy: { column: "dept" },
    lookup: { uuid: "data" },
  });
  const gb = result.props?.["groupBy"];
  expect(Array.isArray(gb)).toBe(false);
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter verbose 2>&1 | tail -20`
Run: `yarn workspace @casehubio/pages-ui run test -- --reporter verbose 2>&1 | tail -20`

- [ ] **Step 8: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/grouped-view/group-extraction.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-ui/src/parser/grouped-view-desugar.ts packages/pages-viz/src/components/grouped-view/group-extraction.test.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts packages/pages-ui/src/parser/grouped-view-desugar.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: recursive multi-level grouping

groupBy accepts GroupingKey[] for nested groups. extractGroupTree
recursively partitions rows with client-side aggregate computation.
Expand state uses \\x1F-separated paths. Single key backward-compatible.

Refs #196"
```

---

### Task 9: Update Project Roadmap example

**Files:**
- Modify: `examples/samples/Tables/Project Roadmap.dash.yaml`

**Interfaces:**
- Consumes: All features from Tasks 1–8

- [ ] **Step 1: Update YAML to use all new features**

Update the example to demonstrate:
- `columns[].width` and `columns[].align` (Task 2)
- `style` key for rounded borders on tables (Task 3)
- `rowAccent` with column-based color mapping (Task 4)
- `type: legend` component (Task 7)
- `pageSize: 25` (now works via Task 1)

- [ ] **Step 2: Regenerate samples.json**

Run: `node examples/scripts/generate-samples.js`

- [ ] **Step 3: Build and verify in browser**

Run: `yarn build`
Serve examples and verify the roadmap renders correctly with all visual features.

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add examples/samples/Tables/Project\ Roadmap.dash.yaml examples/samples.json
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: update Project Roadmap example with all composability features

Demonstrates column widths, container styling, rowAccent, legend
component, pageSize, and status expressions.

Refs #196"
```
