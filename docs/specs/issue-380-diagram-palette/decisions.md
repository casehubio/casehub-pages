# Decisions — Diagram Palette Component

## D1: Package home — generic pages infrastructure

**Choice:** Standalone `@casehubio/pages-diagram-palette` package in the pages repo, following the `pages-property-palette` pattern. blocks-ui provides domain content (stencils, domain logic) — the palette is generic infrastructure.
**Alternatives:**
- `casehub-diagram` (blocks-ui) — spec D2's original placement. Ties the component to a specific domain shell; other diagram types (serverless workflow, etc.) can't reuse it.
- `graph-renderer` — collocates with stencil registry but puts a Lit component in a React-centric package.
**Rationale:** Issue #380 explicitly overrides spec D2. The palette follows the same pattern as `pages-property-palette`: domain-agnostic Lit component that renders grouped items, with the domain adapter providing content via the SPI. Multiple domains (case definitions, serverless workflow) can reuse the same palette infrastructure.
**Trade-offs:** Palette and canvas are in different packages. Data flows via `StencilTypeInfo[]` — no direct registry coupling.
**Sources:** `packages/pages-property-palette/package.json`, issue #380 body, spec D2
**Exploration:** quick
**Status:** captured

## D2: Data contract — StencilTypeInfo only

**Choice:** Both palette and node chooser accept only `StencilTypeInfo[]`. The caller (domain adapter) maps `WorkStencil` → `StencilTypeInfo` and `StencilDescriptor` → `StencilTypeInfo` before passing items.
**Alternatives:**
- Accept both `StencilTypeInfo` and `WorkStencil` natively — tighter coupling to graph-work-registry; palette would need to know about two type systems.
**Rationale:** Single type contract keeps the component truly generic. `StencilTypeInfo` is already defined as `Pick<StencilDescriptor, 'type' | 'label' | 'icon'> & { group?: string }` — the minimal display contract. The mapping is a one-liner in the domain adapter.
**Trade-offs:** Domain adapter does the mapping. Trivial cost.
**Sources:** `packages/graph-renderer/src/editing/types.ts` (StencilTypeInfo), `packages/graph-work-registry/src/model.ts` (WorkStencil)
**Exploration:** quick
**Status:** captured

## D3: Component structure — shared renderer, two public components

**Choice:** One package with two public components: `<pages-diagram-palette>` (sidebar with collapsible groups, collapse persistence, click-to-add) and `<pages-node-chooser>` (popover with search, dismiss-on-select). Both share an internal grouped-item renderer.
**Alternatives:**
- Single component with `mode="sidebar" | "popover"` — conflates two distinct interaction patterns (persistent sidebar vs transient popover) behind a mode flag.
**Rationale:** The rendering is nearly identical (grouped list of StencilTypeInfo with icons, labels, search). The interaction behavior differs: palette is persistent with collapse persistence; popover is transient with dismissal logic. Shared internals, distinct public APIs.
**Trade-offs:** Two components to maintain. But they're thin wrappers over shared rendering logic.
**Sources:** Spec §4.4 (palette), §4.5 (node chooser popover)
**Exploration:** quick
**Status:** captured

## D4: Interaction model — click-to-add only, no drag

**Choice:** The palette uses click-to-add. No drag-to-canvas, no ghost element, no hit-testing. The palette fires a custom event (`pages-palette-select`) with the selected `StencilTypeInfo`; the shell handles the mutation via `onMutation()`.
**Alternatives:**
- Palette drag with ghost element and pointer events (spec §5.2, §8.1-8.4) — full drag lifecycle with viewport transform bridge, hit-testing against canvas nodes/edges. Significant complexity.
**Rationale:** ELK auto-layout positions all nodes — there's no meaningful drop position to target. Click-to-add achieves the same result: user picks a type, shell creates the node, ELK re-layouts. Drag-to-canvas is a power-user shortcut for free-form editors; auto-layout makes it unnecessary.
**Trade-offs:** No drag UX. Can be added later if free-form positioning is introduced.
**Sources:** Spec §4.4, user clarification ("as this is auto layout, there is no custom drag")
**Exploration:** quick
**Status:** captured

