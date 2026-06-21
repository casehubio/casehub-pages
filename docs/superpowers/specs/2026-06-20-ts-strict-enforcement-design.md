# TypeScript Strict Enforcement Design

**Issue:** casehubio/casehub-pages#1
**Date:** 2026-06-20
**Status:** Design

## Problem

The monorepo has two tiers of TypeScript strictness. Five core packages define `strict: true`
with extra flags. Five packages inherit from a weaker base config with only `noImplicitAny`,
`strictNullChecks`, and `noImplicitThis`. Three more packages are standalone strict but
disconnected from any shared config.

No monorepo-wide type check exists. Webpack's `transpileOnly: true` means type errors in
iframe components are invisible to CI. Worse, all five core packages exclude test files from
their tsconfig (`"exclude": ["**/*.test.ts"]`), so even `tsc --noEmit` would not check the
files where all type-safety escape hatches live.

119 `as any` escape hatches exist across test files, plus 23 `as unknown as` casts in
production code (20 in `builders.ts`, 2 in `layout.ts`, 1 in `type-guards.ts`). Both
directions are caused by the same root: `Component.props: Record<string, unknown>` erases
type information. Builders cast typed props DOWN to `Record<string, unknown>` when
constructing components. Tests cast back UP via `as any` to recover the erased types.
The generic `Component<T, P>` fixes both directions — builders return
`Component<"grid", GridProps>` (no cast to erase), tests receive typed components (no cast
to recover).

Additionally, pages-viz (the renderer) depends on pages-ui (the parser) — both for types
AND for the runtime function `isFixedOptions`. This dependency exists solely because the
props type definitions and their type guards live in pages-ui. The renderer should not
depend on the parser.

### Current tsconfig breakdown

| Category | Count | Packages |
|----------|-------|----------|
| Standalone strict (core) | 5 | pages-data, pages-ui, pages-viz, pages-component, pages-runtime |
| Extending weaker base | 5 | pages-iframe-api, pages-iframe-dev, pages-echarts-base, pages-component-echarts, pages-component-svg-heatmap |
| Standalone strict (non-core) | 2 | pages-component-llm-prompter, examples |

### Existing infrastructure: ComponentTypeRegistry

The codebase already has the building blocks for typed component access:

- `ComponentTypeRegistry` in `pages-component/src/model/type-guards.ts` — maps layout/content
  type strings to their props interfaces
- Extended `ComponentTypeRegistry` in `pages-ui/src/model/type-guards.ts` — extends the base
  registry with data component and form input type mappings
- `getProps<T>()` in pages-component — runtime type-checked props extraction with generic
  constraint `T extends keyof ComponentTypeRegistry`
- Cast-widened `getProps` re-export in pages-ui (line 78) — `as` cast to widen the generic
  constraint to include chart/data/form types not in the base registry

The split registry forces the cast. This cast is exactly the kind of type hole this spec
exists to close.

Type guards already narrow props — e.g. `isBarChart(c): c is Component & { props: BarChartProps }`.
What they don't narrow is the `type` field to a string literal, preventing exhaustive
`switch` checking. The generic `Component<T, P>` adds literal-type narrowing on top of
the existing props narrowing.

### `as any` inventory (119 instances, all in test files)

| Category | Count | Root cause |
|----------|-------|------------|
| Component type erasure (parser/builder output props) | 59 | `Component.props: Record<string, unknown>` erases type |
| Union narrowing (DataSetOp fields) | 22 | Tests don't use existing `type` discriminator |
| Branded type construction (`"ds1" as DataSetId`) | 22 | No factory functions for branded types |
| DOM access (custom element querySelector) | 6 | `HTMLElementTagNameMap` not extended |
| Mock functions (mockFetch signature) | 5 | Untyped mock construction |
| Incomplete test fixtures (partial objects) | 3 | No test factories |
| Private API testing | 2 | Asserting methods don't exist |

## Architecture: Layered Type Ownership

### Current State

```
pages-data       (no @casehub deps)         — datasets, ops, lookups
pages-component  (no @casehub deps)         — Component interface, layout props, base registry
pages-ui         → pages-component, data    — parser, data component props, form input props,
                                              extended registry, cast-widened getProps
pages-viz        → pages-data, pages-ui     — renderers (depends on parser for props types
                                              AND runtime isFixedOptions)
pages-runtime    → everything               — orchestrator
```

### Target State

