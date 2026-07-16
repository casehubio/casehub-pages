# Grouped View Compose pages-table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #188 — pages-grouped-view must compose pages-table for content rendering
**Issue group:** #188

**Goal:** Replace PagesGroupedView's innerHTML table rendering with per-group `<pages-table>` composition, gaining all table features (column renderers, sorting, row detail, virtual scroll) for grouped data.

**Architecture:** Loose web component composition — PagesGroupedView creates `<pages-table>` elements by tag name with no package dependency. Shared types move to pages-component. Lifecycle-aware rendering preserves table state across data refreshes and expand/collapse toggles. A shared header bar handles sort coordination.

**Tech Stack:** TypeScript, Vitest, Web Components (vanilla + Lit), CSS Grid

## Global Constraints

- Pre-release platform — breaking changes cost nothing
- No runtime dependency from pages-viz to pages-table
- IntelliJ MCP mandatory for all source file operations
- TDD — failing test before implementation
- Every commit references #188

---

### Task 1: Type Migration — pages-component

Move serializable table types from pages-table to pages-component (the shared model layer).

**Files:**
- Modify: `packages/pages-component/src/model/displayer-types.ts`
- Modify: `packages/pages-component/src/model/index.ts`

**Interfaces:**
- Produces: `TableColumnConfig`, `ColumnAlign`, `SelectionMode`, `ColumnRenderer` (base) — exported from `@casehubio/pages-component`

- [ ] **Step 1: Add types to displayer-types.ts**

Use `ide_insert_member` to add after `ExpandableConfig` (line ~77):

```typescript
export type ColumnAlign = "start" | "center" | "end";

export interface TableColumnConfig {
  readonly id: ColumnId;
  readonly label?: string;
  readonly sortable?: boolean;
  readonly visible?: boolean;
  readonly width?: string;
  readonly minWidth?: string;
  readonly align?: ColumnAlign;
  readonly filterable?: boolean;
}

export type SelectionMode = "none" | "single" | "multi";

export type ColumnRenderer = (cell: CellValue, row: TypedRow, column: Column) => unknown;
```

Add necessary imports at the top: `CellValue`, `TypedRow`, `Column` from `@casehubio/pages-data`.

- [ ] **Step 2: Export new types from model/index.ts**

Add to the displayer-types export block in `packages/pages-component/src/model/index.ts`:

```typescript
  TableColumnConfig,
  ColumnAlign,
  SelectionMode,
  ColumnRenderer,
```

- [ ] **Step 3: Verify with ide_diagnostics**

Run `ide_diagnostics` on both modified files to confirm no type errors.

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-component/src/model/displayer-types.ts packages/pages-component/src/model/index.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: move TableColumnConfig, ColumnAlign, SelectionMode, ColumnRenderer to pages-component

Refs #188"
```

---

### Task 2: Type Migration — pages-table

Remove moved types from pages-table, import from pages-component. Narrow ColumnRenderer for Lit. Delete local RowStyleRule duplicate.

**Files:**
- Modify: `packages/pages-table/src/types.ts`
- Modify: `packages/pages-table/src/pages-table.ts`
- Modify: `packages/pages-table/src/index.ts`

**Interfaces:**
- Consumes: `TableColumnConfig`, `ColumnAlign`, `SelectionMode`, `ColumnRenderer` (base) from pages-component (Task 1)
- Produces: `TableColumnConfig` (extended with `compare`), `ColumnRenderer` (narrowed to Lit return types) — re-exported from `@casehubio/pages-table`

- [ ] **Step 1: Run existing pages-table tests to establish baseline**

Run: `yarn workspace @casehubio/pages-table run test`
Expected: All tests pass.

- [ ] **Step 2: Update types.ts — remove moved types, import base, narrow**

Use `ide_edit_member` on `packages/pages-table/src/types.ts`:

Remove `ColumnAlign`, `TableColumnConfig`, `SelectionMode`, `ColumnRenderer` type declarations.

Add imports and narrowed types:

```typescript
import type { TemplateResult } from 'lit';
import type { DirectiveResult } from 'lit/directive.js';
import type { CellValue, Column, ColumnId, TypedRow } from '@casehubio/pages-data';
import type {
  TableColumnConfig as BaseTableColumnConfig,
  ColumnRenderer as BaseColumnRenderer,
  ColumnAlign,
  SelectionMode,
} from '@casehubio/pages-component';

export type { ColumnAlign, SelectionMode };

export type TableColumnConfig = BaseTableColumnConfig & {
  readonly compare?: (a: CellValue, b: CellValue) => number;
};

export type ColumnRenderer = (...args: Parameters<BaseColumnRenderer>) => TemplateResult | string | DirectiveResult;
```

Keep all other types (DisplayMode, SortDirection, SortEntry, etc.) unchanged.

- [ ] **Step 3: Delete local RowStyleRule from pages-table.ts**

In `packages/pages-table/src/pages-table.ts`, delete the local `RowStyleRule` interface (lines 20-24). Add import from pages-component:

```typescript
import type { RowStyleRule } from '@casehubio/pages-component';
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `yarn workspace @casehubio/pages-table run test`
Expected: All tests pass — types are identical, just imported from different location.

- [ ] **Step 5: Run typecheck across affected packages**

Run: `yarn typecheck`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-table/src/types.ts packages/pages-table/src/pages-table.ts packages/pages-table/src/index.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "refactor: import shared table types from pages-component, delete RowStyleRule duplicate