## D5: Shell wiring — custom events, zero canvas knowledge

**Choice:** The palette fires `pages-palette-select` with `StencilTypeInfo` payload. The node chooser fires the same event. The diagram shell (blocks-ui) listens and calls `onMutation({ type: 'addNode', nodeType: info.type })`. The palette has zero knowledge of GraphCanvas, EditPolicy, or graph-renderer.
**Alternatives:**
- Palette accepts a `canvasRef` property and calls `onMutation` directly — couples the palette to graph-renderer, breaking the generic infrastructure pattern.
**Rationale:** Same pattern as pages-property-palette: the component emits change events, the shell interprets them. The palette is a UI picker, not a graph editor.
**Trade-offs:** Shell must wire the event listener. Trivial.
**Sources:** `packages/pages-property-palette/src/palette/pages-property-palette.ts` (event pattern)
**Exploration:** quick
**Status:** captured

## D6: Collapse persistence — paletteId prop

**Choice:** Palette accepts a `paletteId` string property. localStorage key is `pages-palette-${paletteId}-${groupName}`. Mirrors `pages-property-palette`'s existing `paletteId` pattern.
**Alternatives:**
- No persistence — groups always start in default state. Loses user preference across page navigations.
- Key by diagram type — palette would need to know about diagram types, breaking generic contract.
**Rationale:** `paletteId` is already established by `pages-property-palette`. Domain adapter passes a meaningful ID like `"case-definition"` or `"serverless-workflow"`.
**Trade-offs:** Caller must provide a stable ID. Trivial.
**Sources:** `packages/pages-property-palette/src/palette/pages-property-palette.ts:75` (paletteId property)
**Exploration:** quick
**Status:** captured

## D7: Search threshold — configurable with default

**Choice:** `searchThreshold` property defaults to 8 but can be overridden. Search input appears when total item count exceeds the threshold. Applies to both palette and node chooser via the shared renderer.
**Alternatives:**
- Hardcoded at 8 — simpler but inflexible for domains with many or few stencils.
**Rationale:** Different domains may have very different stencil counts. Case definitions might have 20+ types; a simple workflow might have 5. The default of 8 matches the spec's threshold.
**Trade-offs:** Slightly more API surface. Worth it for domain flexibility.
**Sources:** Spec §4.5 ("search input when the list exceeds 8 items")
**Exploration:** quick
**Status:** captured

## D8: Popover positioning — shell-owned

**Choice:** `<pages-node-chooser>` renders wherever it's placed in the DOM. The shell sets its position via CSS (`position: fixed; top/left`) based on click coordinates. The component renders the list and fires selection events.
**Alternatives:**
- Component positions itself via `anchorX`/`anchorY` properties — duplicates positioning logic the shell already manages; couples the component to a positioning strategy.
**Rationale:** The shell already knows the click coordinates (from `onEdgeClick`/`onPaneClick` events). Positioning is a layout concern, not a component concern. The component stays a pure picker.
**Trade-offs:** Shell must set CSS position. Trivial — it's already managing the click coordinates.
**Sources:** Spec §4.5 (DOM-space rendering, viewport-compensated positioning)
**Exploration:** quick
**Status:** captured

## D9: Popover dismissal — built-in + abortSignal

**Choice:** The node chooser handles selection, Escape, and click-outside dismissal natively. It also accepts an optional `abortSignal` property so the shell can trigger dismissal for viewport changes or any other external condition.
**Alternatives:**
- Built-in dismissal only — shell can't dismiss on viewport change without removing the element from DOM.
- AbortSignal only — component wouldn't handle common dismissals itself; shell would need to wire Escape and click-outside manually.
**Rationale:** Built-in covers the universal cases. AbortSignal gives the shell extensibility without the component needing viewport awareness. Composition over configuration.
**Trade-offs:** Shell creates an AbortController for viewport dismiss. Clean pattern.
**Sources:** Spec §4.5 ("dismisses on selection, Escape, click-outside, or viewport change")
**Exploration:** quick
**Status:** captured