```
Layer 0 — Domain Model
  pages-data       (no @casehub deps)              — datasets, ops, lookups
  pages-component  → pages-data                    — Component<T,P>, ALL props, unified registry,
                                                     getProps (no cast), type guards, isFixedOptions

Layer 1 — Transforms (depend on Layer 0, NOT on each other)
  pages-ui         → pages-component, pages-data   — parser
  pages-viz        → pages-component, pages-data   — renderers

Layer 2 — Orchestration
  pages-runtime    → everything                    — orchestrator
```

### What Moves

**From pages-ui to pages-component:**

| File | Types | Notes |
|------|-------|-------|
| `model/displayer-types.ts` | `DataComponentCommon`, `ChartSettings`, `BarChartProps`, `LineChartProps`, `AreaChartProps`, `PieChartProps`, `ScatterChartProps`, `BubbleChartProps`, `TimeseriesProps`, `TableProps`, `MetricProps`, `MeterProps`, `SelectorProps`, `MapProps`, `IframePluginProps` | |
| `model/form-input-types.ts` | `FormInputCommon`, `TextInputProps`, `NumberInputProps`, `DropdownProps`, `CheckboxProps`, `DatePickerProps`, `TextareaProps`, `FixedOptions`, `DataSetOptions`, `isFixedOptions()` | `isFixedOptions` is a **runtime value import** in pages-viz (`CasehubDropdown.ts:3`), not just a type — the move eliminates pages-viz's last runtime dependency on pages-ui |
| `model/page-types.ts` (partial) | `PageProps`, `PageSettings`, `DataComponentDefaults`, `LookupDefaults`, `DataSetDefaults`, `DataScope`, `DataScopeRef`, `SaveConfig` | Component-level page types. `page-types.ts` splits: these move to pages-component. `Site`, `ViewState`, `DeepLink`, `DrillDownStep`, `LayoutOverride` stay in pages-ui — they are runtime/orchestration concepts. |
| `model/type-guards.ts` (data/form guards) | `isBarChart`, `isTable`, `isMetric`, `isDropdown`, etc. + extended `ComponentTypeRegistry` | Unified into the base registry — no split, no cast |

**What happens to pages-ui's getProps re-export:**

The cast-widened re-export at pages-ui line 78:
```typescript
export const getProps = baseGetProps as <T extends keyof ComponentTypeRegistry>(
  component: Component, type: T,
) => ComponentTypeRegistry[T];
```
is eliminated. With all types in pages-component, `getProps` natively handles every component
type. pages-ui re-exports `getProps` from pages-component without any cast.

**New dependency:** pages-component → pages-data (because `DataComponentCommon.lookup` is
`DataSetLookup`, and `DataSetOptions.dataset` is `DataSetId`).

**Removed dependency:** pages-viz no longer depends on pages-ui (neither types nor runtime).

**Build order change:** `data` moves before `component` in `build:packages`.

pages-ui permanently re-exports all component types from its public API — it is a convenience
barrel that presents the full component model plus parsing. Consumers can import from either
`@casehub/pages-component` (just types) or `@casehub/pages-ui` (types + parser + DSL). The
types are defined in and owned by pages-component.

## Component<T, P> Type System

### Generic Component

```typescript
// pages-component/src/model/types.ts
export interface Component<
  T extends string = string,
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly type: T;
  readonly id?: string;
  readonly props?: Readonly<P>;
  readonly style?: Readonly<Record<string, string>>;
  readonly access?: AccessControl;
  readonly slots?: Readonly<Record<string, readonly Component[]>>;
  readonly items?: readonly GridItem[];
}
```

The default parameters serve the polymorphic-container use case — layout renderers, tree
walkers, and slot managers handle any component without caring about specific props types.
Code that iterates `Component[]` trees works with the defaults. Code that needs typed
props access narrows via type guards or `getProps`.

### Unified ComponentTypeRegistry

The existing `ComponentTypeRegistry` in pages-component is expanded to include all
component types (currently split across pages-component and pages-ui):