Refs #188"
```

---

### Task 3: PagesTable Enhancements — embedded, headerVisible, sortable, rowStyle

Add new properties to PagesTable that PagesGroupedView needs: `embedded` (suppress toolbar/pagination), `headerVisible` (hide column headers), and promote `sortable`/`rowStyle` from the props bag to direct `@property()` so they work without entering pipeline mode.

**Files:**
- Modify: `packages/pages-table/src/pages-table.ts`
- Test: `packages/pages-table/src/pages-table.test.ts`

**Interfaces:**
- Produces: `embedded`, `headerVisible`, `sortable`, `rowStyle` as `@property()` on PagesTable

- [ ] **Step 1: Write failing tests for embedded property**

Add to `packages/pages-table/src/pages-table.test.ts`:

```typescript
describe('embedded mode', () => {
  it('suppresses toolbar when embedded is true', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = testConfig;
    (el as any).embedded = true;
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector('.toolbar');
    expect(toolbar).toBeNull();
  });

  it('suppresses pagination footer when embedded is true', async () => {
    el.dataSet = makeLargeDataSet(100);
    el.columnConfig = testConfig;
    el.mode = 'paginated';
    el.pageSize = 10;
    (el as any).embedded = true;
    await el.updateComplete;
    const footer = el.shadowRoot!.querySelector('.pagination');
    expect(footer).toBeNull();
  });

  it('shows toolbar when embedded is false (default)', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = testConfig;
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector('.toolbar');
    expect(toolbar).not.toBeNull();
  });
});
```

- [ ] **Step 2: Write failing tests for headerVisible property**

```typescript
describe('headerVisible', () => {
  it('hides header row when headerVisible is false', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = testConfig;
    (el as any).headerVisible = false;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('.header');
    expect(header!.classList.contains('visually-hidden')).toBe(true);
  });

  it('shows header row by default', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = testConfig;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('.header');
    expect(header!.classList.contains('visually-hidden')).toBe(false);
  });
});
```

- [ ] **Step 3: Write failing tests for sortable and rowStyle as direct properties**

```typescript
describe('direct property API', () => {
  it('enables sorting via sortable property without entering pipeline mode', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = [{ id: nameCol, sortable: true }];
    (el as any).sortable = true;
    await el.updateComplete;
    const headerBtn = el.shadowRoot!.querySelector('.header-cell');
    expect(headerBtn).not.toBeNull();
  });

  it('applies rowStyle via direct property without entering pipeline mode', async () => {
    el.dataSet = testDataSet;
    el.columnConfig = testConfig;
    (el as any).rowStyle = [{ condition: 'true', className: 'highlighted' }];
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('.row[role="row"]:not(.header)');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.classList.contains('highlighted')).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-table run test`
Expected: New tests fail (properties don't exist yet).

- [ ] **Step 5: Implement embedded property**

Add `@property` declaration to PagesTable class:

```typescript
@property({ type: Boolean }) embedded = false;
```

In `render()`, guard toolbar and pagination:

```typescript
${this.embedded ? nothing : this._renderToolbar()}
```

```typescript
${this.embedded ? nothing : this._renderPaginationFooter()}
```

- [ ] **Step 6: Implement headerVisible property**

Add `@property` declaration:

```typescript
@property({ type: Boolean, attribute: 'header-visible' }) headerVisible = true;
```

In `render()`, add `visually-hidden` class to header div when `headerVisible` is false:

```typescript
class="header${this.headerVisible ? '' : ' visually-hidden'}"
```

Apply the same to the empty-state render path's header.

- [ ] **Step 7: Promote sortable to direct @property**

Add `@property` declaration:

```typescript
@property({ type: Boolean }) sortable = false;
```

Update `_sortableFromProps` references: the existing `_sortableFromProps` field is set by the `props` setter. Change to also read from the `sortable` property:

In `_rebuildConfigFromProps()` and header click handler, replace `this._sortableFromProps` with `(this._sortableFromProps || this.sortable)`.

Keep the props setter path working — when `props.sortable = true`, it still sets `_sortableFromProps`.

- [ ] **Step 8: Promote rowStyle to direct @property**

Add `@property` declaration:

```typescript
@property({ attribute: false }) rowStyle?: readonly RowStyleRule[];
```

In `willUpdate()`, merge: if `this.rowStyle` is set directly, use it; if `_rowStyleRules` was set via props, use that. Direct property takes precedence:

```typescript
if (changed.has('rowStyle') && this.rowStyle) {
  this._rowStyleRules = this.rowStyle;
}
```

- [ ] **Step 9: Run tests**

Run: `yarn workspace @casehubio/pages-table run test`
Expected: All tests pass (old + new).

- [ ] **Step 10: Update PagesTableHost in the type map**

Add `embedded` and `headerVisible` to the `HTMLElementTagNameMap` augmentation — they're already covered by the class, just ensuring the type system sees them.

- [ ] **Step 11: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-table/src/pages-table.ts packages/pages-table/src/pages-table.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: add embedded, headerVisible, sortable, rowStyle direct properties to PagesTable

Refs #188"
```

---

### Task 4: GroupedViewProps Extension + Desugar

Add passthrough properties to GroupedViewProps and extend the YAML desugar.

**Files:**
- Modify: `packages/pages-component/src/model/grouped-view-types.ts`
- Modify: `packages/pages-ui/src/parser/grouped-view-desugar.ts`
- Test: `packages/pages-ui/src/parser/grouped-view-desugar.test.ts`

**Interfaces:**
- Consumes: `TableColumnConfig`, `RowStyleRule`, `SelectionMode` from pages-component (Task 1)
- Produces: Extended `GroupedViewProps` with `columnConfig`, `rowStyle`, `selection`, `sortable`

- [ ] **Step 1: Write failing desugar tests**

Add to `packages/pages-ui/src/parser/grouped-view-desugar.test.ts`:

```typescript
it('passes through columnConfig', () => {
  const result = desugarGroupedView({
    groupBy: { column: 'status' },
    lookup: { uuid: 'test' },
    columnConfig: [
      { id: 'name', width: '2fr', sortable: true },
      { id: 'age', width: '1fr', align: 'center' },
    ],
  });
  expect((result.props as any).columnConfig).toEqual([
    { id: 'name', width: '2fr', sortable: true },
    { id: 'age', width: '1fr', align: 'center' },
  ]);
});

it('passes through rowStyle', () => {
  const result = desugarGroupedView({
    groupBy: { column: 'status' },
    lookup: { uuid: 'test' },
    rowStyle: [{ condition: 'true', className: 'highlight' }],
  });
  expect((result.props as any).rowStyle).toEqual([
    { condition: 'true', className: 'highlight' },
  ]);
});

it('passes through selection', () => {
  const result = desugarGroupedView({
    groupBy: { column: 'status' },
    lookup: { uuid: 'test' },
    selection: 'multi',
  });
  expect((result.props as any).selection).toBe('multi');
});

it('passes through sortable', () => {
  const result = desugarGroupedView({
    groupBy: { column: 'status' },
    lookup: { uuid: 'test' },
    sortable: true,
  });
  expect((result.props as any).sortable).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-ui run test -- grouped-view-desugar`
Expected: Fail — new properties not passed through.

- [ ] **Step 3: Add passthrough properties to GroupedViewProps**

Edit `packages/pages-component/src/model/grouped-view-types.ts`. Add imports for the new types and extend the interface:

```typescript
import type { TableColumnConfig, RowStyleRule, SelectionMode } from "./displayer-types.js";
```

Add to GroupedViewProps after `emptyGroups`:

```typescript
  readonly columnConfig?: readonly TableColumnConfig[];
  readonly rowStyle?: readonly RowStyleRule[];
  readonly selection?: SelectionMode;
  readonly sortable?: boolean;
```

- [ ] **Step 4: Extend desugar to pass through new properties**

In `packages/pages-ui/src/parser/grouped-view-desugar.ts`, add after the existing passthrough block (around line 80):

```typescript
  if (raw.columnConfig != null) props.columnConfig = raw.columnConfig;
  if (raw.rowStyle != null) props.rowStyle = raw.rowStyle;
  if (raw.selection != null) props.selection = raw.selection;
  if (raw.sortable != null) props.sortable = raw.sortable;
```

- [ ] **Step 5: Run tests**

Run: `yarn workspace @casehubio/pages-ui run test -- grouped-view-desugar`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-component/src/model/grouped-view-types.ts packages/pages-ui/src/parser/grouped-view-desugar.ts packages/pages-ui/src/parser/grouped-view-desugar.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: add columnConfig, rowStyle, selection, sortable passthrough to GroupedViewProps

Refs #188"
```

---

### Task 5: Helper Module Rewrites — DOM Elements

Convert render-group-section.ts and render-group-table-row.ts from returning HTML strings to returning DOM elements. Edit render-content-list.ts to return a DOM element. Delete render-content-table.ts.

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/render-group-section.ts`
- Modify: `packages/pages-viz/src/components/grouped-view/render-group-table-row.ts`
- Modify: `packages/pages-viz/src/components/grouped-view/render-content-list.ts`
- Delete: `packages/pages-viz/src/components/grouped-view/render-content-table.ts`

**Interfaces:**
- Produces: `renderGroupSectionHeader()` → `HTMLElement`, `renderGroupTableRowHeader()` → `HTMLElement`, `renderContentList()` → `HTMLElement`

- [ ] **Step 1: Rewrite render-group-section.ts to return HTMLElement**

```typescript
import type { GroupBoundary } from "./group-extraction.js";

export function renderGroupSectionHeader(
  boundary: GroupBoundary,
  expanded: boolean,
  instanceId: string,
  index: number,
  showSummary: boolean,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "group-section";

  const btn = document.createElement("button");
  btn.className = "section-toggle";
  btn.setAttribute("aria-expanded", String(expanded));
  btn.setAttribute("aria-controls", `${instanceId}-group-${index}`);
  btn.setAttribute("data-group", boundary.name);

  const chevron = document.createElement("span");
  chevron.className = expanded ? "section-chevron expanded" : "section-chevron";
  chevron.textContent = "▶";

  const title = document.createElement("span");
  title.className = "section-title";
  title.textContent = boundary.name;

  const summary = document.createElement("span");
  summary.className = "section-summary";
  let summaryText = `${boundary.rowCount} items`;
  if (showSummary && boundary.aggregates.size > 0) {
    summaryText += " · " + Array.from(boundary.aggregates.values())
      .map((v) => String(v))
      .join(", ");
  }
  summary.textContent = summaryText;

  btn.append(chevron, title, summary);
  section.appendChild(btn);
  return section;
}
```

- [ ] **Step 2: Rewrite render-group-table-row.ts to return HTMLElement**

```typescript
import type { GroupBoundary } from "./group-extraction.js";

export function renderGroupTableRowHeader(
  boundary: GroupBoundary,
  expanded: boolean,
  instanceId: string,
  index: number,
  showSummary: boolean,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "group-section spreadsheet-group";

  const btn = document.createElement("button");
  btn.className = "group-toggle";
  btn.setAttribute("aria-expanded", String(expanded));
  btn.setAttribute("aria-controls", `${instanceId}-group-${index}`);
  btn.setAttribute("data-group", boundary.name);

  const chevron = document.createElement("span");
  chevron.className = "group-chevron";
  chevron.textContent = expanded ? "▼" : "▶";

  let text = `${boundary.name} (${boundary.rowCount})`;
  if (showSummary && boundary.aggregates.size > 0) {
    text += " · " + Array.from(boundary.aggregates.values())
      .map((v) => String(v))
      .join(", ");
  }

  const label = document.createElement("span");
  label.textContent = text;

  btn.append(chevron, label);
  section.appendChild(btn);
  return section;
}
```

- [ ] **Step 3: Rewrite render-content-list.ts to return HTMLElement**

```typescript
import type { TypedDataSet, ColumnId, CellValue } from "@casehubio/pages-data";
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
  instanceId: string,
  index: number,
  expanded: boolean,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "section-content";
  wrapper.id = `${instanceId}-group-${index}`;
  if (!expanded) wrapper.hidden = true;

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
      dd.textContent = cellToDisplay(row.cell(id));
      item.append(dt, dd);
    }
    dl.appendChild(item);
  }

  wrapper.appendChild(dl);
  return wrapper;
}
```

- [ ] **Step 4: Delete render-content-table.ts**

Use `ide_refactor_safe_delete` on `packages/pages-viz/src/components/grouped-view/render-content-table.ts`.

Remove the import from PagesGroupedView.ts: `import { renderContentTable } from "./render-content-table.js";`

- [ ] **Step 5: Verify with ide_diagnostics**

Run `ide_diagnostics` on all modified files. The PagesGroupedView.ts will have errors (it still references the old functions and return types) — that's expected and will be fixed in Task 6.

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/grouped-view/render-group-section.ts packages/pages-viz/src/components/grouped-view/render-group-table-row.ts packages/pages-viz/src/components/grouped-view/render-content-list.ts
git -C /Users/mdproctor/claude/casehub/pages rm packages/pages-viz/src/components/grouped-view/render-content-table.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "refactor: helper modules return DOM elements instead of HTML strings

Refs #188"
```

---

### Task 6: CSS Cleanup

Remove table-cell styles from GROUPED_VIEW_CSS, add spreadsheet bridge and shared header bar styles.

**Files:**
- Modify: `packages/pages-viz/src/components/grouped-view/group-view-styles.ts`

**Interfaces:**
- Produces: Updated `GROUPED_VIEW_CSS` string

- [ ] **Step 1: Read current styles**

Read `packages/pages-viz/src/components/grouped-view/group-view-styles.ts` to understand the full CSS.

- [ ] **Step 2: Rewrite GROUPED_VIEW_CSS**

Remove all table-cell styles (th, td, tr, colgroup, column-header-table). Keep group header, section content, list mode, and a11y styles. Add shared header bar and spreadsheet styles:

```typescript
export const GROUPED_VIEW_CSS = `
:host {
  display: block;
  font-family: var(--pages-font-family, system-ui, sans-serif);
  font-size: var(--pages-font-size-base, 14px);
  color: var(--pages-neutral-12, #333);
}

/* Shared column header bar */
.column-header-bar {
  display: grid;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--pages-neutral-1, #fff);
  border-bottom: 2px solid var(--pages-neutral-5, #ddd);
}

.col-header {
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
  font-weight: var(--pages-font-weight-semibold, 600);
  font-size: var(--pages-font-size-sm, 12px);
  color: var(--pages-neutral-9, #666);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--pages-space-1, 4px);
}

.col-header:hover {
  color: var(--pages-neutral-12, #333);
}

.col-header.sort-asc::after { content: " ▲"; font-size: 10px; }
.col-header.sort-desc::after { content: " ▼"; font-size: 10px; }

.col-label {
  text-align: left;
  padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
  font-weight: var(--pages-font-weight-semibold, 600);
  font-size: var(--pages-font-size-sm, 12px);
  color: var(--pages-neutral-9, #666);
  white-space: nowrap;
}

/* Sectioned mode — section headings */
.section-toggle {
  font-size: var(--pages-font-size-lg, 18px);
  font-weight: var(--pages-font-weight-semibold, 600);
  color: var(--pages-neutral-12, #333);
  background: none;
  border: none;
  padding: var(--pages-space-3, 12px) 0 var(--pages-space-2, 8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--pages-space-2, 8px);
  width: 100%;
}

.section-chevron {
  font-size: var(--pages-font-size-sm, 12px);
  transition: transform var(--pages-duration-fast, 150ms) var(--pages-ease-default, ease);
  display: inline-block;
}

.section-chevron.expanded {
  transform: rotate(90deg);
}

.section-summary {
  font-size: var(--pages-font-size-sm, 12px);
  font-weight: var(--pages-font-weight-normal, 400);
  color: var(--pages-neutral-8, #888);
  margin-left: var(--pages-space-2, 8px);
}

.section-content {
  overflow: hidden;
}

/* Spreadsheet mode — compact group headers */
.group-toggle {
  background: var(--pages-neutral-3, #f5f5f5);
  border: none;
  border-bottom: 1px solid var(--pages-neutral-5, #ddd);
  cursor: pointer;
  font: inherit;
  font-weight: var(--pages-font-weight-semibold, 600);
  font-size: var(--pages-font-size-sm, 12px);
  color: var(--pages-neutral-12, #333);
  padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
  display: flex;
  align-items: center;
  gap: var(--pages-space-2, 8px);
  width: 100%;
}

.group-chevron {
  font-size: var(--pages-font-size-xs, 10px);
}

.spreadsheet .group-section {
  margin: 0;
}

.spreadsheet .section-content {
  margin: 0;
  padding: 0;
}

/* Embedded pages-table overrides */
.section-content pages-table {
  display: block;
}

/* List mode */
.aligned-list {
  display: grid;
  row-gap: 0;
  padding: 0 var(--pages-space-3, 12px);
}

.list-item {
  display: contents;
}

.list-item dd {
  margin: 0;
  padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
  color: var(--pages-neutral-11, #444);
}

.list-item + .list-item dd {
  border-top: 1px solid var(--pages-neutral-3, #eee);
}

/* Accessibility */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .section-content,
  .section-chevron {
    transition: none !important;
  }
}
`;
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/grouped-view/group-view-styles.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "refactor: remove table-cell CSS from grouped-view, add shared header bar styles

Refs #188"
```

---

### Task 7: PagesGroupedView Rewrite

The core task. Rewrite PagesGroupedView to compose `<pages-table>` elements per group with lifecycle-aware rendering, shared header bar, sort coordination, and property forwarding.

**Files:**
- Rewrite: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts`
- Rewrite: `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`

**Interfaces:**
- Consumes: `renderGroupSectionHeader()` → HTMLElement (Task 5), `renderGroupTableRowHeader()` → HTMLElement (Task 5), `renderContentList()` → HTMLElement (Task 5), `GroupedViewProps` with passthrough (Task 4), `TableColumnConfig`, `ColumnRenderer`, `SelectionMode`, `RowStyleRule` from pages-component (Task 1), PagesTable with `embedded`, `headerVisible`, `sortable`, `rowStyle` (Task 3)
- Produces: Rewritten `PagesGroupedView` class with per-group `<pages-table>` composition

This task follows TDD. Tests are written first in phases, then implementation makes them pass.

#### Phase A: Basic rendering tests + implementation

- [ ] **Step 1: Write failing tests — basic rendering**

Rewrite `packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts`. Start with imports and helpers (adapted from existing):

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DataSet, ColumnId, TypedRow } from "@casehubio/pages-data";
import { ColumnType, toTypedDataSet } from "@casehubio/pages-data";
import type { GroupedViewProps, TableColumnConfig, RowStyleRule, ColumnRenderer } from "@casehubio/pages-component";
import type { DataSetLookup, SortColumn } from "@casehubio/pages-data";
import { PagesGroupedView } from "./PagesGroupedView.js";

function mockLookup(): DataSetLookup {
  return { dataSetId: "test", operations: [] } as unknown as DataSetLookup;
}

function makeGroupedDataset() {
  const ds: DataSet = {
    columns: [
      { id: "status" as ColumnId, name: "Status", type: ColumnType.LABEL },
      { id: "name" as ColumnId, name: "Name", type: ColumnType.LABEL },
      { id: "date" as ColumnId, name: "Date", type: ColumnType.LABEL },
    ],
    data: [
      ["Critical", "Server outage", "Jul 7"],
      ["Critical", "Data loss", "Jul 6"],
      ["Warning", "Slow query", "Jul 5"],
    ],
  };
  return toTypedDataSet(ds);
}

function makeProps(overrides: Partial<GroupedViewProps> = {}): GroupedViewProps {
  return {
    lookup: mockLookup(),
    groupBy: {
      sourceId: "status" as ColumnId,
      columnId: "status" as ColumnId,
      strategy: { mode: "distinct" as const },
      maxIntervals: 100,
      emptyIntervals: false,
      ascendingOrder: true,
    },
    ...overrides,
  };
}

// Mock pages-table registration
class MockPagesTable extends HTMLElement {
  dataSet: any;
  columnConfig: any;
  columnRenderers: any;
  rowStyle: any;
  selection: any;
  sortable: any;
  embedded: any;
  headerVisible: any;
  activeSort: any;
  getRowKey: any;
  getRowDetail: any;
  getRowClass: any;
  clientSort: any;
  mode: any;
}

if (!customElements.get('pages-table')) {
  customElements.define('pages-table', MockPagesTable);
}

describe("PagesGroupedView", () => {
  let element: PagesGroupedView;

  beforeEach(() => {
    element = document.createElement("pages-grouped-view") as PagesGroupedView;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  describe("basic rendering", () => {
    it("sectioned mode creates pages-table per group", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      expect(tables.length).toBe(2);
    });

    it("spreadsheet mode creates pages-table per group", async () => {
      element.props = makeProps({ preset: "spreadsheet" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      expect(tables.length).toBe(2);
    });

    it("list mode renders dl elements, no pages-table", async () => {
      element.props = makeProps({ preset: "list" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      expect(tables.length).toBe(0);
      const dls = element.shadowRoot!.querySelectorAll("dl");
      expect(dls.length).toBe(2);
    });

    it("each table receives correct data subset", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      const t0 = tables[0] as MockPagesTable;
      const t1 = tables[1] as MockPagesTable;
      expect(t0.dataSet.rows.length).toBe(2);
      expect(t1.dataSet.rows.length).toBe(1);
    });

    it("per-group tables have embedded=true and headerVisible=false", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      for (const table of tables) {
        expect((table as MockPagesTable).embedded).toBe(true);
        expect((table as MockPagesTable).headerVisible).toBe(false);
      }
    });
  });
```

- [ ] **Step 2: Write failing tests — shared header bar**

```typescript
  describe("shared header bar", () => {
    it("renders shared column header bar once at top", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const bars = element.shadowRoot!.querySelectorAll(".column-header-bar");
      expect(bars.length).toBe(1);
    });

    it("header bar is outside any group-section", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const bar = element.shadowRoot!.querySelector(".column-header-bar");
      expect(bar!.closest(".group-section")).toBeNull();
    });

    it("header bar shows column names", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const labels = element.shadowRoot!.querySelectorAll(".column-header-bar .col-label, .column-header-bar .col-header");
      expect(labels.length).toBe(2);
      expect(labels[0]!.textContent).toContain("Name");
      expect(labels[1]!.textContent).toContain("Date");
    });
  });
```

- [ ] **Step 3: Write failing tests — column alignment**

```typescript
  describe("column alignment", () => {
    it("all tables receive identical columnConfig widths", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      const configs = Array.from(tables).map((t) => (t as MockPagesTable).columnConfig);
      expect(configs[0]).toEqual(configs[1]);
      for (const cfg of configs) {
        for (const col of cfg) {
          expect(col.width).toMatch(/fr$/);
        }
      }
    });

    it("consumer columnConfig width overrides computed widths", async () => {
      element.props = makeProps({
        preset: "sectioned",
        columnConfig: [{ id: "name" as ColumnId, width: "200px" }],
      });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      const cfg = (tables[0] as MockPagesTable).columnConfig;
      const nameCol = cfg.find((c: TableColumnConfig) => c.id === "name");
      expect(nameCol!.width).toBe("200px");
    });
  });
```

- [ ] **Step 4: Write failing tests — expand/collapse**

```typescript
  describe("expand/collapse", () => {
    it("toggles hidden attribute on section content", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const toggle = element.shadowRoot!.querySelector("[data-group='Critical']") as HTMLButtonElement;
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      const contentId = toggle.getAttribute("aria-controls")!;
      const content = element.shadowRoot!.getElementById(contentId)!;
      expect(content.hidden).toBe(false);

      toggle.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(content.hidden).toBe(true);
    });

    it("preserves table DOM reference after toggle", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tableBefore = element.shadowRoot!.querySelector("pages-table");
      const toggle = element.shadowRoot!.querySelector("[data-group='Critical']") as HTMLButtonElement;
      toggle.click();
      await new Promise((r) => setTimeout(r, 0));
      toggle.click();
      await new Promise((r) => setTimeout(r, 0));
      const tableAfter = element.shadowRoot!.querySelector("pages-table");
      expect(tableAfter).toBe(tableBefore);
    });

    it("emits pages-event on group toggle", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const events: CustomEvent[] = [];
      element.addEventListener("pages-event", (e: Event) => events.push(e as CustomEvent));
      const toggle = element.shadowRoot!.querySelector(".section-toggle") as HTMLButtonElement;
      toggle.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(events.length).toBe(1);
      expect(events[0]!.detail.topic).toBe("group-toggle");
    });

    it("hides content when defaultExpanded is false", async () => {
      element.props = makeProps({ preset: "sectioned", defaultExpanded: false });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const contents = element.shadowRoot!.querySelectorAll(".section-content");
      for (const content of contents) {
        expect((content as HTMLElement).hidden).toBe(true);
      }
    });

    it("has unique aria-controls IDs", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const toggles = element.shadowRoot!.querySelectorAll("[data-group]");
      const ids = Array.from(toggles).map((t) => t.getAttribute("aria-controls"));
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(element.shadowRoot!.getElementById(id!)).not.toBeNull();
      }
    });
  });
