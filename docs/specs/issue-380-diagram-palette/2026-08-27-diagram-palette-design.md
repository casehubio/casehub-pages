# Design: Generic Diagram Palette & Node Chooser

**Date:** 2026-08-27
**Issue:** #380
**Status:** Draft

---

## 1. Problem & Scope

Graph editors need two UI primitives for adding nodes: a persistent sidebar palette for browsing available stencil types, and a transient popover for context-sensitive node selection (e.g., after clicking an edge or empty space). Both render grouped lists of stencil types with icons, labels, and optional search — but differ in lifecycle and interaction: the palette is persistent with collapse state; the popover is transient with dismissal logic.

The editing infrastructure spec (§4.4, §4.5) originally placed both in `casehub-diagram` (blocks-ui). This spec extracts them into a generic `@casehubio/pages-diagram-palette` package in the pages repo, following the `pages-property-palette` pattern: domain-agnostic Lit component, domain adapter provides content.

**Note:** This spec supersedes the parent spec's §4.4 and §4.5 placement decisions. The parent spec should be updated to reference this package.

**In scope:**
- `<pages-diagram-palette>` — persistent sidebar component with grouped, collapsible stencil items
- `<pages-node-chooser>` — transient popover with context-filtered stencil list and dismiss logic
- Shared internal renderer for grouped stencil item lists
- Click-to-add interaction (fires selection event; shell handles mutation)
- Search/filter when item count exceeds configurable threshold
- Icon renderer callback for domain-specific icon systems
- ARIA roles and keyboard navigation
- Design token styling

**Out of scope:**
- Drag-to-canvas (auto-layout makes this unnecessary; tracked as deferred issue)
- Ghost element, hit-testing, viewport transform bridge (all drag-related; covered by parent spec Phase 4b)
- Domain-specific stencil content (blocks-ui provides this)
- Popover positioning (shell responsibility)
- Canvas integration (shell wires selection events to `onMutation`)

## 2. Decisions

See `decisions.md` in this directory for the full decision log (D1–D9).

Key decisions summarised:

| # | Decision | Choice |
|---|---|---|
| D1 | Package home | Standalone `@casehubio/pages-diagram-palette` in pages repo |
| D2 | Data contract | `StencilTypeInfo[]` only — caller maps domain types |
| D3 | Component structure | Two public components, shared internal renderer |
| D4 | Interaction model | Click-to-add only, no drag |
| D5 | Shell wiring | Custom events (`composed: true`), zero canvas knowledge |
| D6 | Collapse persistence | `paletteId` prop, localStorage keyed by ID + group |
| D7 | Search threshold | Configurable `searchThreshold` prop, defaults to 8 |
| D8 | Popover positioning | Shell-owned (CSS `position: fixed`) |
| D9 | Popover dismissal | Built-in (selection, Escape, click-outside) + optional `abortSignal` |

## 3. Architecture

### 3.1 Package structure

```
packages/pages-diagram-palette/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/
    index.ts                    # barrel — registers both elements (sideEffects)
    types.ts                    # PaletteGroup, PaletteItem, event detail types
    palette/
      index.ts                  # sub-path export (sideEffects)
      pages-diagram-palette.ts  # <pages-diagram-palette> component
      pages-diagram-palette.test.ts
    chooser/
      index.ts                  # sub-path export (sideEffects)
      pages-node-chooser.ts     # <pages-node-chooser> component
      pages-node-chooser.test.ts
    internal/
      stencil-list-renderer.ts  # shared grouped-item rendering logic
      search-filter.ts          # shared search/filter logic
```

### 3.2 Package configuration

```json
{
  "name": "@casehubio/pages-diagram-palette",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./palette": { "types": "./dist/palette/index.d.ts", "default": "./dist/palette/index.js" },
    "./chooser": { "types": "./dist/chooser/index.d.ts", "default": "./dist/chooser/index.js" },
    "./types": { "types": "./dist/types.d.ts", "default": "./dist/types.js" }
  },
  "sideEffects": ["./dist/index.js", "./dist/palette/index.js", "./dist/chooser/index.js", "./src/index.ts", "./src/palette/index.ts", "./src/chooser/index.ts"],
  "dependencies": {
    "@casehubio/pages-primitives": "workspace:*",
    "lit": "^3.3.3"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "@casehubio/pages-ui-tokens": "workspace:*"
  }
}
```

