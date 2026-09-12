# Visual YAML Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** TBD — to be filed as epic
**Issue group:** TBD

**Goal:** Build a visual YAML builder for page composition (Phase 1), with
an architecture that extends to agentic AI document types in blocks-ui (Phase 2).

**Architecture:** CST-backed typed facade (`PageDocument`) wraps a live YAML
`Document` object with typed node accessors. A Lit web component builder shell
composes an outline tree, contextual component palette, property panel (reusing
`pages-property-palette`), and collapsible YAML pane (reusing `pages-code-editor`).
Bidirectional sync flows through the facade's `onChange` notifications.

**Tech Stack:** TypeScript, Lit 3, `yaml` library (parseDocument/Document API),
Zod (schema introspection), CodeMirror 6 (via pages-code-editor), Vitest

## Global Constraints

- TypeScript strict mode — all new packages use `@casehubio/pages-tsconfig`
- Yarn workspace — new packages added to root `packages/` and `package.json` workspaces
- Lit 3 — all web components extend `LitElement`
- `yaml` ^2.7.0 — already a dependency in pages-code-editor
- Vitest — test runner, matching all other packages
- Canonical component YAML format: `{ type, properties }` — never emit shorthand
- Facade holds a live `Document` object — never delegates to string-based `yaml-edits.ts`
- Zod → FieldSchema conversion — property panel consumes `FieldSchema`, not `z.ZodType`
- a11y mixins from `@casehubio/pages-primitives` — `RovingTabindexMixin`, `FocusTrapMixin`, `LiveRegionMixin`, `KeyboardShortcutMixin`

---

## Batch 1: Document Facade — `pages-document`

The facade package is the foundation. Everything else builds on it. After this
batch, the facade is fully functional with tests — the builder UI can begin.

### Task 1: PageDocument Core + Node Types

Create the `pages-document` package with `PageDocument`, `PageNode`, `RowNode`,
`ColumnNode`, `DatasetNode`, and `NavTreeNode`.

**Files:**
- Create: `packages/pages-document/package.json`
- Create: `packages/pages-document/tsconfig.json`
- Create: `packages/pages-document/src/index.ts`
- Create: `packages/pages-document/src/page-document.ts`
- Create: `packages/pages-document/src/types.ts`
- Create: `packages/pages-document/src/page-document.test.ts`
- Modify: `package.json` (root — add workspace entry)
- Modify: `tsconfig.json` (root — add project reference)

**Interfaces:**
- Produces: `PageDocument` class — `parse(yaml)`, `empty()`, `toString()`, `getPages()`, `getDatasets()`, `getNavTree()`, `getProperties()`, `addPage(name)`, `removePage(index)`, `addDataset(uuid, defaults?)`, `removeDataset(index)`, `onChange(listener)`, `undo()`, `redo()`
- Produces: `PageNode` — `name`, `getLayoutMode()`, `getRows()`, `getColumns()`, `getComponents()`, `addRow()`, `addComponent(type, props?)`, `removeChild(index)`
- Produces: `RowNode` — `getColumns()`, `addColumn(span?)`, `removeColumn(index)`
- Produces: `ColumnNode` — `span`, `getComponents()`, `addComponent(type, props?)`, `removeComponent(index)`
- Produces: `DatasetNode` — `uuid`, `name`, `getSource()`, `getColumns()`, `addColumn(id, type)`, `removeColumn(index)`, `getProperties()`, `setProperty(key, value)`
- Produces: `NavTreeNode` — `type`, `id`, `page`, `children`, `setPage(page)`, `addChild(item)`, `removeChild(index)`
- Produces: `Diagnostic` interface — `severity`, `message`, `range`

- [ ] **Step 1: Create package scaffold**

`packages/pages-document/package.json`:
```json
{
  "name": "@casehubio/pages-document",
  "version": "1.0.0-SNAPSHOT",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@casehubio/pages-schema": "workspace:*",
    "@casehubio/pages-data": "workspace:*",
    "@casehubio/pages-component": "workspace:*",
    "yaml": "^2.7.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "vitest": "^3.2.1",
    "typescript": "^5.6.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/pages-document/tsconfig.json`:
```json
{
  "extends": "../pages-tsconfig/tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": ".typecheck" },
  "include": ["src"],
  "references": [
    { "path": "../pages-schema" },
    { "path": "../pages-data" },
    { "path": "../pages-component" }
  ]
}
```

Add `"packages/pages-document"` to root `package.json` workspaces array.
Add `{ "path": "packages/pages-document" }` to root `tsconfig.json` references.

Run: `yarn install`

