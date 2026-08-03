# graph-renderer: Evolve Bridge to Consume GraphModel — Design Spec

**Date:** 2026-08-03
**Issue:** #271 (graph-renderer: evolve bridge to consume graph-core GraphModel)
**Parent:** #265 (Phase 1B — graph-renderer)
**Parent spec:** `specs/2026-08-01-visual-diagram-editor-design.md` (§3.1, §3.2)
**Phase 0 spec:** `specs/issue-259-graph-phase0/2026-08-02-phase0-react-flow-lit-bridge-design.md`
**graph-core spec:** slot 76 `specs/2026-08-03-graph-model-design.md`
**Status:** Approved

---

## 1. Scope

Replace the hard-coded React Flow `Node[]`/`Edge[]` input on `GraphCanvas`
with graph-core's `GraphModel`. The bridge becomes the integration point
between the domain-agnostic graph model and React Flow's rendering
infrastructure.

**In scope:**
- `GraphCanvas` accepts `GraphModel` as its sole data input
- Mapping layer: `GraphNode` → React Flow `Node`, `GraphEdge` → React Flow `Edge`
- Containment tree expressed as React Flow parent/child grouping via `parentId`
- ELK layout runs internally inside `GraphCanvas` (no external orchestration)
- Dev page constructs `GraphModel` via `createGraph()`
- Tests updated — no hard-coded React Flow data in bridge tests