```

- [ ] **Step 5: Write failing tests — property forwarding**

```typescript
  describe("property forwarding", () => {
    it("forwards columnRenderers to all tables", async () => {
      const renderers = new Map([["name" as ColumnId, (() => "custom") as unknown as ColumnRenderer]]);
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      (element as any).columnRenderers = renderers;
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      for (const table of tables) {
        expect((table as MockPagesTable).columnRenderers).toBe(renderers);
      }
    });

    it("forwards rowStyle from props to all tables", async () => {
      const rules: readonly RowStyleRule[] = [{ condition: "true", className: "highlight" }];
      element.props = makeProps({ preset: "sectioned", rowStyle: rules });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      for (const table of tables) {
        expect((table as MockPagesTable).rowStyle).toEqual(rules);
      }
    });

    it("forwards selection from props to all tables", async () => {
      element.props = makeProps({ preset: "sectioned", selection: "multi" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      for (const table of tables) {
        expect((table as MockPagesTable).selection).toBe("multi");
      }
    });
  });
```

- [ ] **Step 6: Write failing tests — reconciliation**

```typescript
  describe("reconciliation", () => {
    it("reuses table DOM elements when data refreshes with same groups", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tableBefore = element.shadowRoot!.querySelector("pages-table");
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tableAfter = element.shadowRoot!.querySelector("pages-table");
      expect(tableAfter).toBe(tableBefore);
    });

    it("rebuilds tables when group structure changes", async () => {
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const tableBefore = element.shadowRoot!.querySelector("pages-table");

      const newDs: DataSet = {
        columns: [
          { id: "status" as ColumnId, name: "Status", type: ColumnType.LABEL },
          { id: "name" as ColumnId, name: "Name", type: ColumnType.LABEL },
          { id: "date" as ColumnId, name: "Date", type: ColumnType.LABEL },
        ],
        data: [
          ["Info", "New item", "Jul 8"],
        ],
      };
      element.dataSet = toTypedDataSet(newDs);
      await new Promise((r) => setTimeout(r, 0));
      const tableAfter = element.shadowRoot!.querySelector("pages-table");
      expect(tableAfter).not.toBe(tableBefore);
    });

    it("empty group creates table with empty dataset", async () => {
      const ds: DataSet = {
        columns: [
          { id: "status" as ColumnId, name: "Status", type: ColumnType.LABEL },
          { id: "name" as ColumnId, name: "Name", type: ColumnType.LABEL },
        ],
        data: [],
      };
      element.props = makeProps({ preset: "sectioned" });
      element.dataSet = toTypedDataSet(ds);
      await new Promise((r) => setTimeout(r, 0));
      const tables = element.shadowRoot!.querySelectorAll("pages-table");
      expect(tables.length).toBe(0);
    });
  });
```

- [ ] **Step 7: Write failing tests — sort coordination**

```typescript
  describe("sort coordination", () => {
    it("sort buttons dispatch pages-sort from grouped view", async () => {
      element.props = makeProps({ preset: "sectioned", sortable: true });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const events: CustomEvent[] = [];
      element.addEventListener("pages-sort", (e: Event) => events.push(e as CustomEvent));
      const sortBtn = element.shadowRoot!.querySelector(".col-header") as HTMLButtonElement;
      sortBtn.click();
      expect(events.length).toBe(1);
      expect(events[0]!.detail.order).toBe("ASCENDING");
    });

    it("renders static labels when sortable is false", async () => {
      element.props = makeProps({ preset: "sectioned", sortable: false });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      const buttons = element.shadowRoot!.querySelectorAll(".col-header");
      expect(buttons.length).toBe(0);
      const labels = element.shadowRoot!.querySelectorAll(".col-label");
      expect(labels.length).toBe(2);
    });

    it("updates sort indicators when activeSort changes", async () => {
      element.props = makeProps({ preset: "sectioned", sortable: true });
      element.dataSet = makeGroupedDataset();
      await new Promise((r) => setTimeout(r, 0));
      element.activeSort = { columnId: "name" as ColumnId, order: "ASCENDING" } as SortColumn;
      await new Promise((r) => setTimeout(r, 0));
      const active = element.shadowRoot!.querySelector(".col-header[data-column='name']");
      expect(active!.getAttribute("aria-sort")).toBe("ascending");
      expect(active!.classList.contains("sort-asc")).toBe(true);
    });
  });
});
```

- [ ] **Step 8: Run tests to verify they all fail**

Run: `yarn workspace @casehubio/pages-viz run test -- PagesGroupedView`
Expected: All new tests fail.

- [ ] **Step 9: Implement PagesGroupedView**

Rewrite `packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts` with the full implementation. This is the largest single step — the complete rewrite following the spec's §3 architecture.

The implementation must include:
- `PagesTableHost` local interface
- `_groupTables` Map and `_lastBoundaries` state
- `_columnRenderers`, `_getRowKey`, `_getRowDetail`, `_getRowClass` backing fields with forwarding setters
- `render()` override — builds DOM programmatically with per-group `<pages-table>` + shared header bar
- Reconciliation logic (same structure → update data; different → rebuild)
- Toggle handler (no render call — toggles hidden + aria-expanded)
- `_handleHeaderSort()` — reads from `this.activeSort`, dispatches `pages-sort`
- `activeSort` override — forwards to tables + updates header bar
- `_updateHeaderBarSort()` — manages sort indicator CSS/aria on header bar
- `_buildColumnConfig()` — merges computed fr widths with consumer config
- List mode delegation to `renderContentList()`

```typescript
import type { TypedDataSet, ColumnId, CellValue, SortColumn } from "@casehubio/pages-data";
import type {
  GroupedViewProps,
  TableColumnConfig,
  ColumnRenderer,
  RowStyleRule,
  SelectionMode,
} from "@casehubio/pages-component";
import { PagesElement } from "../../base/PagesElement.js";
import { resolvePreset } from "./presets.js";
import { extractGroupBoundaries } from "./group-extraction.js";
import type { GroupBoundary } from "./group-extraction.js";
import { computeColumnWidths } from "./column-widths.js";
import { renderGroupSectionHeader } from "./render-group-section.js";
import { renderGroupTableRowHeader } from "./render-group-table-row.js";
import { renderContentList } from "./render-content-list.js";
import { GROUPED_VIEW_CSS } from "./group-view-styles.js";