- [ ] **Step 2: Write types.ts**

`packages/pages-document/src/types.ts`:
```typescript
export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export interface Diagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly range: Range;
}

export type LayoutMode = 'rows' | 'columns' | 'flat';

export type Unsubscribe = () => void;
```

- [ ] **Step 3: Write failing tests for PageDocument core**

`packages/pages-document/src/page-document.test.ts` — start with round-trip,
page CRUD, dataset CRUD, undo/redo:

```typescript
import { describe, it, expect } from 'vitest';
import { PageDocument } from './page-document.js';

const MINIMAL_PAGE = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello
`;

describe('PageDocument', () => {
  describe('parse and round-trip', () => {
    it('preserves YAML formatting on round-trip', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      expect(doc.toString()).toBe(MINIMAL_PAGE);
    });

    it('creates empty document', () => {
      const doc = PageDocument.empty();
      expect(doc.getPages()).toHaveLength(0);
      expect(doc.getDatasets()).toHaveLength(0);
    });

    it('parses invalid YAML without throwing', () => {
      const doc = PageDocument.parse('pages:\n  - [invalid: yaml: here');
      expect(doc.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('pages', () => {
    it('lists pages', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const pages = doc.getPages();
      expect(pages).toHaveLength(1);
      expect(pages[0]!.name).toBe('Overview');
    });

    it('adds a page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      expect(doc.getPages()).toHaveLength(2);
      expect(doc.getPages()[1]!.name).toBe('Dashboard');
    });

    it('removes a page', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      doc.removePage(0);
      expect(doc.getPages()).toHaveLength(1);
      expect(doc.getPages()[0]!.name).toBe('Dashboard');
    });
  });

  describe('datasets', () => {
    it('adds a dataset', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addDataset('sales_tx');
      expect(doc.getDatasets()).toHaveLength(1);
      expect(doc.getDatasets()[0]!.uuid).toBe('sales_tx');
    });
  });

  describe('undo/redo', () => {
    it('undoes a mutation', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      expect(doc.getPages()).toHaveLength(2);
      doc.undo();
      expect(doc.getPages()).toHaveLength(1);
    });

    it('redoes after undo', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      doc.addPage('Dashboard');
      doc.undo();
      doc.redo();
      expect(doc.getPages()).toHaveLength(2);
    });
  });

  describe('onChange', () => {
    it('fires on mutation', () => {
      const doc = PageDocument.parse(MINIMAL_PAGE);
      const calls: string[] = [];
      doc.onChange((yaml) => calls.push(yaml));
      doc.addPage('Dashboard');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain('Dashboard');
    });
  });
});
```

- [ ] **Step 4: Run tests — verify they fail**

Run: `yarn workspace @casehubio/pages-document test`
Expected: FAIL — `page-document.ts` not implemented

- [ ] **Step 5: Implement PageDocument**

Implement `packages/pages-document/src/page-document.ts` with:
- `parseDocument()` from the `yaml` library to create the live `Document`
- Node classes that hold CST paths and delegate reads/writes to the `Document`
- Undo stack as `string[]` snapshots (pre-mutation `toString()`)
- `onChange` as a simple listener array

The implementation must handle:
- `getPages()` → reads `Document.getIn(['pages'])`, wraps each item as `PageNode`
- `addPage(name)` → pushes undo snapshot, calls `Document.addIn(['pages'], {name, components: []})`
- `getDatasets()` → reads `Document.getIn(['datasets'])`, wraps as `DatasetNode`
- `PageNode.getLayoutMode()` → inspects which key exists (`rows`, `columns`, or `components`)
- `PageNode.getRows()` → reads the `rows` seq, wraps each as `RowNode`
- `RowNode.getColumns()` → reads `columns` seq
- `ColumnNode.getComponents()` → reads `components` seq, wraps as `ComponentNode`
- Invalid YAML: catch parse errors, populate `diagnostics`, return partial document

- [ ] **Step 6: Run tests — verify they pass**

Run: `yarn workspace @casehubio/pages-document test`
Expected: PASS

- [ ] **Step 7: Write tests for PageNode layout modes and RowNode/ColumnNode**

Add tests to `page-document.test.ts`:

```typescript
const ROWS_PAGE = `pages:
- name: Overview
  rows:
  - columns:
    - span: 6
      components:
      - type: bar-chart
        properties:
          subtype: column
    - span: 6
      components:
      - type: pie-chart
`;

