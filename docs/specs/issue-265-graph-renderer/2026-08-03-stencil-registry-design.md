# graph-renderer: StencilDescriptor Registry — Design Spec

**Date:** 2026-08-03
**Issue:** #272 (graph-renderer: StencilDescriptor registry with auto grammar registration)
**Parent:** #265 (Phase 1B — graph-renderer)
**Parent spec:** `specs/2026-08-01-visual-diagram-editor-design.md` (§3.3)
**Depends on:** #267 (graph-core: grammar registry — CLOSED), #273 (stencil wrapper — done this session)
**Status:** Approved

---

## 1. Scope

Full `StencilDescriptor` registry that evolves Phase 0's `NodeTypeDescriptor`.
Each registration includes rendering template, grammar, properties schema,
label, and icon. On registration, the embedded grammar is auto-registered
with graph-core and the render function is auto-wrapped into a React
component via `createStencilNodeComponent`.

**In scope:**
- `StencilDescriptor` interface with `render` field (no `component`)
- Registry: register, deregister, lookup, list
- Auto-registration: grammar + React component generated on register
- Auto-cleanup: grammar + React component removed on deregister
- `EdgeDescriptor` for edge type registration
- `deregisterGrammar(type)` added to graph-core (API gap)
- Phase 0 `NodeTypeDescriptor` / `node-registry.ts` replaced
- All consumers updated (GraphCanvas, css-isolation, dev page, index.ts)