`@casehubio/pages-primitives` is a runtime dependency — both components use `RovingTabindexMixin` (palette) and `FocusTrapMixin` (node chooser) from `@casehubio/pages-primitives/a11y` (side-effect-free sub-path, no element registration).

**Type dependency note:** The package does NOT depend on `@casehubio/graph-renderer`. `StencilTypeInfo` is a simple structural type (`{ type: string; label: string; icon: string; group?: string }`). The palette defines its own equivalent interface (`PaletteItem`) matching the same shape. The caller (domain adapter) passes data that satisfies this interface — structural typing handles the compatibility. No import from graph-renderer needed.

### 3.3 Sub-path exports

Per `web-component-strategy` (PP-20260705-c7687d), side-effect isolation requires sub-path exports:

- `@casehubio/pages-diagram-palette/palette` — registers `<pages-diagram-palette>` only
- `@casehubio/pages-diagram-palette/chooser` — registers `<pages-node-chooser>` only
- `@casehubio/pages-diagram-palette/types` — type-only, no side effects
- `@casehubio/pages-diagram-palette` — barrel, registers both

## 4. Component APIs

### 4.1 Shared types

```typescript
interface PaletteItem {
  readonly type: string;
  readonly label: string;
  readonly icon: string;
  readonly group?: string;
}

interface PaletteGroup {
  readonly name: string;
  readonly collapsed: boolean;
  readonly items: readonly PaletteItem[];
}

interface PaletteSelectDetail {
  readonly item: PaletteItem;
}

type IconRenderer = (icon: string) => TemplateResult;
```

`PaletteItem` is structurally compatible with `StencilTypeInfo` — the domain adapter passes `StencilTypeInfo[]` and TypeScript's structural typing handles the rest.

**Icon rendering:** `icon` is an opaque string identifier (e.g., `'mail'`, `'globe'`, `'brain'`). Both components accept an `iconRenderer` callback property `(icon: string) => TemplateResult` that the domain adapter provides to map icon names to visuals (SVG templates, icon font classes, etc.). When `iconRenderer` is not provided, the default renders the raw string as text content — usable for development. Shadow DOM prevents external CSS from styling the icon spans, so a callback is the correct integration point for production icon systems.

### 4.2 `<pages-diagram-palette>` — sidebar component

```typescript
@customElement('pages-diagram-palette')
class PagesDiagramPalette extends LitElement {
  @property({ attribute: false }) items: readonly PaletteItem[] = [];
  @property() paletteId: string | undefined;
  @property({ type: Number }) searchThreshold = 8;
  @property({ attribute: false }) iconRenderer: IconRenderer | undefined;

  // fires: pages-palette-select (CustomEvent<PaletteSelectDetail>)
}
```

**Behaviour:**
- Groups items by `group` field (ungrouped items render first)
- Groups are collapsible `<details>/<summary>` elements (native disclosure widgets)
- Collapse state persisted in localStorage: `pages-palette-${paletteId}-${groupName}`
- Search input appears when total item count exceeds `searchThreshold`
- Search filters across `label`, `type`, and `group` (case-insensitive substring)
- **Search overrides collapse state:** when search is active, all groups expand to show matching items. Groups with zero matching items are hidden. When search is cleared, groups return to their persisted collapse state.
- Each item is a clickable button rendering icon (via `iconRenderer`) + label
- Click fires `pages-palette-select` with `composed: true, bubbles: true`

**ARIA** (per PP-20260817-a11y01):
- Root: `role="region"`, `aria-label="Node palette"`
- Groups use native `<details>/<summary>` — no role overrides. `<summary>` is announced as a button with expanded/collapsed state by assistive technology.
- Each item: `role="button"`, `aria-label` set to item label
- Keyboard: arrow keys navigate items within group (via `RovingTabindexMixin` from `@casehubio/pages-primitives/a11y`), Enter/Space triggers selection
- Search input: `role="searchbox"`, `aria-label="Filter palette items"`

### 4.3 `<pages-node-chooser>` — popover component

```typescript
@customElement('pages-node-chooser')
class PagesNodeChooser extends FocusTrapMixin(LitElement) {
  @property({ attribute: false }) items: readonly PaletteItem[] = [];
  @property({ type: Number }) searchThreshold = 8;
  @property({ attribute: false }) abortSignal: AbortSignal | undefined;
  @property({ attribute: false }) iconRenderer: IconRenderer | undefined;

  // fires: pages-palette-select (CustomEvent<PaletteSelectDetail>)
  // fires: pages-chooser-dismiss (CustomEvent<void>)
}
```