describe('PageNode layout', () => {
  it('detects rows layout mode', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    expect(doc.getPages()[0]!.getLayoutMode()).toBe('rows');
  });

  it('reads rows and columns', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const page = doc.getPages()[0]!;
    const rows = page.getRows();
    expect(rows).toHaveLength(1);
    const cols = rows[0]!.getColumns();
    expect(cols).toHaveLength(2);
    expect(cols[0]!.span).toBe(6);
    expect(cols[0]!.getComponents()).toHaveLength(1);
    expect(cols[0]!.getComponents()[0]!.type).toBe('bar-chart');
  });

  it('adds a row', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const page = doc.getPages()[0]!;
    page.addRow();
    expect(page.getRows()).toHaveLength(2);
  });

  it('adds a component to a column', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
    col.addComponent('metric', { subtype: 'card' });
    expect(col.getComponents()).toHaveLength(2);
    expect(col.getComponents()[1]!.type).toBe('metric');
  });

  it('preserves formatting after column mutation', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
    col.getComponents()[0]!.setProperty('title', 'Revenue');
    const yaml = doc.toString();
    expect(yaml).toContain('bar-chart');
    expect(yaml).toContain('title: Revenue');
  });
});
```

- [ ] **Step 8: Implement RowNode, ColumnNode, DatasetNode**

Extend `page-document.ts` with the remaining node types. All follow the
same pattern: hold a path into the Document, delegate reads/writes.

- [ ] **Step 9: Run full test suite — verify green**

Run: `yarn workspace @casehubio/pages-document test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/pages-document/ package.json tsconfig.json
git commit -m "feat(pages-document): PageDocument facade with typed node API

CST-backed facade over YAML Document providing typed access to pages,
rows, columns, datasets, components, and navigation. Format-preserving
mutations with undo/redo and onChange notifications.

no-issue: visual YAML builder foundation"
```

### Task 2: ComponentNode + Container Descriptors + Schema Bridge

Add `ComponentNode` with container child descriptors, Zod→FieldSchema
conversion, and move operations.

**Files:**
- Create: `packages/pages-document/src/container-descriptors.ts`
- Create: `packages/pages-document/src/zod-to-fieldschema.ts`
- Create: `packages/pages-document/src/zod-to-fieldschema.test.ts`
- Create: `packages/pages-document/src/container-descriptors.test.ts`
- Modify: `packages/pages-document/src/page-document.ts` (ComponentNode)
- Modify: `packages/pages-document/src/page-document.test.ts`
- Modify: `packages/pages-document/src/index.ts`

**Interfaces:**
- Consumes: `PageDocument`, `PageNode`, `ColumnNode` from Task 1
- Consumes: `componentSchemaRegistry` from `@casehubio/pages-schema`
- Consumes: `FieldSchema` from `@casehubio/pages-component`
- Produces: `ComponentNode` — `type`, `getProperties()`, `setProperty(key, value)`, `removeProperty(key)`, `getSchema(): FieldSchema`, `isContainer()`, `getChildren(): ContainerChildren`, `addChild(slotName, type, props?)`, `removeChild(slotName, index)`, `moveToIndex(parent, index)`, `duplicate()`
- Produces: `ContainerChildDescriptor`, `SlotDescriptor`, `ContainerChildren`
- Produces: `zodToFieldSchema(schema: z.ZodType): FieldSchema`

- [ ] **Step 1: Write container-descriptors.ts**

```typescript
export interface ContainerChildDescriptor {
  type: string;
  slots: SlotDescriptor[];
}

export type SlotDescriptor =
  | { kind: 'named-record'; yamlKey: string; childKey: 'components' }
  | { kind: 'array'; yamlKey: string }
  | { kind: 'nested-array'; yamlKey: string; childKey: string };

export interface ContainerChildren {
  slots: Record<string, import('./page-document.js').ComponentNode[]>;
  descriptor: ContainerChildDescriptor;
}

