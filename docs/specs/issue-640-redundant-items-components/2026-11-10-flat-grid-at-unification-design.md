# Flat/Grid/At — Page Layout Key Unification

**Issue:** casehubio/casehub-pages#640
**Branch:** issue-640-redundant-items-components
**Date:** 2026-11-10

## Problem

Post-migration (#625), the `items:` and `components:` YAML keys serve overlapping purposes. `rows`/`columns` are gone from the page-level parser. The remaining distinction — whether entries have `placement` — doesn't need two different top-level keys and a `component:` nesting level.

Current format for a grid page:

```yaml
items:
  - placement: { x: 0, y: 0, w: 6, h: 2 }
    component:
      type: title
      properties: { text: Revenue Overview }
```

Three problems: `items:` vs `components:` is confusing vocabulary, `placement:` is verbose, and `component:` nesting adds indentation for no purpose.

## Design

### Two layout keys: `flat:` and `grid:`

The top-level key declares the layout mode:

```yaml
# Vertical flow — no positioning
flat:
  - type: title
    properties: { text: Hello }
  - type: markdown
    properties: { content: Welcome }

# Positioned grid
grid:
  - at: { x: 0, y: 0, w: 6, h: 2 }
    type: title
    properties: { text: Revenue Overview }
  - at: { x: 6, y: 0, w: 6, h: 2 }
    type: chart
    properties: { dataset: sales }
```

### Position key: `at:`

Replaces `placement:`. Contains `{ x, y, w, h }` in flow style. If `x` and `y` are present, mode is `positioned`. If only `w` and `h`, mode is `auto`.

### No `component:` nesting

`type` and `properties` sit directly on each grid entry alongside `at:`. A grid entry IS a component with a position.

### Empty containers

A grid entry with `at:` and no `type`:

```yaml
grid:
  - at: { x: 0, y: 2, w: 12, h: 1 }
```

### Nested grids

A component with its own `grid:` key:

```yaml
grid:
  - at: { x: 0, y: 0, w: 6, h: 3 }
    type: container
    properties: { columns: 6 }
    grid:
      - at: { x: 0, y: 0, w: 3, h: 1 }
        type: metric
        properties: { label: Users, value: 1234 }
      - at: { x: 3, y: 0, w: 3, h: 1 }
        type: metric
        properties: { label: Revenue, value: $5.6M }
  - at: { x: 6, y: 0, w: 6, h: 3 }
    type: chart
    properties: { dataset: sales }
```

## Key Mapping

| Before | After |
|--------|-------|
| `items:` (page-level) | `grid:` |
| `components:` (page-level) | `flat:` |
| `placement: { x, y, w, h }` | `at: { x, y, w, h }` |
| `component:` (nesting wrapper) | removed — `type`/`properties` inline |
| `items:` (on Component) | `grid:` |
| `rows:` / `columns:` | legacy — parser accepts, normalises internally |

## Backwards Compatibility

The parser accepts all three format generations:

1. **Canonical:** `flat:` / `grid:` + `at:` — what this repo writes
2. **Legacy v2:** `items:` + `placement:` + `component:` — from #625
3. **Legacy v1:** `rows:` / `columns:` — from pre-#625 platform

Parser priority: `grid:` > `flat:` > `items:` > `components:` > `rows:` > `columns:`.

All legacy paths normalise to the internal model. A separate work-slot will migrate all platform repos to the canonical format.

## Changes by Package

### pages-ui (parser + DSL)

**page-parser.ts** — `parsePageContent()`:
- Add `grid:` path: read `pageRaw["grid"]`, parse each entry's `at:` (or `placement:` fallback) and inline `type`/`properties`
- Add `flat:` path: read `pageRaw["flat"]`, place each entry full-width
- Keep existing `items:` and `components:` paths as legacy fallback
- Priority: `grid` > `flat` > `items` > `components`

**component-desugar.ts** — nested component desugaring:
- Add `grid:` path for nested grids (alongside existing `items:` path for `type: "grid"`)

**builders.ts** — DSL:
- `at()` function: no rename needed (already matches)
- `grid()` function: change `items` parameter name, output `grid:` key internally
- `emptyContainer()`: update to use `at` field name

### pages-component (model + renderer)

**types.ts**:
- `GridItem.placement` → `GridItem.at`
- `Component.items` → `Component.grid`
- Keep `GridPlacement` type as-is (internal, not YAML-facing)

**render.ts**:
- `component.items` → `component.grid`
- `item.placement` → `item.at`

**grid-edit-controller.ts**:
- Internal references to `placement` → `at` on item rects (IdRect already uses x/y/w/h directly, so impact is in `dispatchEdit` mapping)

### pages-document (document model)

**page-document.ts**:
- `LayoutMode`: add `'grid'` value, keep `'items'`/`'rows'`/`'columns'`/`'flat'` for detection
- `getLayoutMode()`: check `'grid'` first, then `'flat'`, then existing keys
- `getItems()` → `getGrid()` (keep `getItems()` as alias)
- `GridItemNode.getPlacement()` → `getAt()` (keep `getPlacement()` as alias)
- `GridItemNode.setPlacement()` → `setAt()`: write `'at'` YAML key
- `GridItemNode.getComponent()`: read inline `type`/`properties` instead of `'component'` sub-key
- Update `insertChildAt()`, `removeChild()` to use `'grid'` key

**container-descriptors.ts**:
- Grid slot: `yamlKey: 'items'` → `yamlKey: 'grid'`

### pages-builder (bridge)

**grid-edit-bridge.ts**:
- `_applyPlacements()`: detect layout mode, convert legacy to `grid:` format on first edit
- `_convertToItems()` → `_convertToGrid()`: output `grid:` + `at:` + inline component
- Write `at:` instead of `placement:`, inline component instead of `component:` wrapper

### pages-runtime (activation)

**activation.ts**:
- `component.items` → `component.grid`
- `i.placement.mode` → `i.at.mode` (or keep internal field name if model uses `at`)

### Migration script

Convert all `.page.yaml` files in `examples/` and `examples/server/`:
- `items:` → `grid:`, each entry: `placement:` → `at:`, unwrap `component:` nesting
- `components:` → `flat:` (with full-width positioning removed — `flat:` entries have no `at:`)
- `rows:`/`columns:` → `flat:` or `grid:` depending on structure

244 files total (15 `items:`, 17 `components:`, 12 `rows:`, 30 `columns:` — with overlap in nested structures).

### Tests

Update YAML fixtures in:
- `page-parser.test.ts`, `layout-placement.test.ts`
- `backwards-compat.test.ts` (add new format tests, keep legacy tests)
- `grid-edit-bridge.test.ts`
- `builders.test.ts`
- `grid-edit-controller.test.ts`
- `page-document.test.ts`, `grid-item-node.test.ts`
- `insertion-constraints.test.ts`

## References

- casehubio/casehub-pages#640 — this issue
- casehubio/casehub-pages#625 — unified grid layout model (predecessor)
- `packages/pages-ui/src/parser/page-parser.ts:272-325` — current parser dispatch
- `packages/pages-component/src/model/types.ts:1-27` — model types
- `packages/pages-document/src/page-document.ts:303-309` — layout mode detection
- `packages/pages-builder/src/shell/grid-edit-bridge.ts:42-103` — bridge write path
- `packages/pages-ui/src/dsl/builders.ts:149-179` — DSL builders