**Behaviour:**
- Renders a grouped list of items (same renderer as palette, minus collapse persistence)
- Groups are non-collapsible — always expanded (the list is context-filtered and typically short)
- Groups with zero items after filtering are not rendered
- Search input appears when total item count exceeds `searchThreshold`
- Dismisses on:
  - Selection (fires `pages-palette-select`, then `pages-chooser-dismiss`)
  - Escape key
  - Click outside the component (listener attached via `requestAnimationFrame` after `connectedCallback` to prevent the originating click from immediately dismissing)
  - `abortSignal` abort (shell signals viewport change, etc.)
- Does NOT position itself — shell owns positioning via CSS

**ARIA** (per PP-20260817-a11y01):
- Root: `role="dialog"`, `aria-label="Choose node type"`, `aria-modal="true"`
- Search input: `role="searchbox"`, `aria-label="Filter node types"`, `aria-controls` pointing to the listbox
- Item list: `role="listbox"`, `aria-label="Node types"` (sibling of search input inside the dialog)
- Each group within the listbox: `role="group"`, `aria-label` set to group name
- Each item: `role="option"`, `aria-label` set to item label
- Focus trap via `FocusTrapMixin` from `@casehubio/pages-primitives/a11y`
- First item auto-focused on render
- Arrow keys navigate options

### 4.4 Shared internal renderer

The grouped-item rendering logic is extracted into a pure function that both components call:

```typescript
function renderStencilList(
  items: readonly PaletteItem[],
  options: {
    collapsible: boolean;
    isGroupOpen?: (name: string) => boolean;
    onGroupToggle?: (name: string, open: boolean) => void;
    onSelect: (item: PaletteItem) => void;
    searchQuery: string;
    itemRole: 'button' | 'option';
    iconRenderer?: IconRenderer;
  }
): TemplateResult
```

This function:
1. Filters items by `searchQuery` (case-insensitive substring on label, type, group)
2. Groups filtered items by `group` field
3. Hides groups with zero matching items
4. When `collapsible` is true and `searchQuery` is non-empty, overrides collapse state to expand all groups
5. Renders groups with optional collapse (palette: collapsible `<details>`, chooser: always open `<div>`)
6. Renders each item as icon (via `iconRenderer` or text fallback) + label with the specified ARIA role
7. Calls `onSelect` on click/Enter/Space

## 5. Styling

All styling uses design tokens from `@casehubio/pages-ui-tokens` (devDependency — tokens are injected at runtime by the site shell).

```css
:host {
  display: block;
  font-family: var(--pages-font-family, system-ui, sans-serif);
}

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--pages-space-2, 8px);
  padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
  border-radius: var(--pages-radius-sm, 4px);
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--pages-neutral-12, #333);
  font-size: var(--pages-font-size-base, 14px);
  width: 100%;
  text-align: left;
}

.palette-item:hover {
  background: var(--pages-neutral-3, #f3f4f6);
}

.palette-item:focus-visible {
  outline: 2px solid var(--pages-accent-9, #5470c6);
  outline-offset: -2px;
}

.palette-item-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
```

The node chooser adds a container style for the popover appearance:

```css
:host {
  display: block;
  background: var(--pages-neutral-1, #fff);
  border: 1px solid var(--pages-neutral-4, #e5e7eb);
  border-radius: var(--pages-radius-md, 8px);
  box-shadow: var(--pages-shadow-md, 0 4px 12px rgba(0,0,0,0.1));
  padding: var(--pages-space-2, 8px);
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
}
```

## 6. Integration Pattern

### 6.1 Domain adapter wiring (blocks-ui)

```typescript
// In casehub-diagram shell
import '@casehubio/pages-diagram-palette/palette';

// Map work stencils to PaletteItem[] (WorkStencil carries category directly)
const items: PaletteItem[] = categoryIndex.allStencils().map(ws => ({
  type: ws.name,
  label: ws.displayName,
  icon: ws.icon,
  group: ws.category,
}));

// Icon renderer using the domain's icon system
const renderIcon = (icon: string) => html`<my-icon name=${icon}></my-icon>`;

// Template
html`
  <pages-diagram-palette
    .items=${items}
    .iconRenderer=${renderIcon}
    paletteId="case-definition"
    @pages-palette-select=${(e) => {
      canvas.onMutation?.({ type: 'addNode', nodeType: e.detail.item.type });
    }}
  ></pages-diagram-palette>
