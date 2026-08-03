# graph-renderer: Interaction Layer — Design Spec

**Date:** 2026-08-03
**Issue:** #275 (graph-renderer: interaction layer — selection, pan/zoom, event emission)
**Parent:** #265 (Phase 1B — graph-renderer)
**Protocol:** pages-event-contract (PP-20260705-bac842)
**Status:** Approved

---

## 1. Scope

Wire React Flow interaction callbacks to `pages-event` custom events on
the host element. Rename existing dash-separated topics to colon-separated
for platform consistency (hierarchical wildcard matching). Add edge click,
multi-select, and viewport change events.

**In scope:**
- Rename existing event topics to colon-separated (graph:node:click, etc.)
- Add `nodeType` to node click payload
- Add edge click event
- Add viewport change event (pan/zoom)
- Enable box-select (selectionOnDrag) and partial selection mode
- Tests for all event emissions

**Out of scope:**
- Toolbar (#276 — consumes these events)
- Custom edge rendering
- Keyboard shortcuts beyond React Flow defaults

## 2. Decisions

### 2.1 Colon-separated event topics (breaking rename)

All graph event topics change from dash-separated to colon-separated
segments:
- `graph:node-click` → `graph:node:click`
- `graph:selection-change` → `graph:selection:change`
- `graph:layout-error` → `graph:layout:error`

**Rationale:** The platform's `matchesTopic()` splits on colons and
supports `*` (single-segment) and `**` (multi-segment) wildcards. Dash-
separated segments like `node-click` are opaque to the matcher — a
consumer cannot subscribe to `graph:*:click` or `graph:node:*`. Colon-
separated topics enable hierarchical filtering. Pre-release, no
external consumers to break.

### 2.2 Viewport change via onMoveEnd

React Flow fires `onMoveEnd` when the user finishes a pan or zoom
gesture. This is preferable to `onMove` (which fires continuously
during drag) — it avoids event spam and gives the final viewport state
that toolbar/sync consumers actually need.

### 2.3 Box-select via selectionOnDrag

React Flow's `selectionOnDrag` enables drag-box selection on the empty
canvas. `SelectionMode.Partial` means nodes partially inside the box
are selected (more intuitive than requiring full containment). Shift+click
multi-select is React Flow's default behavior — no configuration needed.

## 3. Event Catalog

| Topic | Payload | Trigger |
|-------|---------|---------|
| `graph:node:click` | `{ nodeId: string, nodeType: string }` | User clicks a node |
| `graph:edge:click` | `{ edgeId: string, edgeType: string }` | User clicks an edge |
| `graph:selection:change` | `{ nodeIds: string[], edgeIds: string[] }` | Selection set changes (select/deselect) |
| `graph:viewport:change` | `{ x: number, y: number, zoom: number }` | Pan or zoom gesture completes |
| `graph:layout:error` | `{ error: string }` | ELK layout fails |

All events use `emitPagesEvent(this, topic, payload)` with `composed: true`
and `bubbles: true` (per protocol).

**Behavioral notes:**
- Clicking a node fires both `graph:node:click` and `graph:selection:change` —
  this is expected (React Flow's design). Consumers filter by topic.
- `onSelectionChange` fires during box-select drag, not just on completion —
  this is React Flow's behavior. No debouncing; consumers handle frequency.
- `edgeType` uses `edge.type ?? ''` (consistent with `nodeType` coercion).
- No events fire on mount. The `_mounted` guard suppresses `onSelectionChange`
  and `onMoveEnd` callbacks until after the first `requestAnimationFrame`.

## 4. ReactFlowApp Changes

### 4.1 New props

```typescript
export interface ReactFlowAppProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick?: (nodeId: string, node: Node) => void;
  onEdgeClick?: (edgeId: string, edge: Edge) => void;
  onSelectionChange?: (nodes: Node[], edges: Edge[]) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}
```

### 4.2 New handlers

```typescript
const handleEdgeClick: EdgeMouseHandler = useCallback(
  (_event, edge) => { onEdgeClick?.(edge.id, edge); },
  [onEdgeClick],
);

const handleMoveEnd: OnMoveEnd = useCallback(
  (_event, viewport) => { onViewportChange?.(viewport); },
  [onViewportChange],
);
```

### 4.3 ReactFlow element

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  onNodeClick={handleNodeClick}
  onEdgeClick={handleEdgeClick}
  onSelectionChange={handleSelectionChange}
  onMoveEnd={handleMoveEnd}
  selectionOnDrag
  selectionMode={SelectionMode.Partial}
  fitView
>
```

## 5. GraphCanvas Wiring

`_renderReact()` passes all callbacks:

```typescript
createElement(ReactFlowApp, {
  nodes: this._nodes,
  edges: this._edges,
  nodeTypes: getNodeTypes(),
  onNodeClick: (nodeId: string, node: Node) => {
    emitPagesEvent(this, 'graph:node:click', {
      nodeId,
      nodeType: node.type ?? '',
    });
  },
  onEdgeClick: (edgeId: string, edge: Edge) => {
    emitPagesEvent(this, 'graph:edge:click', {
      edgeId,
      edgeType: edge.type ?? '',
    });
  },
  onSelectionChange: (nodes: Node[], edges: Edge[]) => {
    emitPagesEvent(this, 'graph:selection:change', {
      nodeIds: nodes.map(n => n.id),
      edgeIds: edges.map(e => e.id),
    });
  },
  onViewportChange: (viewport) => {
    emitPagesEvent(this, 'graph:viewport:change', viewport);
  },
})
```

The `graph:layout:error` topic in `_runLayout()` is also renamed.

## 6. Test Coverage

| Test | What |
|------|------|
| Node click emits graph:node:click | Verify topic, nodeId, nodeType in payload |
| Edge click emits graph:edge:click | Verify topic, edgeId, edgeType in payload |
| Selection change emits graph:selection:change | Verify topic, nodeIds array |
| Viewport change emits graph:viewport:change | Verify topic, x/y/zoom |
| Layout error emits graph:layout:error | Verify renamed topic |
| Old dash-separated topics no longer emitted | No graph:node-click events |

Tests in `bridge.test.ts` — update existing event tests for new topic
names, add new tests for edge click and viewport change.

## 7. File Changes Summary

| File | Action |
|------|--------|
| `src/bridge/ReactFlowApp.tsx` | Add onEdgeClick, onViewportChange props; add selectionOnDrag, selectionMode |
| `src/bridge/GraphCanvas.ts` | Rename topics, add edge/viewport wiring, add nodeType to node click |
| `src/bridge/bridge.test.ts` | Update topic names, add edge click + viewport tests |

No new files. No dependency changes. No dev page changes.

## 8. Protocols Consulted

- **pages-event-contract** (PP-20260705-bac842) — `emitPagesEvent`, topic naming, `composed: true`
- **web-component-strategy** (PP-20260705-c7687d) — Lit conventions