interface PagesTableHost extends HTMLElement {
  dataSet?: TypedDataSet;
  columnConfig?: readonly TableColumnConfig[];
  columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  rowStyle?: readonly RowStyleRule[];
  selection?: SelectionMode;
  getRowKey?: (row: import("@casehubio/pages-data").TypedRow) => string;
  getRowDetail?: (row: import("@casehubio/pages-data").TypedRow) => unknown;
  getRowClass?: (row: import("@casehubio/pages-data").TypedRow) => string;
  mode?: string;
  loading?: boolean;
  error?: string;
  sortable?: boolean;
  clientSort?: boolean;
  embedded?: boolean;
  headerVisible?: boolean;
  activeSort?: SortColumn;
}

export class PagesGroupedView extends PagesElement<GroupedViewProps> {
  private _expandState = new Map<string, boolean>();
  private _instanceId = "";
  private _styleEl: HTMLStyleElement;
  private _groupTables = new Map<string, PagesTableHost>();
  private _lastBoundaries: readonly GroupBoundary[] = [];

  private _columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  private _getRowKey?: (row: import("@casehubio/pages-data").TypedRow) => string;
  private _getRowDetail?: (row: import("@casehubio/pages-data").TypedRow) => unknown;
  private _getRowClass?: (row: import("@casehubio/pages-data").TypedRow) => string;