```typescript
// pages-component/src/model/type-guards.ts (expanded)
export interface ComponentTypeRegistry {
  // Layout (already present)
  "grid": GridProps;
  "columns": ColumnsProps;
  // ... all existing layout types

  // Data components (moved from pages-ui)
  "bar-chart": BarChartProps;
  "line-chart": LineChartProps;
  "area-chart": AreaChartProps;
  "pie-chart": PieChartProps;
  "scatter-chart": ScatterChartProps;
  "bubble-chart": BubbleChartProps;
  "timeseries": TimeseriesProps;
  "table": TableProps;
  "metric": MetricProps;
  "meter": MeterProps;
  "selector": SelectorProps;
  "map": MapProps;
  "iframe-plugin": IframePluginProps;

  // Page (moved from pages-ui)
  "page": PageProps;

  // Form inputs (moved from pages-ui)
  "text-input": TextInputProps;
  "number-input": NumberInputProps;
  "dropdown": DropdownProps;
  "checkbox": CheckboxProps;
  "date-picker": DatePickerProps;
  "textarea": TextareaProps;
}

export type ComponentType = keyof ComponentTypeRegistry;
export type TypedComponent<T extends ComponentType> = Component<T, ComponentTypeRegistry[T]>;
```

### Type Guards

Existing guards already narrow props via `c is Component & { props: BarChartProps }`. The
improvement: return `TypedComponent<T>` instead, which narrows BOTH `type` (to a string
literal) and `props` (to the mapped type):

```typescript
// Before (current — already narrows props, but type stays string)
export function isBarChart(
  c: Component,
): c is Component & { props: BarChartProps } {
  return c.type === "bar-chart";
}

// After (narrows type to "bar-chart" literal AND props to BarChartProps)
export function isBarChart(c: Component): c is TypedComponent<"bar-chart"> {
  return c.type === "bar-chart";
}
```

On variables typed as `TypedComponent<ComponentType>`, this enables exhaustive
`switch(c.type)` checking — TypeScript can verify all component types are handled. On base
`Component` (used in slot iteration and tree walking), narrowing continues to work through
individual type guards — `string` is not a discriminated union, so exhaustive checking
requires the explicit `TypedComponent<ComponentType>` type.

A generic guard covers any registered type:

```typescript
export function isComponentType<T extends ComponentType>(
  c: Component, type: T
): c is TypedComponent<T> {
  return c.type === type;
}
```

`getProps<T>()` is unchanged in signature — it already returns `ComponentTypeRegistry[T]`.
With the unified registry, it handles all types without the cast.

## tsconfig Unification

### Single Authoritative Base

Upgrade `pages-tsconfig/tsconfig.json` to maximum strict:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx"
  }
}
```

**Removed from old base:**
- `removeComments: true` — dropped; comments preserved in output (no behavior change)
- `experimentalDecorators: true` — dropped; verified zero decorator usage anywhere in the
  codebase. TS5 standard decorators differ from experimental; not enabling either since
  none are used.
- `downlevelIteration: true` — subsumed by `target: "ES2022"` (iterators are native)
- `noImplicitAny`, `noImplicitThis`, `strictNullChecks` — subsumed by `strict: true`

All 12 package tsconfigs extend this base. Each overrides only what's genuinely different.

### `target: "ES2022"` — Iframe Component Override

The base sets `target: "ES2022"`. Core packages are consumed by bundlers downstream that
handle their own browser targeting — ES2022 is correct for them.

Iframe components (`pages-component-echarts`, `pages-component-llm-prompter`,
`pages-component-svg-heatmap`) are webpack-bundled and served directly to browsers.
No webpack `target` or browserslist config exists, so webpack defaults to `"web"` (no
syntax downleveling). With `transpileOnly: true`, ts-loader respects the tsconfig `target`
for syntax transformation.

These components override `target` to match their browser requirements:

```json
{
  "extends": "@casehub/pages-tsconfig/tsconfig.json",
  "compilerOptions": {
    "target": "es6"
  }
}
```

### `verbatimModuleSyntax` — Migration

The base enables `verbatimModuleSyntax: true`. This requires:
- `import type` for type-only imports (no erased value imports)
- No `import =` or `export =` syntax

Verified: all 5 packages currently extending the base use namespace imports
(`import * as React from "react"`, `import * as heatmap from "heatmap.js"`) — not
synthetic default imports. The `allowSyntheticDefaultImports: true` declared in
`pages-component-echarts`, `pages-component-svg-heatmap`, and `pages-echarts-base`
tsconfigs is unused and can be removed.

The migration is mechanical: audit each file and change `import { Foo }` to
`import type { Foo }` where `Foo` is used only as a type.

### Test File Type Checking — tsconfig Split

All 5 core packages exclude test files: `"exclude": ["**/*.test.ts"]`. Since every `as any`
instance is in a test file, `tsc --noEmit` with the current tsconfig checks nothing that
matters.

Fix: separate type-checking truth from build output.

**`tsconfig.json`** — the type-checking authority, includes everything:
```json
{
  "extends": "@casehub/pages-tsconfig/tsconfig.json",
  "include": ["src"]
}
```
No exclude for test files. `tsc --noEmit` reads this — checks source AND tests.

**`tsconfig.build.json`** — the build specialization:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "exclude": ["**/*.test.ts"]
}
```
Build scripts use `tsc -p tsconfig.build.json` — emits only production code.

