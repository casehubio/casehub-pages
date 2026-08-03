# graph-renderer: ELK Layout Integration from Containment Tree — Design Spec

**Date:** 2026-08-03
**Issue:** #274 (graph-renderer: ELK layout integration from containment tree)
**Parent:** #265 (Phase 1B — graph-renderer)
**Depends on:** #271 (bridge consumes GraphModel — done)
**Phase 0 foundation:** #259 (elk-layout.ts — done)
**Status:** Approved

---

## 1. Scope

Evolve Phase 0's ELK adapter to consume graph-core's `GraphModel`
containment tree directly for hierarchical layout. The adapter currently
takes React Flow types and reconstructs containment from `parentId` — this
replaces that with graph-core's traversal API (`rootNodes`, `childrenOf`).

**In scope:**
- `computeElkLayout` accepts `GraphModel` instead of React Flow `Node[]`/`Edge[]`
- Returns `ElkLayoutResult` (position + dimension map) instead of positioned RF nodes
- Recursive ELK tree construction via `rootNodes()` / `childrenOf()`
- ELK-computed container dimensions applied to parent nodes (replaces hardcoded 280x180)
- `containerPadding` added to `ElkLayoutOptions`
- Mapping layer gains optional `layout` parameter
- GraphCanvas pipeline simplified: model → ELK → mapping with layout
- Tests rewritten for new signatures