  get columnRenderers() { return this._columnRenderers; }
  set columnRenderers(value: ReadonlyMap<ColumnId, ColumnRenderer> | undefined) {
    this._columnRenderers = value;
    for (const table of this._groupTables.values()) {
      table.columnRenderers = value;
    }
  }

  get getRowKey() { return this._getRowKey; }
  set getRowKey(value: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined) {
    this._getRowKey = value;
    for (const table of this._groupTables.values()) {
      table.getRowKey = value;
    }
  }

  get getRowDetail() { return this._getRowDetail; }
  set getRowDetail(value: ((row: import("@casehubio/pages-data").TypedRow) => unknown) | undefined) {
    this._getRowDetail = value;
    for (const table of this._groupTables.values()) {
      table.getRowDetail = value;
    }
  }

  get getRowClass() { return this._getRowClass; }
  set getRowClass(value: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined) {
    this._getRowClass = value;
    for (const table of this._groupTables.values()) {
      table.getRowClass = value;
    }
  }

  override set activeSort(value: SortColumn | undefined) {
    super.activeSort = value;
    for (const table of this._groupTables.values()) {
      table.activeSort = value;
    }
    this._updateHeaderBarSort(value);
  }

  override get activeSort(): SortColumn | undefined {
    return super.activeSort;
  }

