# graph-renderer: ELK Per-Node Size Overrides — Design Spec

**Date:** 2026-08-06
**Issue:** #290 (ELK per-node size overrides for worker inline expand)
**Depends on:** #274 (ELK layout integration from containment tree — done)
**Status:** Approved

---

## 1. Scope

Extend `ElkLayoutOptions` with an optional `nodeSizes` parameter so that
`buildElkNode()` uses caller-specified dimensions instead of
`DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT`.

**In scope:**
- `nodeSizes` field on `ElkLayoutOptions`
- Lookup in `buildElkNode()` — override defaults when entry exists
- Threading through `computeElkLayout()`
- Tests for override and missing-ID cases

**Out of scope:**
- Consumer-side expand/collapse logic (owned by `casehub-diagram` in blocks-ui)
- Constraining ELK parent sizing — parent dimensions are computed by ELK from children
- Animated transitions between sizes

## 2. Decisions

### 2.1 Map on ElkLayoutOptions (not callback)

`nodeSizes` is a `ReadonlyMap<string, { width: number; height: number }>`,
not a callback function. The consumer (`casehub-diagram`) already has a
`Set<string>` of expanded workers and fixed expanded dimensions (300×200) —
a map is the natural data structure. A callback adds indirection with no
practical benefit.

### 2.2 Unconditional application

`nodeSizes` lookup applies to all nodes — no leaf-vs-parent branching.
For leaf nodes, the caller's dimensions are used as intended. For parent
nodes, ELK overrides the input dimensions when computing fit-around-children,
so the caller's value is a harmless no-op. This keeps the API simple with
no exceptions to document.

### 2.3 No new exported types

The map value type `{ width: number; height: number }` is inlined in the
`ElkLayoutOptions` interface. It doesn't warrant a named export — it's
two fields used in one place.

## 3. API Surface

### 3.1 ElkLayoutOptions (extended)

```typescript
export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  containerPadding?: number;
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>;
}
```

### 3.2 computeElkLayout (signature unchanged)

```typescript
async function computeElkLayout(
  model: GraphModel,
  options?: ElkLayoutOptions,
): Promise<ElkLayoutResult>;
```

No signature change — `nodeSizes` is optional on the existing `options`
parameter.

## 4. Implementation

### 4.1 buildElkNode

Add `nodeSizes` parameter. Single map lookup before constructing the
ELK node:

```typescript
function buildElkNode(
  model: GraphModel,
  node: GraphNode,
  visited: Set<string>,
  padding: number,
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>,
): ElkNode {
  // ... cycle guard unchanged ...
  const size = nodeSizes?.get(node.id);
  const elkNode: ElkNode = {
    id: node.id,
    width: size?.width ?? DEFAULT_NODE_WIDTH,
    height: size?.height ?? DEFAULT_NODE_HEIGHT,
  };
  // ... children handling unchanged, passes nodeSizes recursively ...
}
```

### 4.2 computeElkLayout

Extract `nodeSizes` from options and pass to `buildElkNode`:

```typescript
const nodeSizes = options.nodeSizes;
const rootChildren = roots.map(n => buildElkNode(model, n, new Set(), padding, nodeSizes));
```

### 4.3 extractNodeLayouts — no change

Already reads dimensions from ELK's output. No modification needed.

## 5. Test Coverage

| Test | What |
|------|------|
| nodeSizes overrides leaf node dimensions | Pass custom dimensions for one node, verify layout result reflects them |
| nodeSizes entries for missing node IDs ignored | Pass ID not in model, verify layout succeeds without error |

Existing tests remain unchanged — they exercise the default-size path.

## 6. File Changes Summary

| File | Action |
|------|--------|
| `src/layout/elk-layout.ts` | Add `nodeSizes` to `ElkLayoutOptions`, thread through `computeElkLayout`, lookup in `buildElkNode` |
| `src/layout/elk-layout.test.ts` | Two new test cases |

No new files. No dependency changes. No new exports.

## 7. Protocols Consulted

None applicable — TypeScript package API extension, no CSS tokens, iframe,
dataset, or Maven changes involved.