**Out of scope:**
- Re-layout on DOM measurement (React Flow `onNodesChange` with measured dimensions)
- ELK algorithm selection (staying with `layered`)
- Edge routing configuration
- Interaction layer (#275)

## 2. Decisions

### 2.1 GraphModel-first ELK adapter (breaking change)

`computeElkLayout` changes from React Flow types to `GraphModel` input
and `ElkLayoutResult` output. The function uses graph-core's `rootNodes()`
and `childrenOf()` to walk the containment tree — no reconstruction from
flat `parentId` arrays.

**Rationale:** The containment tree is a domain concept in `GraphModel`.
Passing it through React Flow types first means the ELK adapter has to
reconstruct what the model already knows. graph-core's traversal API is
the canonical way to walk the tree. Pre-release — breaking the export
is free and there are no external consumers.

### 2.2 Position + dimension map return type

The adapter returns `ElkLayoutResult` containing a `Map<string, NodeLayout>`
with `x`, `y`, `width`, `height` for every node. Not positioned React Flow
nodes.

**Rationale:** Layout computation produces positions and dimensions.
Applying them to a specific rendering framework (React Flow) is the
mapping layer's job. This keeps the layout adapter framework-agnostic
and independently testable.

### 2.3 ELK-computed container sizing

Parent nodes receive their dimensions from ELK's output, not from
hardcoded defaults. ELK sizes containers around their children plus
padding (`containerPadding` option, default 20px).

**Rationale:** The layout is only correct when both positions and
dimensions are applied together. Hardcoded 280x180 containers don't
resize when children are added or removed — they're a Phase 0 artifact.

### 2.4 Mapping layer applies layout

`toReactFlowGraph(model, layout?)` becomes the single point where
domain model converts to React Flow types with optional positioning.
When `layout` is provided, positions and container sizes come from it.
When absent, fallback to `{0,0}` and default dimensions.

**Rationale:** One mapping function, one responsibility. Layout and
mapping are independently testable. GraphCanvas orchestrates but doesn't
compute.

### 2.5 containerPadding option

`ElkLayoutOptions` adds `containerPadding?: number` (default 20).
Maps to ELK's `elk.padding` on container nodes.

**Rationale:** Directly relevant to containment layout — controls space
between container boundary and children. Other ELK knobs (layer spacing,
edge routing, compaction) are not needed yet.

## 3. API Surface

### 3.1 Layout types

```typescript
interface NodeLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ElkLayoutResult {
  readonly nodeLayouts: ReadonlyMap<string, NodeLayout>;
}
```

Coordinates are parent-relative — consistent with both ELK output and
React Flow's `parentId` coordinate model. A child node's `{x, y}` is
relative to its container's origin, not the canvas root.

### 3.2 Layout function

```typescript
interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  containerPadding?: number;
}

async function computeElkLayout(
  model: GraphModel,
  options?: ElkLayoutOptions,
): Promise<ElkLayoutResult>;
```

### 3.3 Mapping functions (evolved)

```typescript
function toReactFlowNode(
  node: GraphNode,
  parentIds: ReadonlySet<string>,
  nodeLayout?: NodeLayout,
): Node;

function toReactFlowGraph(
  model: GraphModel,
  layout?: ElkLayoutResult,
): { nodes: Node[]; edges: Edge[] };
```

`toReactFlowNode` gains an optional `nodeLayout` parameter:
- When provided: `position` comes from `nodeLayout.{x, y}`. If the node
  is a parent (in `parentIds`), `style.width`/`style.height` come from
  `nodeLayout.{width, height}`.
- When absent: `position` defaults to `{0, 0}`. Parent nodes get
  hardcoded default dimensions (existing fallback behavior).

`toReactFlowGraph` resolves `parentIds` from the model (unchanged), then
looks up each node's `NodeLayout` from `layout?.nodeLayouts` before
calling `toReactFlowNode`. `toReactFlowEdge` is unchanged.

### 3.4 Exports

From `@casehubio/graph-renderer`:
- `computeElkLayout` (updated signature)
- `ElkLayoutOptions` (extended with `containerPadding`)
- `ElkLayoutResult`, `NodeLayout` (new types)
- `toReactFlowGraph`, `toReactFlowNode`, `toReactFlowEdge` (updated signatures)

## 4. ELK Tree Construction

Recursive walk from `rootNodes` through `childrenOf`:

```typescript
function buildElkNode(
  model: GraphModel,
  node: GraphNode,
  visited: Set<string>,
  padding: number,
): ElkNode {
  if (visited.has(node.id)) {
    throw new Error(`Containment cycle at node '${node.id}'`);
  }
  visited.add(node.id);

  const children = childrenOf(model, node.id);
  const elkNode: ElkNode = {
    id: node.id,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  };
  if (children.length > 0) {
    elkNode.children = children.map(c => buildElkNode(model, c, visited, padding));
    elkNode.layoutOptions = {
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
    };
  }
  return elkNode;
}
```

The `visited` set guards against containment cycles. graph-core's
`createGraph` validates against cycles, but the adapter is defensive —
it should not stack-overflow if given an unchecked model.

Root construction:
```typescript
const roots = rootNodes(model);
const rootChildren = roots.map(n => buildElkNode(model, n, new Set(), padding));
```

The root ELK graph node also sets `'elk.hierarchyHandling': 'INCLUDE_CHILDREN'`
at the top level so that ELK processes the full hierarchy, not just the
first level of nesting.

### 4.1 Edge placement

Edges are placed on the root ELK graph node, not distributed into the
containment hierarchy. ELK resolves cross-hierarchy routing automatically
when edges reference nodes at different nesting levels — placing all
edges at the root is the standard ELK pattern for hierarchical graphs.

```typescript
const elkEdges: ElkExtendedEdge[] = model.edges.map(e => ({
  id: e.id,
  sources: [e.source],
  targets: [e.target],
}));
```

### 4.2 Position extraction

Walks the ELK output tree recursively, collecting `x`, `y`, `width`,
`height` for every node into the `nodeLayouts` map. Coordinates are
parent-relative (ELK's native output format).

## 5. GraphCanvas Pipeline

Current flow:
```
model → toReactFlowGraph(model) → computeElkLayout(rfNodes, rfEdges) → store
```

New flow:
```
model → computeElkLayout(model, options) → toReactFlowGraph(model, layout) → store
```

Layout runs on the domain model directly. Mapping to React Flow types
happens once, after positions are known. No intermediate RF conversion
that gets discarded.

Generation counter and error handling unchanged — same race condition
pattern, same `pages-event` error emission. Fallback on ELK error:
`toReactFlowGraph(model)` without layout (nodes at `{0,0}`).

## 6. Test Coverage

| Test | What |
|------|------|
| Flat graph layout | No containment — all nodes get non-zero positions, no overlaps |
| Nested graph layout | Parent + children — children positioned inside parent, parent sized around children |
| Deep nesting | Grandparent → parent → child — multi-level containment |
| Empty model | `{ nodes: [], edges: [] }` → empty position map |
| Layout result applied to mapping | `toReactFlowGraph(model, layout)` → RF nodes have correct positions and container sizes |
| Mapping without layout (fallback) | `toReactFlowGraph(model)` → nodes at `{0,0}`, parents get default dimensions |
| Container padding option | `containerPadding: 40` → containers have more space around children |
| Direction option | `direction: 'RIGHT'` → nodes arranged horizontally |
| Re-layout on model change | Set model, verify positions. Change model, verify new positions differ |
| GraphCanvas integration | Set `model` property → `_nodes`/`_edges` populated with positioned data |
| Cycle guard | Model with containment cycle → throws error, does not stack-overflow |
| Cross-hierarchy edges | Edge between nodes at different nesting levels → layout succeeds |
| ELK error fallback | ELK failure → `toReactFlowGraph(model)` without layout, nodes at `{0,0}` |

Existing tests in `elk-layout.test.ts` and `mapping.test.ts` rewritten
for new signatures. `bridge.test.ts` unchanged — already tests via
`model` property.

## 7. File Changes Summary

| File | Action |
|------|--------|
| `src/layout/elk-layout.ts` | Rewrite — accept `GraphModel`, return `ElkLayoutResult`, use `rootNodes`/`childrenOf` |
| `src/layout/elk-layout.test.ts` | Rewrite — tests use `GraphModel` input, verify position map output |
| `src/mapping.ts` | Evolve — `toReactFlowGraph` gains optional `layout` parameter, `toReactFlowNode` applies `NodeLayout` |
| `src/mapping.test.ts` | Extend — layout-applied mapping tests, keep no-layout fallback tests |
| `src/bridge/GraphCanvas.ts` | Simplify `_runLayout` — model → ELK → mapping with layout |
| `src/index.ts` | Update exports — add `ElkLayoutResult`, `NodeLayout` types |

No new files. No dependency changes. No dev page changes.

## 8. Protocols Consulted

- **web-component-strategy** (PP-20260705-c7687d) — Lit conventions, `@property` usage
- **pages-event-contract** (PP-20260705-bac842) — `emitPagesEvent` for `graph:layout-error`