export const CONTAINER_DESCRIPTORS: ContainerChildDescriptor[] = [
  { type: 'tabs', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'pills', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'accordion', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'sidebar', slots: [
    { kind: 'array', yamlKey: 'sidebar' },
    { kind: 'array', yamlKey: 'content' },
  ]},
  { type: 'split', slots: [{ kind: 'nested-array', yamlKey: 'split', childKey: 'children' }] },
  { type: 'form-scope', slots: [{ kind: 'nested-array', yamlKey: 'form-scope', childKey: 'components' }] },
  { type: 'carousel', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'stack', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'menu', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'tree', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
];

export function getContainerDescriptor(type: string): ContainerChildDescriptor | undefined {
  return CONTAINER_DESCRIPTORS.find(d => d.type === type);
}
```

- [ ] **Step 2: Write failing tests for container descriptors**

```typescript
import { describe, it, expect } from 'vitest';
import { getContainerDescriptor } from './container-descriptors.js';
import { PageDocument } from './page-document.js';

const TABS_PAGE = `pages:
- name: Overview
  components:
  - type: tabs
    tabs:
      Tab 1:
        components:
        - type: title
          properties:
            text: First
      Tab 2:
        components:
        - type: title
          properties:
            text: Second
`;

describe('container descriptors', () => {
  it('returns descriptor for tabs', () => {
    const desc = getContainerDescriptor('tabs');
    expect(desc).toBeDefined();
    expect(desc!.slots[0]!.kind).toBe('named-record');
  });

  it('returns undefined for non-container', () => {
    expect(getContainerDescriptor('bar-chart')).toBeUndefined();
  });

  it('reads tabs children via ComponentNode', () => {
    const doc = PageDocument.parse(TABS_PAGE);
    const tabs = doc.getPages()[0]!.getComponents()[0]!;
    expect(tabs.isContainer()).toBe(true);
    const children = tabs.getChildren();
    expect(Object.keys(children.slots)).toContain('Tab 1');
    expect(Object.keys(children.slots)).toContain('Tab 2');
    expect(children.slots['Tab 1']!).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Write failing tests for Zod→FieldSchema**

```typescript
import { describe, it, expect } from 'vitest';
import { zodToFieldSchema } from './zod-to-fieldschema.js';
import { barChartPropsSchema } from '@casehubio/pages-schema';

describe('zodToFieldSchema', () => {
  it('converts bar-chart schema to FieldSchema', () => {
    const fs = zodToFieldSchema(barChartPropsSchema);
    expect(fs.type).toBe('object');
    expect(fs.properties).toBeDefined();
    expect(fs.properties!['subtype']).toBeDefined();
    expect(fs.properties!['subtype']!.enum).toContain('column');
  });

  it('handles optional fields', () => {
    const fs = zodToFieldSchema(barChartPropsSchema);
    expect(fs.required).toBeUndefined();
  });

  it('handles nested objects', () => {
    const fs = zodToFieldSchema(barChartPropsSchema);
    expect(fs.properties!['xAxis']).toBeDefined();
    expect(fs.properties!['xAxis']!.type).toBe('object');
  });
});
```

- [ ] **Step 4: Run tests — verify they fail**

Run: `yarn workspace @casehubio/pages-document test`
Expected: FAIL

- [ ] **Step 5: Implement zodToFieldSchema**

`packages/pages-document/src/zod-to-fieldschema.ts`:

Walk the Zod type tree, converting each node to a `FieldSchema` property:
- `ZodString` → `{ type: 'string' }`
- `ZodNumber` → `{ type: 'number' }`
- `ZodBoolean` → `{ type: 'boolean' }`
- `ZodEnum` → `{ type: 'string', enum: [...values] }`
- `ZodObject` → `{ type: 'object', properties: {...} }`
- `ZodArray` → `{ type: 'array', items: {...} }`
- `ZodOptional` → unwrap inner, no `required` entry
- `ZodDefault` → unwrap inner
- `ZodRecord` → `{ type: 'object' }` (free-form)
- `ZodUnion` → `{ oneOf: [...] }`
- `ZodIntersection` → merge left and right properties

Cache results per schema identity (WeakMap keyed on ZodType).

- [ ] **Step 6: Implement ComponentNode**

Add to `page-document.ts`:
- `ComponentNode` class holding a path, reading `type` from the CST, reading/writing properties
- `getSchema()` looks up `componentSchemaRegistry.get(type)`, converts via `zodToFieldSchema`, caches
- `isContainer()` checks `getContainerDescriptor(type) !== undefined`
- `getChildren()` reads container slots per the descriptor
- `addChild(slotName, type, props?)` appends to the correct YAML key
- `moveToIndex(parent, index)` removes from source, inserts at target (single undo step)
- `duplicate()` clones the YAML subtree and inserts after current position

- [ ] **Step 7: Write tests for ComponentNode move and duplicate**

```typescript
describe('ComponentNode', () => {
  it('moves component within column', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
    col.addComponent('metric');
    const component = col.getComponents()[0]!;
    component.moveToIndex({ path: col.path, slot: undefined }, 1);
    expect(col.getComponents()[0]!.type).toBe('metric');
    expect(col.getComponents()[1]!.type).toBe('bar-chart');
  });

  it('duplicates component', () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    const comp = doc.getPages()[0]!.getComponents()[0]!;
    comp.duplicate();
    expect(doc.getPages()[0]!.getComponents()).toHaveLength(2);
  });

  it('move is a single undo step', () => {
    const doc = PageDocument.parse(ROWS_PAGE);
    const col = doc.getPages()[0]!.getRows()[0]!.getColumns()[0]!;
    col.addComponent('metric');
    const comp = col.getComponents()[0]!;
    comp.moveToIndex({ path: col.path }, 1);
    doc.undo();
    expect(col.getComponents()[0]!.type).toBe('bar-chart');
  });
});
```

- [ ] **Step 8: Run full tests — verify green**

Run: `yarn workspace @casehubio/pages-document test`
Expected: PASS

- [ ] **Step 9: Write index.ts exports**

```typescript
export { PageDocument } from './page-document.js';
export type {
  PageNode, RowNode, ColumnNode, DatasetNode,
  ComponentNode, NavTreeNode,
} from './page-document.js';
export type { Diagnostic, Position, Range, LayoutMode, Unsubscribe } from './types.js';
export type {
  ContainerChildDescriptor, SlotDescriptor, ContainerChildren,
} from './container-descriptors.js';
export { getContainerDescriptor, CONTAINER_DESCRIPTORS } from './container-descriptors.js';
export { zodToFieldSchema } from './zod-to-fieldschema.js';
```

- [ ] **Step 10: Commit**

```bash
git add packages/pages-document/
git commit -m "feat(pages-document): ComponentNode, container descriptors, Zod→FieldSchema

ComponentNode with typed property access, container child descriptor
registry for tabs/sidebar/split/form-scope, Zod→FieldSchema conversion
for property palette integration, and move/duplicate operations.

no-issue: visual YAML builder foundation"
```

---

## Batch 2: Builder UI Foundation — `pages-builder`

After this batch, the builder has a working outline tree and component
palette — the core navigation and discovery UI.

### Task 3: Package Scaffold + Component Catalog + Outline Tree

Create `pages-builder` with the component catalog registry and the
outline tree component.

**Files:**
- Create: `packages/pages-builder/package.json`
- Create: `packages/pages-builder/tsconfig.json`
- Create: `packages/pages-builder/src/index.ts`
- Create: `packages/pages-builder/src/catalog/component-catalog.ts`
- Create: `packages/pages-builder/src/catalog/component-catalog.test.ts`
- Create: `packages/pages-builder/src/catalog/palette-context.ts`
- Create: `packages/pages-builder/src/tree/builder-tree.ts`
- Create: `packages/pages-builder/src/tree/builder-tree.test.ts`
- Modify: `package.json` (root — add workspace entry)
- Modify: `tsconfig.json` (root — add project reference)

**Interfaces:**
- Consumes: `PageDocument`, `PageNode`, `ComponentNode` from Batch 1
- Consumes: `componentSchema` from `@casehubio/pages-schema` (the discriminated union — enumerates valid types)
- Produces: `ComponentCatalogEntry` — `type`, `label`, `category`, `icon`, `description`, `defaultProps`, `contextRelevance(ctx)`
- Produces: `PaletteContext` — `parentType`, `acceptsComponents`, `availableDatasets`, `siblingTypes`
- Produces: `COMPONENT_CATALOG` — the full static catalog array
- Produces: `PagesBuilderTree` — Lit component `<pages-builder-tree>`

- [ ] **Step 1: Create package scaffold**

`packages/pages-builder/package.json`:
```json
{
  "name": "@casehubio/pages-builder",
  "version": "1.0.0-SNAPSHOT",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@casehubio/pages-document": "workspace:*",
    "@casehubio/pages-schema": "workspace:*",
    "@casehubio/pages-property-palette": "workspace:*",
    "@casehubio/pages-code-editor": "workspace:*",
    "@casehubio/pages-component": "workspace:*",
    "@casehubio/pages-primitives": "workspace:*",
    "lit": "^3.3.3"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "jsdom": "^26.0.0",
    "vitest": "^3.2.1",
    "typescript": "^5.6.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Add workspace entry and project reference to root configs.

Run: `yarn install`

- [ ] **Step 2: Write component catalog**

`packages/pages-builder/src/catalog/component-catalog.ts`:

Build the static catalog from the `componentSchema` discriminated union's
option keys (not from `componentSchemaRegistry` — see spec Known Issues).
Each entry has category, label, icon, description, and sensible `defaultProps`.

Categories:
- Layout: grid, columns, rows, stack, tabs, pills, sidebar, tree, menu, accordion, carousel
- Charts: bar-chart, line-chart, area-chart, pie-chart, scatter-chart, bubble-chart, timeseries, heatmap-chart, treemap-chart, density-heatmap
- Tables: data-table, grid-table, grouped-view
- Metrics: metric, meter, metric-grid, badge, countdown
- Forms: input, number-input, select, checkbox, date-picker, textarea, schema-form, action-button, form-scope, submit-button
- Content: panel, html, markdown, title, lazy-page, page
- Workbench: split, dock-bar, host-panel, floating-workspace
- Data: selector, map, timeline, graph, event-timeline, iframe-plugin

- [ ] **Step 3: Write palette context + contextual relevance**

`packages/pages-builder/src/catalog/palette-context.ts`:

```typescript
export interface PaletteContext {
  parentType: string | undefined;
  acceptsComponents: boolean;
  availableDatasets: string[];
  siblingTypes: string[];
}

export type ContextRelevance = 'promoted' | 'normal' | 'hidden' | 'needs-prereq';
```

The `contextRelevance` function on each catalog entry returns:
- `promoted` — form components inside `form-scope`, metrics inside `metric-grid`
- `needs-prereq` — data components when `availableDatasets` is empty
- `hidden` — entries invalid at the insertion point (e.g. page-level-only types inside a column)
- `normal` — everything else

- [ ] **Step 4: Write catalog tests**

```typescript
import { describe, it, expect } from 'vitest';
import { COMPONENT_CATALOG, getFilteredCatalog } from './component-catalog.js';
import type { PaletteContext } from './palette-context.js';

describe('ComponentCatalog', () => {
  it('has entries for all component types', () => {
    expect(COMPONENT_CATALOG.length).toBeGreaterThan(40);
  });

  it('all entries have required fields', () => {
    for (const entry of COMPONENT_CATALOG) {
      expect(entry.type).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.category).toBeTruthy();
    }
  });

  it('promotes form components inside form-scope', () => {
    const ctx: PaletteContext = {
      parentType: 'form-scope',
      acceptsComponents: true,
      availableDatasets: ['ds1'],
      siblingTypes: [],
    };
    const filtered = getFilteredCatalog(ctx);
    const promoted = filtered.filter(e => e.relevance === 'promoted');
    expect(promoted.some(e => e.entry.type === 'input')).toBe(true);
  });

  it('flags data components when no datasets', () => {
    const ctx: PaletteContext = {
      parentType: undefined,
      acceptsComponents: true,
      availableDatasets: [],
      siblingTypes: [],
    };
    const filtered = getFilteredCatalog(ctx);
    const prereq = filtered.filter(e => e.relevance === 'needs-prereq');
    expect(prereq.some(e => e.entry.type === 'bar-chart')).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `yarn workspace @casehubio/pages-builder test`
Expected: PASS

- [ ] **Step 6: Write outline tree component**

`packages/pages-builder/src/tree/builder-tree.ts`:

A Lit component that takes a `PageDocument` and renders the tree structure.

```typescript
@customElement('pages-builder-tree')
export class PagesBuilderTree extends LitElement {
  @property({ attribute: false }) document: PageDocument | undefined;
  @property({ attribute: false }) selectedPath: readonly (string | number)[] | undefined;

  // Fires when user clicks a node
  // detail: { path, nodeType: 'page' | 'row' | 'column' | 'component' | 'dataset' | 'nav' }
  @event() 'node-select': CustomEvent;

  // Fires when user drags a node to a new position
  // detail: { sourcePath, targetParentPath, targetIndex }
  @event() 'node-move': CustomEvent;
}
```

The tree renders:
- Top-level sections: Datasets, Pages, Navigation
- Pages expand to show rows → columns → components (or flat components)
- Containers expand to show slot children
- Selected node highlighted
- Drag handles on each node for reordering

- [ ] **Step 7: Write tree rendering tests**

Test that the tree renders the correct structure for a known YAML input.
Use `jsdom` to verify DOM output.

```typescript
describe('PagesBuilderTree', () => {
  it('renders page nodes', async () => {
    const doc = PageDocument.parse(MINIMAL_PAGE);
    const el = document.createElement('pages-builder-tree') as PagesBuilderTree;
    el.document = doc;
    document.body.appendChild(el);
    await el.updateComplete;
    const nodes = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
    expect(nodes.length).toBeGreaterThan(0);
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 8: Run tests — verify green**

Run: `yarn workspace @casehubio/pages-builder test`

- [ ] **Step 9: Commit**

```bash
git add packages/pages-builder/ package.json tsconfig.json
git commit -m "feat(pages-builder): component catalog, palette context, outline tree

Static component catalog with categories, contextual relevance filtering,
and outline tree Lit component rendering PageDocument structure as an
interactive ARIA tree.

no-issue: visual YAML builder UI foundation"
```

---

## Batch 3: Component Palette + Property Panel Integration

After this batch, users can add components from the palette and edit
their properties.

### Task 4: Component Palette

**Files:**
- Create: `packages/pages-builder/src/palette/builder-palette.ts`
- Create: `packages/pages-builder/src/palette/builder-palette.test.ts`

**Interfaces:**
- Consumes: `COMPONENT_CATALOG`, `getFilteredCatalog`, `PaletteContext` from Task 3
- Produces: `PagesBuilderPalette` — Lit component `<pages-builder-palette>`

- [ ] **Step 1: Write palette component**

A modal overlay with category tabs, search filter, and tile grid. Fires
`component-select` event with the selected `ComponentCatalogEntry`.

```typescript
@customElement('pages-builder-palette')
export class PagesBuilderPalette extends LitElement {
  @property({ attribute: false }) context: PaletteContext | undefined;
  @state() private _search = '';
  @state() private _activeCategory: string | undefined;

  // Fires when user selects a component
  // detail: ComponentCatalogEntry
  @event() 'component-select': CustomEvent;
}
```

- [ ] **Step 2: Write palette tests**

Test search filtering, category switching, prerequisite hint display.

- [ ] **Step 3: Run tests — verify green**

- [ ] **Step 4: Commit**

### Task 5: Property Panel Integration + Builder Shell

Wire the property panel (`pages-property-palette`) to the facade's
`ComponentNode.getSchema()` output. Build the shell that composes
tree, palette, property panel, and YAML pane.

**Files:**
- Create: `packages/pages-builder/src/shell/builder-shell.ts`
- Create: `packages/pages-builder/src/shell/yaml-sync.ts`
- Create: `packages/pages-builder/src/shell/builder-shell.test.ts`
- Modify: `packages/pages-builder/src/index.ts`

**Interfaces:**
- Consumes: `PageDocument`, `ComponentNode.getSchema()` from Batch 1
- Consumes: `PagesBuilderTree` from Task 3
- Consumes: `PagesBuilderPalette` from Task 4
- Consumes: `PagesPropertyPalette` from `@casehubio/pages-property-palette`
- Consumes: `PagesCodeEditor` from `@casehubio/pages-code-editor`
- Produces: `PagesBuilderShell` — Lit component `<pages-builder-shell>`

- [ ] **Step 1: Write yaml-sync coordinator**

`packages/pages-builder/src/shell/yaml-sync.ts`:

Manages bidirectional sync between the facade and the code editor:
- Visual→text: facade `onChange` pushes to CodeMirror (diff-applied)
- Text→visual: CodeMirror `input` event triggers debounced (150ms) re-parse
- Suppresses echo: visual-triggered text updates don't re-trigger visual updates

```typescript
export class YamlSync {
  constructor(
    private facade: PageDocument,
    private editor: PagesCodeEditor,
  ) {}

  connect(): void { /* wire onChange + input listeners */ }
  disconnect(): void { /* remove listeners */ }
}
```

- [ ] **Step 2: Write builder shell**

The shell composes all panels:
- Left: `<pages-builder-tree>` with selection state
- Right: `<pages-property-palette>` wired to selected node's schema
- Bottom: collapsible `<pages-code-editor>` with YAML sync
- Toolbar: +Page, +Dataset, Undo, Redo, Preview
- Palette: modal overlay triggered by tree "+" buttons

Selection flow:
1. Tree fires `node-select` → shell updates `selectedPath`
2. Shell reads `ComponentNode.getSchema()` → builds `PropertyPaletteSource`
3. `PropertyPaletteSource.onChange` → calls `ComponentNode.setProperty()`
4. Facade fires `onChange` → tree re-renders, YAML pane updates

Type switcher:
- Dropdown at top of property panel showing current component type
- Changing type → creates new component with new type + defaults, removes old

Dataset picker:
- For data components, `lookup.uuid` field → dropdown from `document.getDatasets()`

- [ ] **Step 3: Write shell integration tests**

Test the full flow: create shell with a PageDocument, verify tree renders,
select a node, verify property panel populates, change a property, verify
YAML updates.

- [ ] **Step 4: Write YAML pane sync tests**

Test bidirectional sync: visual mutation → YAML text changes; YAML text
edit → tree updates. Test debounce. Test invalid YAML handling.

- [ ] **Step 5: Run full test suite — verify green**

Run: `yarn workspace @casehubio/pages-builder test`

- [ ] **Step 6: Export all public components from index.ts**

```typescript
export { PagesBuilderShell } from './shell/builder-shell.js';
export { PagesBuilderTree } from './tree/builder-tree.js';
export { PagesBuilderPalette } from './palette/builder-palette.js';
export { COMPONENT_CATALOG, getFilteredCatalog } from './catalog/component-catalog.js';
export type { ComponentCatalogEntry } from './catalog/component-catalog.js';
export type { PaletteContext, ContextRelevance } from './catalog/palette-context.js';
```

- [ ] **Step 7: Commit**

```bash
git add packages/pages-builder/
git commit -m "feat(pages-builder): builder shell with palette, property panel, YAML sync

Builder shell orchestrating outline tree, component palette, property
panel (via pages-property-palette), and collapsible YAML pane (via
pages-code-editor) with bidirectional sync through the PageDocument
facade.

no-issue: visual YAML builder complete UI"
```

---

## Batch 4: Integration + Edit Mode

After this batch, the builder is usable from the pages-runtime edit mode.

### Task 6: Runtime Integration + End-to-End Testing

Wire the builder shell into the pages-runtime edit mode and verify
the full flow with Playwright.

**Files:**
- Modify: `packages/pages-runtime/src/edit-state.ts` (add builder toggle)
- Modify: `packages/pages-runtime/src/site.ts` (mount builder shell in edit mode)
- Create: `test/e2e/builder.spec.ts` (Playwright)

**Interfaces:**
- Consumes: `PagesBuilderShell` from Task 5
- Consumes: `loadSite` from `@casehubio/pages-runtime`

- [ ] **Step 1: Add builder shell to edit mode**

When `editMode: true` is passed to `loadSite()`, mount `<pages-builder-shell>`
alongside the rendered page. The builder receives the same YAML source.

- [ ] **Step 2: Write Playwright e2e tests**

```typescript
test('build a page visually and verify YAML', async ({ page }) => {
  // Navigate to edit mode
  // Add a component via palette
  // Verify tree shows new component
  // Open YAML pane
  // Verify YAML contains the component
});

test('edit YAML and verify tree updates', async ({ page }) => {
  // Open YAML pane
  // Type a new component in YAML
  // Verify tree shows the new component
});
```

- [ ] **Step 3: Run e2e tests**

Run: `npx playwright test test/e2e/builder.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/pages-runtime/ test/e2e/
git commit -m "feat(pages-runtime): integrate visual builder in edit mode

Mount pages-builder-shell in edit mode with bidirectional YAML sync.
Playwright e2e tests verify the full build→edit→preview flow.

no-issue: visual YAML builder runtime integration"
```

---

## Phase 2 Extension Points (Not Planned in Detail)

The architecture supports these future extensions without rework:

1. **blocks-ui document facades** — `blocks-ui/packages/lsp-schemas/` already
   has format registrations and Zod schemas for case-definition, org, HTN, SWF.
   New facade classes (`CaseDocument`, `OrgDocument`) follow the same
   `PageDocument` pattern — hold a `Document`, expose typed node API.

2. **blocks-ui component catalog** — `blocks-ui/packages/blocks-ui-schema/`
   has a `BlocksComponentRegistry` with 50+ domain components. These extend
   the builder palette's `COMPONENT_CATALOG` when the builder is loaded in
   an application that imports blocks-ui.

3. **Project graph** — a `ProjectGraph` class aggregates document facades
   across files, validates cross-references, and supports rename refactoring.
   Symbol extractors already exist in `blocks-ui/packages/lsp-schemas/src/formats/`.

4. **Archetype scaffolding** — templates in `eidos/examples/org-scenarios/`,
   `blocks/agentic-yaml/src/test/resources/examples/`, and
   `engine/examples/yaml/` provide starter projects.

## References

- [2026-09-12-visual-yaml-builder-design.md] — design spec this plan implements
- `packages/pages-lsp/src/refactoring/yaml-edits.ts` — existing CST primitives
- `packages/pages-schema/src/document-schema.ts:33` — componentSchema discriminated union
- `packages/pages-schema/src/schema-registry.ts:26` — componentSchemaRegistry
- `packages/pages-component/src/model/form-input-types.ts:55` — FieldSchema interface
- `packages/pages-property-palette/src/palette/pages-property-palette.ts` — property panel
- `packages/pages-code-editor/src/pages-code-editor.ts` — CodeMirror editor
- `packages/pages-ui/src/parser/component-desugar.ts` — container desugar logic
- `blocks-ui/packages/lsp-schemas/src/formats/` — case-definition, org, htn, swf formats
- `blocks-ui/packages/blocks-ui-schema/src/registry.ts` — BlocksComponentRegistry