`
```

### 6.2 Node chooser wiring (blocks-ui)

```typescript
import '@casehubio/pages-diagram-palette/chooser';

// On edge click — show chooser with insertable types
onEdgeClick(edge, event) {
  const policy = getEditPolicy();
  const types = policy?.getInsertableTypes(edge, model) ?? [];
  const ac = new AbortController();
  // dismiss on viewport change
  canvas.addEventListener('viewportchange', () => ac.abort(), { once: true });

  // render chooser at click position
  const chooser = document.createElement('pages-node-chooser');
  chooser.items = types;
  chooser.iconRenderer = renderIcon;
  chooser.abortSignal = ac.signal;
  chooser.style.cssText = `position: fixed; left: ${event.clientX}px; top: ${event.clientY}px; z-index: 1000;`;
  document.body.appendChild(chooser);

  chooser.addEventListener('pages-palette-select', (e) => {
    canvas.onMutation?.({ type: 'splitEdge', edgeId: edge.id, insertNodeType: e.detail.item.type });
  });
  chooser.addEventListener('pages-chooser-dismiss', () => chooser.remove());
}
```

## 7. Shadow DOM

| Component | Shadow DOM | Rationale |
|---|---|---|
| `<pages-diagram-palette>` | Enabled | Self-contained Lit component; CSS encapsulation per web-component-strategy |
| `<pages-node-chooser>` | Enabled | Self-contained overlay; prevents style bleeding from host |

## 8. Build Integration

The new package slots into the existing monorepo build:

- **Build order:** `pages-diagram-palette` depends on `lit` and `pages-primitives` — builds in the `packages` phase alongside other leaf packages
- **Workspace reference:** `"@casehubio/pages-diagram-palette": "workspace:*"` added as dependency of `casehub-diagram` (blocks-ui) and any other diagram shell
- **TypeScript:** extends `@casehubio/pages-tsconfig`, composite project references for incremental type checking
- **Tests:** Vitest with jsdom (same as pages-property-palette)

## 9. Event Registration

New framework custom events (must be added to pages-event-contract reserved names table per PP-20260705-bac842):

| Event name | Component | Detail type | Purpose |
|---|---|---|---|
| `pages-palette-select` | both | `PaletteSelectDetail` | User selected a stencil type |
| `pages-chooser-dismiss` | `<pages-node-chooser>` | `void` | Popover dismissed (selection, Escape, click-outside, or abort) |

## 10. Protocols Consulted

- **web-component-strategy** (PP-20260705-c7687d) — Lit conventions, `pages-` prefix, Shadow DOM, sub-path exports for side-effect isolation
- **aria-interaction-contract** (PP-20260817-a11y01) — ARIA roles (`region`, `dialog`, `listbox`), accessible names, keyboard navigation, focus management
- **pages-event-contract** (PP-20260705-bac842) — custom events with `composed: true, bubbles: true`, reserved names table registration

## 11. References

- `packages/graph-renderer/src/editing/types.ts` — `StencilTypeInfo`, `EditPolicy` definitions
- `packages/graph-renderer/src/registry/stencil-registry.ts` — `StencilDescriptor`, `getAllStencils()`
- `packages/graph-work-registry/src/model.ts` — `WorkStencil`, `WorkStencilCategory`
- `packages/graph-work-registry/src/category-index.ts` — `CategoryIndex` with search, hierarchical grouping
- `packages/pages-property-palette/` — established pattern for generic Lit palette component
- `packages/pages-primitives/` — `RovingTabindexMixin`, `FocusTrapMixin` from `a11y` sub-path
- `packages/graph-renderer/src/bridge/GraphCanvas.ts` — `screenToFlow()`/`flowToScreen()` viewport bridge, `editPolicy`, `onMutation` props
- `docs/specs/diagram-editing-infrastructure/2026-08-26-diagram-editing-infrastructure-design.md` — parent spec §4.4 (palette), §4.5 (node chooser) — superseded by this spec for package placement
- `docs/protocols/casehub/web-component-strategy.md` (PP-20260705-c7687d)
- `docs/protocols/casehub/aria-interaction-contract.md` (PP-20260817-a11y01)
- Issue #380, #378
