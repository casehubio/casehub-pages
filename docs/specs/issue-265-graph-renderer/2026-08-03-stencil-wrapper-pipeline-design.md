# graph-renderer: Custom Node Rendering Pipeline — Design Spec

**Date:** 2026-08-03
**Issue:** #273 (graph-renderer: custom node rendering pipeline)
**Parent:** #265 (Phase 1B — graph-renderer)
**Parent spec:** `specs/2026-08-01-visual-diagram-editor-design.md` (§3.3)
**Phase 0 spec:** `specs/issue-259-graph-phase0/2026-08-02-phase0-react-flow-lit-bridge-design.md` (§4)
**Status:** Approved

---

## 1. Scope

Build the pipeline that wraps Lit `StencilTemplate` output from stencil
render functions into React Flow custom node components. Stencil authors
write Lit; the pipeline handles React interop and handle injection.

**In scope:**
- Factory function `createStencilNodeComponent(renderFn)` → React component
- Lit template lifecycle in React (render, update, cleanup via lit-html)
- Handle injection from graph-core grammar (no manual handle authoring)
- Dev page sample nodes rewritten as Lit templates
- Tests for lifecycle, handle injection, grammar integration

**Out of scope:**
- `StencilDescriptor` registry (#272 — uses this pipeline)
- `NodeDecoration` overlay (Phase 7 / #277 — render signature is extensible)
- Edge type rendering (simpler, handled in #272)
- Plugin CSS injection (#272 — `defaultStyle` is a registry concern)

## 2. Decisions

### 2.1 Factory + useRef + lit-html render()

A factory function `createStencilNodeComponent(renderFn)` returns a React
component. Inside, `useRef` grabs a container div. Two separate effects:
a render effect (`useEffect` with `[id, type, data]` deps) calls
lit-html's `render(template, container)` — preserving lit-html's diffing
across updates. A cleanup effect (`useEffect` with `[]` deps) calls
`render(nothing, container)` only on unmount.

**Rationale:** lit-html's `render()` is designed for imperative rendering
into a container with efficient DOM diffing. The factory pattern produces
`React.ComponentType<NodeProps>` — the exact type React Flow's
`nodeTypes` expects. ~30 lines of bridge code.

**Rejected:**
- Custom Element bridge — React 18 doesn't support CE property passing;
  would need `useRef` + manual property setting anyway.
- Static HTML injection — destroys lit-html diffing, no directive
  support, no event binding.

### 2.2 Light DOM rendering

The Lit template renders into light DOM (a plain `<div>` inside the React
Flow node container). No shadow root.

**Rationale:** The parent spec (§2.2) established that the canvas skips
Shadow DOM. Stencil templates use inline styles or `--pages-*` CSS custom
properties (per §2.2 CSS contract). Adding a shadow boundary inside React
Flow nodes would fight the established architecture and potentially
interfere with React Flow's event handling (selection, dragging).

### 2.3 Handles derived from grammar, not authored

The wrapper reads the node type's `StencilGrammar` via graph-core's
`getGrammar(type)` and injects React Flow `Handle` components around the
Lit content. Stencil authors write visual content only — they never
import or render `Handle`.

**Rules:**
- `inbound.max === 0` → no target handle
- `outbound.max === 0` → no source handle
- No grammar registered → both handles shown (safe default)

**Rationale:** Handles are structural (graph topology), not visual
(stencil content). Deriving them from grammar ensures consistency —
every node gets handles matching its connection rules. Stencil authors
shouldn't need to know about React Flow's Handle component.

Handle positions: `Top` (target), `Bottom` (source) — matching the
default `DOWN` ELK layout direction.

### 2.4 GraphNode reconstruction from NodeProps

React Flow gives the component `NodeProps` with `id`, `type`, `data`,
and `parentId`. Our mapping layer (from #271) mapped
`GraphNode.properties` → `Node.data` and preserved `parentId`.
The wrapper reconstructs a `GraphNode` to pass to the render function:

```typescript
const graphNode: GraphNode = {
  id,
  type: type ?? '',
  parentId: parentId ?? undefined,
  properties: (data ?? {}) as Readonly<Record<string, unknown>>,
};
```

React Flow v12's `NodeProps` includes `parentId` (inherited from the
`Node` type). The mapping layer (#271) preserves it during conversion,
and the wrapper passes it through to the render function — no data loss.

### 2.5 Relationship to NodeTypeDescriptor and StencilDescriptor

`createStencilNodeComponent` is a low-level bridge utility — it converts
a single Lit render function into a React component. It does NOT replace
`NodeTypeDescriptor` or the node registry.

**#272 (StencilDescriptor registry)** defines the full descriptor shape
(`type`, `label`, `icon`, `grammar`, `properties`, `render`) and calls
`createStencilNodeComponent(descriptor.render)` internally during
registration to produce the React component. It also auto-registers
`descriptor.grammar` with graph-core. Phase 0's `NodeTypeDescriptor`
is replaced by #272's `StencilDescriptor`, not by this issue.

**Grammar registration ordering:** `getGrammar(type)` is called at
render time (inside the React component). This is safe because grammar
is always registered before the first render — #272's `registerStencil`
calls `registerGrammar` synchronously during registration, which
happens before any React Flow `nodeTypes` lookup. The factory function
itself does not register grammar — it queries it. Registration is the
registry's job (#272).

### 2.6 NodeDecoration deferred

The render function signature is `(node: GraphNode) => StencilTemplate`
for now. When #277 (NodeDecoration model) lands, it becomes
`(node: GraphNode, decoration?: NodeDecoration) => StencilTemplate` —
additive, non-breaking. The wrapper will pass `undefined` for decoration
until runtime overlay (Phase 7) provides real decoration data.

## 3. API Surface

### 3.1 Factory function

```typescript
type StencilTemplate = TemplateResult | SVGTemplateResult;

type StencilRenderFn = (node: GraphNode) => StencilTemplate;

function createStencilNodeComponent(
  renderFn: StencilRenderFn,
): React.ComponentType<NodeProps>;
```

### 3.2 Exports

From `@casehubio/graph-renderer`:
- `createStencilNodeComponent` — the factory
- `StencilTemplate` type — for stencil authors
- `StencilRenderFn` type — for registry consumers

## 4. Component Internals

```tsx
function StencilNode({ id, type, data, parentId }: NodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const grammar = type ? getGrammar(type) : undefined;

  // Render effect — fires on mount and when node data changes.
  // lit-html's render() diffs against its previous output, so
  // re-calling it on the same container is an efficient patch.
  useEffect(() => {
    if (!containerRef.current) return;
    const graphNode: GraphNode = {
      id,
      type: type ?? '',
      parentId: parentId ?? undefined,
      properties: (data ?? {}) as Readonly<Record<string, unknown>>,
    };
    render(renderFn(graphNode), containerRef.current);
  }, [id, type, data, parentId]);

  // Cleanup effect — fires only on unmount.
  // Separate from the render effect so lit-html's tracked parts
  // survive across updates (preserving diffing).
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        render(nothing, containerRef.current);
      }
    };
  }, []);

  return (
    <>
      {grammar?.connections.inbound.max !== 0 && (
        <Handle type="target" position={Position.Top} />
      )}
      <div ref={containerRef} />
      {grammar?.connections.outbound.max !== 0 && (
        <Handle type="source" position={Position.Bottom} />
      )}
    </>
  );
}
```

**Error boundary:** The factory wraps `StencilNode` in a React error
boundary class component. If `renderFn` throws, the boundary catches
the error and renders a fallback node showing the error message and
node type — the graph remains interactive, only the broken node is
replaced. The error boundary is internal to the factory — stencil
authors and registry consumers never see it.

**Lifecycle:**

| Phase | What happens |
|-------|-------------|
| Mount | Render effect fires → lit-html `render(template, container)` creates DOM |
| Update | React re-renders on `data` change → render effect fires → lit-html diffs and patches (efficient — tracked parts survive) |
| Unmount | Cleanup effect fires → `render(nothing, container)` clears lit-html tracked parts → React removes container div |
| Error | Error boundary catches → renders fallback node with error message |

## 5. Dev Page Changes

Replace React sample nodes with Lit template render functions.

**`dev/sample-nodes.ts`** (renamed from `.tsx` — no longer JSX):

```typescript
import { html } from 'lit';
import type { GraphNode } from '@casehubio/graph-core';
import type { StencilTemplate } from '../src/stencil-wrapper.js';

export const sampleDefaultRender = (node: GraphNode): StencilTemplate => html`
  <div style="padding: 10px 20px; border-radius: var(--pages-radius-md, 8px);
    background: var(--pages-neutral-2, #f0f0f0);
    border: 1px solid var(--pages-neutral-6, #999);
    font-family: var(--pages-font-family, system-ui);
    font-size: var(--pages-font-size-base, 14px);
    color: var(--pages-text-primary, #111);">
    ${String(node.properties['label'] ?? '')}
  </div>
`;

export const sampleGroupRender = (node: GraphNode): StencilTemplate => html`
  <div style="padding: 30px 10px 10px; border-radius: var(--pages-radius-lg, 12px);
    background: var(--pages-accent-2, #e8f0ff);
    border: 2px solid var(--pages-accent-7, #3366cc);
    min-width: 200px; min-height: 150px;
    font-family: var(--pages-font-family, system-ui);
    font-size: var(--pages-font-size-sm, 12px);
    color: var(--pages-accent-11, #003);">
    <div style="position: absolute; top: 8px; left: 12px; font-weight: 600;">
      ${String(node.properties['label'] ?? '')}
    </div>
  </div>
`;
```

**`dev/dev-app.ts`** uses `createStencilNodeComponent` to wrap these
render functions before registering them with `registerNodeType`.

## 6. File Changes Summary

| File | Action |
|------|--------|
| `src/stencil-wrapper.tsx` | New — factory function, StencilNode component, types |
| `src/stencil-wrapper.test.tsx` | New — lifecycle and handle tests |
| `src/index.ts` | Add exports: createStencilNodeComponent, StencilTemplate, StencilRenderFn |
| `dev/sample-nodes.tsx` → `dev/sample-nodes.ts` | Rewrite as Lit render functions (no JSX) |
| `dev/dev-app.ts` | Use createStencilNodeComponent for registration |

## 7. Test Coverage

| Test | What |
|------|------|
| Factory returns a function | `typeof createStencilNodeComponent(fn) === 'function'` |
| Lit template renders into container | Mount, verify container has DOM matching template output |
| Template updates on data change | Change data, verify DOM updates via lit-html diffing |
| Cleanup on unmount | Unmount, verify `render(nothing)` called (spy on lit-html render) |
| Handles present when grammar allows | Register grammar with `inbound.max: 1`, verify target Handle |
| Handle suppressed when max is 0 | Register grammar with `outbound.max: 0`, verify no source Handle |
| No grammar → both handles shown | No grammar registered, verify both handles present |
| GraphNode reconstruction | Verify render function receives correct `id`, `type`, `parentId`, `properties` |
| Error boundary catches render failure | renderFn throws → fallback node shown, graph survives |
| Error boundary shows error detail | Fallback includes error message and node type |

## 8. Protocols Consulted

- **web-component-strategy** (PP-20260705-c7687d) — Lit conventions, no Shadow DOM on canvas
- **pages-event-contract** (PP-20260705-bac842) — event patterns (not directly used here)
- **css-design-tokens** (PP-20260705-2ae91d) — `--pages-*` tokens in stencil templates