**Out of scope:**
- StencilDescriptor registry (#272)
- Custom node rendering pipeline (#273)
- Interaction layer (#275)

## 2. Decisions

### 2.1 Model-only API (breaking change from Phase 0)

`GraphCanvas` replaces its `nodes: Node[]` / `edges: Edge[]` Lit properties
with a single `model: GraphModel` property. React Flow types are no longer
part of the public API — they are internal implementation detail of the
bridge.

**Rationale:** Pre-release platform — breaking changes cost nothing. The
Phase 0 raw React Flow API was a spike artifact. The parent spec §3.2
data flow is `GraphModel → graph-renderer → render`. Dual API (model +
raw) would add an untested code path for zero consumers.

### 2.2 Internal ELK layout

`GraphCanvas` owns the full pipeline: map → ELK layout → React Flow
render. The consumer sets `model` and the canvas handles everything.

**Rationale:** If `GraphCanvas` accepts `GraphModel` but layout is
external, the consumer must call mapping functions to get React Flow
types, run ELK on them, then... pass React Flow types back? That defeats
the model-only API. The layout is a rendering concern that belongs inside
the renderer.

`computeElkLayout` remains exported from the package for standalone use
(tests, non-canvas consumers). Its signature stays React Flow types — it
is a rendering utility.

### 2.3 Mapping is pure and separate

The mapping layer lives in `src/mapping.ts` as pure functions with no
side effects. Exported for testing and for consumers who need React Flow
data without a canvas (snapshot tests, server-side rendering).

## 3. API Surface

### 3.1 GraphCanvas properties

```typescript
@property({ attribute: false }) model: GraphModel | undefined;
@property({ attribute: false }) layoutOptions: ElkLayoutOptions | undefined;
```

When `model` is `undefined`, the canvas is empty. `layoutOptions` defaults
to `{ direction: 'DOWN', spacing: 50 }`.

**Removed:** `nodes: Node[]`, `edges: Edge[]` (Phase 0 API).

### 3.2 Mapping functions

```typescript
function toReactFlowNode(node: GraphNode): Node;
function toReactFlowEdge(edge: GraphEdge): Edge;
function toReactFlowGraph(model: GraphModel): { nodes: Node[]; edges: Edge[] };
```

Exported from `@casehubio/graph-renderer`.

### 3.3 Events (unchanged)

GraphCanvas emits `pages-event` with topics:
- `graph:node-click` — `{ nodeId: string }`
- `graph:selection-change` — `{ nodeIds: string[] }`
- `graph:layout-error` — `{ error: string }` (new — emitted on ELK failure)

## 4. Mapping Rules

### 4.1 Node mapping

| GraphNode field | React Flow Node field | Transformation |
|-----------------|----------------------|----------------|
| `id` | `id` | identity |
| `type` | `type` | identity |
| `parentId` | `parentId` | identity — React Flow v12 native containment |
| `properties` | `data` | rename |
| — | `position` | `{ x: 0, y: 0 }` — ELK overwrites |

Parent nodes (nodes that have children in the model) receive default
dimensions via `style: { width, height }` to establish the React Flow
containment boundary. Defaults: `width: 280, height: 180`. ELK computes
actual layout; these defaults prevent zero-size containers before the
first layout pass.

**Parent detection:** The mapping function scans all nodes to build a
set of IDs referenced as `parentId`. Nodes whose ID appears in this set
are parent nodes.

### 4.2 Edge mapping

| GraphEdge field | React Flow Edge field | Transformation |
|-----------------|----------------------|----------------|
| `id` | `id` | identity |
| `type` | `type` | identity; `undefined` if empty string |
| `source` | `source` | identity |
| `target` | `target` | identity |
| `properties` | `data` | rename; `undefined` if absent |

No label extraction, no style inference. Stencil rendering (#273) handles
visual interpretation via registered node type components.

## 5. Internal Layout Pipeline

On `model` property change:

1. If `model` is `undefined`: clear internal state, render empty canvas.
2. Convert via `toReactFlowGraph(model)` → `{ nodes, edges }`.
3. Call `computeElkLayout(nodes, edges, layoutOptions)` (async).
4. Store result in `@state() _nodes` / `@state() _edges`.
5. Re-render `ReactFlowApp` with positioned data.

### 5.1 Race condition handling

A generation counter (`_layoutGeneration: number`) increments on every
`model` change. When an ELK promise resolves, it checks whether its
generation matches the current generation. Stale results are discarded.

### 5.2 Error handling

On ELK failure: fall back to unmapped positions (nodes at `{0,0}`), emit
`pages-event` with topic `graph:layout-error` and `{ error: message }`.
The canvas still renders — layout failure is degraded, not broken.

### 5.3 ReactFlowApp unchanged

`ReactFlowApp` still receives `Node[]`, `Edge[]`, `NodeTypes` as React
props. It does not know about `GraphModel`. The bridge boundary is inside
`GraphCanvas` — React Flow types do not leak above it.

## 6. Package Changes

### 6.1 Dependencies

Add to `package.json`:
```json
"@casehubio/graph-core": "workspace:*"
```

### 6.2 TypeScript references

Add to `tsconfig.json` references:
```json
{ "path": "../graph-core" }
```

### 6.3 Exports

Add to `index.ts`:
```typescript
export { toReactFlowNode, toReactFlowEdge, toReactFlowGraph } from './mapping.js';
```

Re-export `GraphModel`, `GraphNode`, `GraphEdge` from graph-core for
consumer convenience (consumers depend on graph-renderer, may not want
a direct graph-core dependency for types alone).

## 7. Dev Page

Replace hard-coded React Flow data with `createGraph()`:

```typescript
import { createGraph } from '@casehubio/graph-core';

const model = createGraph(
  [
    { id: 'worker-1', type: 'sample-group', properties: { label: 'Worker: ReviewAgent' } },
    { id: 'binding-1', type: 'sample-default', parentId: 'worker-1',
      properties: { label: 'on-document-upload' } },
    { id: 'binding-2', type: 'sample-default', parentId: 'worker-1',
      properties: { label: 'on-review-complete' } },
    { id: 'milestone-1', type: 'sample-default',
      properties: { label: 'Milestone: review-done' } },
    { id: 'goal-1', type: 'sample-default',
      properties: { label: 'Goal: case-resolved' } },
  ],
  [
    { id: 'e1', type: 'default', source: 'binding-1', target: 'binding-2' },
    { id: 'e2', type: 'default', source: 'binding-2', target: 'milestone-1' },
    { id: 'e3', type: 'default', source: 'milestone-1', target: 'goal-1' },
  ],
);

const canvas = document.querySelector('pages-graph-canvas');
if (canvas) {
  (canvas as any).model = model;
}
```

No manual `computeElkLayout()` call — GraphCanvas handles layout
internally. The dev page drops from ~35 lines to ~20.

## 8. Test Coverage

| File | What's tested |
|------|--------------|
| `mapping.test.ts` (new) | `toReactFlowNode` — id/type/parentId preserved, properties→data, position {0,0}. Parent node gets default dimensions. `toReactFlowEdge` — id/type/source/target preserved, properties→data when present, `undefined` when absent. Empty-string type → `undefined`. `toReactFlowGraph` — batch conversion, empty model returns empty arrays. Parent detection from `parentId` references. |
| `bridge.test.ts` (modified) | Set `model` property instead of `nodes`/`edges`. Verify container creation, theme application, Shadow DOM skip — structurally unchanged. New: setting `model` triggers internal state update with mapped nodes. |
| `elk-layout.test.ts` | Unchanged — operates on React Flow types. |
| `css-isolation.test.ts` | Unchanged. |

## 9. File Changes Summary

| File | Action |
|------|--------|
| `package.json` | Add `@casehubio/graph-core` dependency |
| `tsconfig.json` | Add graph-core reference |
| `src/mapping.ts` | New — pure mapping functions |
| `src/mapping.test.ts` | New — mapping unit tests |
| `src/bridge/GraphCanvas.ts` | Replace `nodes`/`edges` with `model`, add internal pipeline |
| `src/bridge/ReactFlowApp.tsx` | Unchanged |
| `src/bridge/bridge.test.ts` | Update to use `model` input |
| `src/index.ts` | Add mapping exports, re-export graph-core types |
| `dev/dev-app.ts` | Use `createGraph()` instead of raw React Flow data |
| `src/layout/elk-layout.ts` | Unchanged |
| `src/bridge/css-isolation.ts` | Unchanged |
| `src/registry/node-registry.ts` | Unchanged |

## 10. Protocols Consulted

- **web-component-strategy** (PP-20260705-c7687d) — Lit conventions, `@property` usage
- **pages-event-contract** (PP-20260705-bac842) — `emitPagesEvent` for `graph:layout-error`
- **css-design-tokens** (PP-20260705-2ae91d) — token availability unchanged