**Out of scope:**
- `PropertySchema` type alias (#277 — using `Record<string, unknown>` placeholder)
- `NodeDecoration` (#277)
- Edge rendering components (edges use React Flow defaults for now)

## 2. Decisions

### 2.1 render-only, no component field

`StencilDescriptor` has `render: StencilRenderFn` — no `component` field.
The registry calls `createStencilNodeComponent(descriptor.render)` internally
during registration to produce the React component. This was enabled by
doing #273 before #272.

**Rationale:** Single source of truth for node rendering. Stencil authors
write Lit; the registry handles the React bridge. No dual API.

### 2.2 Auto-registration on register, auto-cleanup on deregister

`registerStencil(descriptor)` atomically:
1. Calls `registerGrammar(descriptor.grammar)` on graph-core
2. Calls `createStencilNodeComponent(descriptor.render)` to produce React component
3. Stores the descriptor + generated component

`deregisterStencil(type)` atomically:
1. Calls `deregisterGrammar(type)` on graph-core (new function)
2. Removes the descriptor + generated component

This ensures grammar and renderer are always in sync. No partial state.

### 2.3 deregisterGrammar added to graph-core

graph-core's grammar API has `registerGrammar`, `getGrammar`, `getAllGrammars`,
`clearGrammarRegistry` — but no single-type removal. Adding
`deregisterGrammar(type: string): boolean` closes the API gap.

### 2.4 EdgeDescriptor is minimal

Edge types in React Flow are simpler than node types — they don't need
grammar (edges don't have connection rules about themselves), render
functions (React Flow's default edge rendering is sufficient), or
containment. `EdgeDescriptor` stores `type`, `label`, and `defaultStyle`.

### 2.5 Phase 0 node-registry.ts deleted

`NodeTypeDescriptor`, `registerNodeType`, `getNodeTypes`, `getRegisteredStyles`,
`clearRegistry` are all replaced by the new stencil registry equivalents.
Pre-release — no backward compat needed.

## 3. API Surface

### 3.1 StencilDescriptor

```typescript
import type { StencilGrammar } from '@casehubio/graph-core';
import type { StencilRenderFn } from './stencil-wrapper.js';

interface StencilDescriptor {
  readonly type: string;
  readonly label: string;
  readonly icon: string;
  readonly grammar: StencilGrammar;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly render: StencilRenderFn;
  readonly defaultStyle?: string;
}
```

### 3.2 EdgeDescriptor

```typescript
interface EdgeDescriptor {
  readonly type: string;
  readonly label?: string;
  readonly defaultStyle?: string;
}
```

### 3.3 Registry functions

```typescript
function registerStencil(descriptor: StencilDescriptor): void;
function deregisterStencil(type: string): void;
function getStencil(type: string): StencilDescriptor | undefined;
function getAllStencils(): readonly StencilDescriptor[];

function registerEdgeType(descriptor: EdgeDescriptor): void;
function deregisterEdgeType(type: string): void;
function getEdgeDescriptor(type: string): EdgeDescriptor | undefined;

function getNodeTypes(): NodeTypes;
function getRegisteredStyles(): string;
function clearRegistry(): void;
```

`getNodeTypes()` returns the auto-generated React components keyed by type.
`getRegisteredStyles()` collects `defaultStyle` from both stencils and edges.
`clearRegistry()` clears stencils, edges, and calls `clearGrammarRegistry()`.

### 3.4 graph-core addition

```typescript
function deregisterGrammar(type: string): boolean;
```

Returns `true` if the grammar was found and removed, `false` if not found.

## 4. Consumer Updates

| Consumer | Change |
|----------|--------|
| `GraphCanvas.ts` | Import `getNodeTypes` from `stencil-registry` instead of `node-registry` |
| `css-isolation.ts` | Import `getRegisteredStyles` from `stencil-registry` instead of `node-registry` |
| `css-isolation.test.ts` | Use `registerStencil` instead of `registerNodeType` |
| `index.ts` | Replace node-registry exports with stencil-registry exports |
| `dev/dev-app.ts` | Use `registerStencil` with full descriptor objects |

## 5. File Changes Summary

| File | Action |
|------|--------|
| `packages/graph-core/src/grammar.ts` | Add `deregisterGrammar` |
| `packages/graph-core/src/grammar.test.ts` | Add deregister tests |
| `packages/graph-core/src/index.ts` | Export `deregisterGrammar` |
| `packages/graph-renderer/src/registry/stencil-registry.ts` | New |
| `packages/graph-renderer/src/registry/stencil-registry.test.ts` | New |
| `packages/graph-renderer/src/registry/node-registry.ts` | Delete |
| `packages/graph-renderer/src/registry/node-registry.test.ts` | Delete |
| `packages/graph-renderer/src/bridge/GraphCanvas.ts` | Update import |
| `packages/graph-renderer/src/bridge/css-isolation.ts` | Update import |
| `packages/graph-renderer/src/bridge/css-isolation.test.ts` | Use registerStencil |
| `packages/graph-renderer/src/index.ts` | Replace exports |
| `packages/graph-renderer/dev/dev-app.ts` | Use registerStencil |

## 6. Test Coverage

| Test | What |
|------|------|
| `registerStencil` stores descriptor | Register, lookup via `getStencil` |
| Auto-registers grammar | Register stencil, verify `getGrammar(type)` returns grammar |
| Auto-generates React component | Register stencil, verify `getNodeTypes()` has entry |
| Rejects duplicate type | Register same type twice → throws |
| `deregisterStencil` removes all | Deregister, verify stencil + grammar + nodeType gone |
| `deregisterStencil` returns silently for unknown type | No throw |
| `getAllStencils` returns all | Register 3, verify length 3 |
| `getRegisteredStyles` collects from both stencils and edges | Register with defaultStyle, verify |
| `clearRegistry` clears everything | Register, clear, verify empty |
| `registerEdgeType` / `deregisterEdgeType` | Basic lifecycle |
| `deregisterGrammar` (graph-core) | Register, deregister, verify `getGrammar` returns undefined |
| `deregisterGrammar` returns false for unknown | Verify return value |

## 7. Protocols Consulted

- **web-component-strategy** (PP-20260705-c7687d) — naming conventions
- **pages-event-contract** (PP-20260705-bac842) — event patterns unchanged