  constructor() {
    super();
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = GROUPED_VIEW_CSS;
    this.shadowRoot.insertBefore(this._styleEl, this.container);
  }

  override connectedCallback(): void {
    this._instanceId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    super.connectedCallback();
  }

  protected override render(
    container: HTMLDivElement,
    props: GroupedViewProps,
    dataset: TypedDataSet,
  ): void {
    const mode = resolvePreset(props);
    const keyColumnId = props.groupBy.columnId;
    const aggColumnIds = (props.aggregations ?? []).map((a) => a.column);
    const boundaries = extractGroupBoundaries(dataset, keyColumnId, aggColumnIds);

    const contentColumnIds = dataset.columns
      .filter((c) => c.id !== keyColumnId && !aggColumnIds.includes(c.id))
      .map((c) => c.id);

    const defaultExpanded = props.defaultExpanded ?? true;
    for (const b of boundaries) {
      if (!this._expandState.has(b.name)) {
        this._expandState.set(b.name, b.rowCount === 0 ? false : defaultExpanded);
      }
    }

    const isListMode = mode.contentDisplay === "list";
    const isSpreadsheet = mode.groupDisplay === "table-row";

    if (this._canReconcile(boundaries)) {
      this._updateExistingTables(dataset, boundaries, contentColumnIds, props);
      this._lastBoundaries = boundaries;
      return;
    }

    this._groupTables.clear();
    container.textContent = "";

    const wrapper = document.createElement("div");
    wrapper.className = `pages-grouped-view ${isSpreadsheet ? "spreadsheet" : isListMode ? "list-mode" : "sectioned"}`;

    if (!isListMode) {
      const headerBar = this._buildHeaderBar(dataset, contentColumnIds, props);
      wrapper.appendChild(headerBar);
    } else {
      const colWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
      const colWidthsCss = colWidths.map((w) => `${w}px`).join(" ");
      const headerBar = document.createElement("div");
      headerBar.className = "column-header-bar";
      headerBar.style.gridTemplateColumns = colWidthsCss;
      for (const id of contentColumnIds) {
        const col = dataset.columns.find((c) => c.id === id);
        const label = document.createElement("span");
        label.className = "col-label";
        label.textContent = col?.name ?? String(id);
        headerBar.appendChild(label);
      }
      wrapper.appendChild(headerBar);
    }

    const columnConfig = isListMode ? undefined : this._buildColumnConfig(dataset, contentColumnIds, props);

    for (let gi = 0; gi < boundaries.length; gi++) {
      const b = boundaries[gi]!;
      const expanded = this._expandState.get(b.name) ?? true;

      const section = isSpreadsheet
        ? renderGroupTableRowHeader(b, expanded, this._instanceId, gi, props.showGroupSummary ?? false)
        : renderGroupSectionHeader(b, expanded, this._instanceId, gi, props.showGroupSummary ?? false);

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "section-content";
      contentWrapper.id = `${this._instanceId}-group-${gi}`;
      if (!expanded) contentWrapper.hidden = true;

      if (isListMode) {
        const colWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
        const colWidthsCss = colWidths.map((w) => `${w}px`).join(" ");
        const listEl = renderContentList(dataset, b, contentColumnIds, colWidthsCss, this._instanceId, gi, expanded);
        contentWrapper.appendChild(listEl.querySelector(".aligned-list") ?? listEl);
      } else {
        const table = document.createElement("pages-table") as PagesTableHost;
        table.embedded = true;
        table.headerVisible = false;
        table.dataSet = this._sliceDataset(dataset, b);
        if (columnConfig) table.columnConfig = columnConfig;
        if (props.rowStyle) table.rowStyle = props.rowStyle;
        if (props.selection) table.selection = props.selection;
        if (props.sortable !== undefined) table.sortable = props.sortable;
        if (this._columnRenderers) table.columnRenderers = this._columnRenderers;
        if (this._getRowKey) table.getRowKey = this._getRowKey;
        if (this._getRowDetail) table.getRowDetail = this._getRowDetail;
        if (this._getRowClass) table.getRowClass = this._getRowClass;
        if (this.activeSort) table.activeSort = this.activeSort;
        this._groupTables.set(b.name, table);
        contentWrapper.appendChild(table);
      }

      section.appendChild(contentWrapper);

      const toggleBtn = section.querySelector("[data-group]") as HTMLButtonElement;
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          this._handleToggle(toggleBtn, b.name, contentWrapper);
        });
      }

      wrapper.appendChild(section);
    }

    container.appendChild(wrapper);
    this._lastBoundaries = boundaries;
  }

  private _canReconcile(newBoundaries: readonly GroupBoundary[]): boolean {
    if (this._lastBoundaries.length === 0) return false;
    if (this._lastBoundaries.length !== newBoundaries.length) return false;
    const oldNames = this._lastBoundaries.map((b) => b.name);
    const newNames = newBoundaries.map((b) => b.name);
    return oldNames.every((name, i) => name === newNames[i]);
  }

  private _updateExistingTables(
    dataset: TypedDataSet,
    boundaries: readonly GroupBoundary[],
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
  ): void {
    const columnConfig = this._buildColumnConfig(dataset, contentColumnIds, props);
    for (const b of boundaries) {
      const table = this._groupTables.get(b.name);
      if (table) {
        table.dataSet = this._sliceDataset(dataset, b);
        table.columnConfig = columnConfig;
      }
    }
  }

  private _handleToggle(
    btn: HTMLButtonElement,
    groupName: string,
    content: HTMLElement,
  ): void {
    const wasExpanded = this._expandState.get(groupName) ?? true;
    this._expandState.set(groupName, !wasExpanded);

    btn.setAttribute("aria-expanded", String(!wasExpanded));
    content.hidden = wasExpanded;

    const chevron = btn.querySelector(".section-chevron, .group-chevron");
    if (chevron) {
      if (!wasExpanded) {
        chevron.classList.add("expanded");
        chevron.textContent = chevron.classList.contains("group-chevron") ? "▼" : "▶";
      } else {
        chevron.classList.remove("expanded");
        chevron.textContent = chevron.classList.contains("group-chevron") ? "▶" : "▶";
      }
    }

    this.dispatchEvent(new CustomEvent("pages-event", {
      bubbles: true,
      composed: true,
      detail: {
        topic: "group-toggle",
        payload: { group: groupName, expanded: !wasExpanded },
      },
    }));
  }

  private _buildHeaderBar(
    dataset: TypedDataSet,
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
  ): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "column-header-bar";

    const rawWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
    const minWidth = Math.min(...rawWidths);
    const frWidths = rawWidths.map((w) => `${(w / minWidth).toFixed(2)}fr`);

    const prefix: string[] = [];
    if (this._getRowDetail) prefix.push("40px");
    if (props.selection === "multi") prefix.push("40px");

    const gridCols = [...prefix, ...frWidths].join(" ");
    bar.style.gridTemplateColumns = gridCols;

    for (const p of prefix) {
      const spacer = document.createElement("div");
      bar.appendChild(spacer);
    }

    const sortable = props.sortable !== false;
    for (let i = 0; i < contentColumnIds.length; i++) {
      const id = contentColumnIds[i]!;
      const col = dataset.columns.find((c) => c.id === id);
      const colConfig = props.columnConfig?.find((c) => c.id === id);
      const colSortable = sortable && colConfig?.sortable !== false;

      if (colSortable) {
        const btn = document.createElement("button");
        btn.className = "col-header";
        btn.setAttribute("data-column", String(id));
        btn.textContent = colConfig?.label ?? col?.name ?? String(id);
        btn.addEventListener("click", () => this._handleHeaderSort(id));
        bar.appendChild(btn);
      } else {
        const span = document.createElement("span");
        span.className = "col-label";
        span.textContent = colConfig?.label ?? col?.name ?? String(id);
        bar.appendChild(span);
      }
    }

    if (this.activeSort) {
      this._updateHeaderBarSortOnElement(bar, this.activeSort);
    }

    return bar;
  }

  private _handleHeaderSort(columnId: ColumnId): void {
    const current = this.activeSort;
    let order: "ASCENDING" | "DESCENDING";
    if (current && String(current.columnId) === String(columnId)) {
      order = current.order === "ASCENDING" ? "DESCENDING" : "ASCENDING";
    } else {
      order = "ASCENDING";
    }
    this.dispatchEvent(new CustomEvent("pages-sort", {
      detail: { columnId, order },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateHeaderBarSort(sort: SortColumn | undefined): void {
    const bar = this.shadowRoot.querySelector(".column-header-bar");
    if (!bar) return;
    this._updateHeaderBarSortOnElement(bar, sort);
  }

  private _updateHeaderBarSortOnElement(bar: Element, sort: SortColumn | undefined): void {
    const buttons = bar.querySelectorAll(".col-header");
    for (const btn of buttons) {
      btn.removeAttribute("aria-sort");
      btn.classList.remove("sort-asc", "sort-desc");
    }
    if (!sort) return;
    const active = bar.querySelector(`.col-header[data-column="${String(sort.columnId)}"]`);
    if (!active) return;
    const dir = sort.order === "ASCENDING" ? "ascending" : "descending";
    active.setAttribute("aria-sort", dir);
    active.classList.add(sort.order === "ASCENDING" ? "sort-asc" : "sort-desc");
  }

  private _buildColumnConfig(
    dataset: TypedDataSet,
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
  ): readonly TableColumnConfig[] {
    const rawWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
    const minWidth = Math.min(...rawWidths);
    const frWidths = rawWidths.map((w) => `${(w / minWidth).toFixed(2)}fr`);

    return contentColumnIds.map((id, i) => {
      const userConfig = props.columnConfig?.find((c) => c.id === id);
      return {
        id,
        width: userConfig?.width ?? frWidths[i]!,
        ...userConfig,
      } as TableColumnConfig;
    });
  }

  private _sliceDataset(dataset: TypedDataSet, boundary: GroupBoundary): TypedDataSet {
    return {
      columns: dataset.columns,
      rows: dataset.rows.slice(boundary.startRow, boundary.startRow + boundary.rowCount),
    };
  }
}

customElements.define("pages-grouped-view", PagesGroupedView);
```

- [ ] **Step 10: Run tests**

Run: `yarn workspace @casehubio/pages-viz run test -- PagesGroupedView`
Expected: All tests pass.

- [ ] **Step 11: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/grouped-view/PagesGroupedView.ts packages/pages-viz/src/components/grouped-view/PagesGroupedView.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: rewrite PagesGroupedView to compose per-group pages-table elements

Lifecycle-aware rendering preserves table state across data refreshes
and expand/collapse. Shared header bar with sort coordination.
Column alignment guaranteed via shared fr widths.

Refs #188"
```

---

### Task 8: Example Dashboard Update

Update the Grouped View example to demonstrate column renderers and other new features.

**Files:**
- Modify: `examples/samples/Tables/Grouped View.dash.yaml`

- [ ] **Step 1: Add a tab demonstrating sortable grouped view with column config**

Add a new tab after the existing "With Aggregation" tab:

```yaml
          Sortable with Column Config:
            components:
              - type: markdown
                properties:
                  content: >
                    Groups with **column configuration** — sortable columns and
                    row styling. Click column headers to sort across all groups.
              - type: grouped-view
                properties:
                  lookup:
                    uuid: team-data
                  groupBy:
                    column: department
                  preset: sectioned
                  sortable: true
                  columnConfig:
                    - id: name
                      width: "2fr"
                      sortable: true
                    - id: role
                      width: "2fr"
                    - id: score
                      width: "1fr"
                      sortable: true
                      align: end
                    - id: status
                      width: "1fr"
                  rowStyle:
                    - condition: "row.cell('score').value >= 90"
                      className: highlight-row
```

- [ ] **Step 2: Run the examples dev server and verify**

Run: `yarn build && yarn workspace @casehubio/pages-examples run serve`

Navigate to the Grouped View example. Verify:
- Sectioned tab shows per-group tables with shared header
- Spreadsheet tab shows compact group headers with per-group tables
- List tab unchanged
- New "Sortable with Column Config" tab shows sortable headers
- Clicking a sort header re-sorts data across all groups
- Columns align across groups

- [ ] **Step 3: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add examples/samples/Tables/Grouped\ View.dash.yaml
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: add sortable column config tab to Grouped View example

Refs #188"
```

---

### Task 9: Full Build + Cross-Package Verification

Final verification across all packages.

**Files:** None — verification only.

- [ ] **Step 1: Full build**

Run: `yarn build`
Expected: Clean build across all packages.

- [ ] **Step 2: Full typecheck**

Run: `yarn typecheck`
Expected: No errors.

- [ ] **Step 3: Full lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 4: Run all tests**

Run: `yarn workspace @casehubio/pages-table run test && yarn workspace @casehubio/pages-viz run test && yarn workspace @casehubio/pages-ui run test`
Expected: All tests pass.

- [ ] **Step 5: Verify no regressions in pages-table consumers**

Run `ide_find_references` on `TableColumnConfig`, `ColumnRenderer`, `SelectionMode` to verify all consumers import from the correct location (pages-component for base types, pages-table for narrowed types).

- [ ] **Step 6: Commit any fixups**

If any issues found, fix and commit.