This pattern applies to all packages that compile with `tsc`. Webpack-bundled packages
don't emit via tsc, so they only need `tsconfig.json` (no build variant).

### Monorepo Type Enforcement

**Root `package.json`:**
```json
"typecheck": "yarn workspaces foreach -Apt run typecheck"
```

**Each package `package.json`:**
```json
"typecheck": "tsc --noEmit"
```

**CI (`ci-javascript.yml`):** Add `yarn typecheck` between install and build steps. Type
errors — in both production and test code — block merges.

## Eliminating `as any`

### Category 1: Component Type Erasure (59 instances)

Tests accessing parsed/built component props through `Record<string, unknown>`:
```typescript
// Before (current)
expect((result.props as any).margin).toEqual({ left: 80 });

// After — parser returns TypedComponent, props are typed
expect(result.props?.margin).toEqual({ left: 80 });
```

Parser functions return `Component<"bar-chart", BarChartProps>` etc. DSL builder functions
(`barChart()`, `table()`, etc.) return typed components. Tests access props directly.

### Category 2: Union Narrowing (22 instances)

`DataSetOp` already has a `type` discriminator (`"filter" | "group" | "sort"`). Tests just
need to use it:

```typescript
// Before (current)
const groupOp = lookup.operations[0] as any;
expect(groupOp.columns[0].kind).toBe("key");

// After — narrow via discriminator
const op = lookup.operations[0];
if (op.type === "group") {
  expect(op.columns[0].kind).toBe("key");
}
```

Test assertion helpers for concise narrowing:

```typescript
function expectGroupOp(op: DataSetOp): GroupOp {
  expect(op.type).toBe("group");
  return op as GroupOp;
}
```

### Category 3: Branded Type Construction (22 instances)

Factory functions for opaque types, exported from pages-data:

```typescript
export function dataSetId(id: string): DataSetId { return id as DataSetId; }
export function columnId(id: string): ColumnId { return id as ColumnId; }
```

The `as` cast is confined to one place. Tests use `dataSetId("ds1")`.

### Category 4: DOM Access (6 instances)

Extend `HTMLElementTagNameMap` for typed `querySelector`:

```typescript
// pages-viz/src/custom-elements.d.ts
declare global {
  interface HTMLElementTagNameMap {
    "casehub-table": CasehubTable;
    "casehub-bar-chart": CasehubBarChart;
    "casehub-metric": CasehubMetric;
    // ... all custom elements
  }
}
```

After this, `el.querySelector("casehub-table")` returns `CasehubTable | null`.

### Category 5: Mock Functions (5 instances)

Type mocks properly with Vitest's generic mock API:

```typescript
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
```

### Category 6: Incomplete Test Fixtures (3 instances)

Test fixture factories with typed defaults:

```typescript
function testDataSetDef(
  overrides: Partial<ExternalDataSetDef> & { uuid: DataSetId }
): ExternalDataSetDef
```

### Category 7: Private API Testing (2 instances)

Replace with type-safe property checks (`"register" in obj`) or behavior assertions.

## Known Gotchas

**GE-20260612-d561ae — `exactOptionalPropertyTypes` rejects `undefined` for optional
properties.** Cannot write `{ legend: undefined }` for an optional `legend?` field. Use
conditional object construction: `{ ...(legend ? { legend } : {}) }`. Affects parser code
and test fixtures.

**GE-20260616-e268d7 — Stale `.d.ts` in Yarn workspace monorepos.** After changing the
Component interface in pages-component, downstream packages must rebuild to pick up new
declarations. `yarn build:packages` rebuilds in dependency order.

**GE-20260615-8cd96f — Generic function re-export cannot widen constraint via declaration
merging.** When re-exporting generic functions from pages-ui (which re-exports pages-component
types), the generic constraints must match exactly. The unified registry eliminates the
constraint-widening cast that previously worked around this.

## Out of Scope

Captured as separate issues:

- **TypeScript project references** (#2) — incremental cross-package type checking
- **ESLint strict type-checked rules** (#3) — additional lint-level type enforcement
