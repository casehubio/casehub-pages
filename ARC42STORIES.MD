# casehub-pages — ARC42STORIES.MD

**Spec:** Arc42Stories v0.1
**Profile:** Standalone open-source project
**Build position:** Independent — no upstream dependencies beyond npm packages
**Consumed by:** Any CaseHub web application (DraftHouse, Claudony, DevTown, standalone sites)
**Depends on:** Apache ECharts, React Flow, ELK, Lit, js-yaml, marked, JSONata, xterm.js (all npm)

---

## §1 Introduction and Goals

### Description

`casehub-pages` is a web application framework for the CaseHub platform — a pure TypeScript runtime for composing applications from layouts, data pipelines, visualization, forms, hosted Web Components, and inter-component communication. The framework separates data from presentation, wires them together through declarative bindings and a reactive event pipeline, and renders the result as Web Components.

Core packages: `@casehubio/pages-data` (DataSet model, reactive event engine, operations, external data extraction, push sources — WebSocket and SSE, JSONata), `@casehubio/pages-ui` (TypeScript DSL builders, YAML parser, component model), `@casehubio/pages-ui-tokens` (OKLCH design tokens, theme generation), `@casehubio/pages-viz` (Web Component chart/metric/timeline wrappers around ECharts), `@casehubio/pages-component` (CSS grid layout renderer, interactive containers, split layouts, dock bars), `@casehubio/pages-primitives` (Lit-dependent UI primitives — a11y mixins), `@casehubio/pages-table` (data table Web Component — CSS Grid, virtual scroll, sorting, filtering, selection), `@casehubio/pages-runtime` (site orchestrator — `loadSite()` API, panel hosting, data pipeline, event delegation, i3-style Container tree compositor, floating workspace), `@casehubio/pages-aria` (ARIA-based browser automation for scenario demos), `@casehubio/graph-core` + `@casehubio/graph-renderer` (graph model with grammar validation, React Flow + ELK rendering).

### Stakeholders

| Stakeholder | Interest |
|---|---|
| Application developers | Compose web applications using the TypeScript DSL, use `hostPanel()` for custom Web Components |
| Host applications | Embed casehub-pages via iframe or direct integration using `loadSite()` API |
| DashBuilder users | Backward-compatible rendering of existing DashBuilder YAML |

### Quality Goals

| Goal | Scenario |
|---|---|
| DashBuilder compatibility | Existing DashBuilder YAML renders correctly without modification |
| Zero-Java runtime | Full rendering pipeline in TypeScript — no GWT compilation, no Java at runtime |
| Interactive filtering | Cross-component filtering, sorting, and pagination work end-to-end |
| Recursive composition | Any component nests inside any other — the tree is the API |
| Data–display separation | Data defined once, bound by reference; same dataset drives multiple components simultaneously |

---

## §2 Constraints

### Platform
TypeScript 5, React 17, Webpack 5. Yarn 4.10 workspaces. Node 18+.

### Build

```bash
yarn install && yarn build        # development
yarn build:prod                   # production (includes examples gallery)
```

---

## §3 Context and Scope

```
┌─────────────────────────────────────────────────┐
│                  Host Application                │
│  (DraftHouse, Claudony, DevTown, standalone)     │
│                                                  │
│   loadSite(tree) ──► @casehubio/pages-runtime      │
│                      ├── @casehubio/pages-ui       │
│                      ├── @casehubio/pages-data     │
│                      ├── @casehubio/pages-component│
│                      └── @casehubio/pages-viz      │
│                                                  │
│   hostPanel() ──► custom Web Components           │
│                                                  │
│   ◄── pages-filter, pages-sort, pages-event ──►   │
└─────────────────────────────────────────────────┘
         │                              │
  TypeScript DSL                  Data sources
  (or YAML string)         (REST, Prometheus, CSV,
                       WebSocket, SSE, expression)
```

**Boundary:** casehub-pages owns layout, data resolution, event delegation, panel hosting, and rendering. Domain logic (authentication, data source credentials) belongs to the host application.

---

## §4 Solution Strategy

### Data Flow

```
TypeScript DSL (or YAML string)
    ↓  (DSL builders / js-yaml)
Component tree + DataSourceBinding[]  — layout model (bind(id, source))
    ↓
DataSource.connect(sink)              — @casehubio/pages-data/datasource
    ↓                                   (inline, csv, rest, sse, ws, simulated, replay, composite)
DataSink → DataSetManager.apply()    — reactive: mutations cascade to bound components
    ↓
renderNode() / renderComponent()     — @casehubio/pages-component
    ↓
<pages-bar-chart> / hostPanel()      — @casehubio/pages-viz Web Components + custom panels
    ↓
pages-filter / pages-sort / pages-event — DOM custom events back to data layer
```

### Reactive Data Pipeline

The `DataSetManager` uses a unified event model — `apply(id, event)` accepts a discriminated union of four event types (snapshot, append, replace, remove). All sources — HTTP resolver, expression generator, WebSocket, SSE — produce `DataSetEvent` objects. The manager applies them uniformly, and changes cascade automatically to all bound components.

### Unified Data + Event Bus

Push sources (WebSocket, SSE) use a unified operation vocabulary routed by `op` field: `snapshot`, `append`, `replace`, `remove` for dataset mutations, `event` for inter-panel communication. One connection, one wire protocol. The `PushSource` abstraction encapsulates subscription lifecycle, reconnection, and error propagation. Errors are classified as transient (corrupt message, reconnecting) or permanent (auth expired, server-rejected 4000+). The runtime sets `target.error` only on permanent errors.

### Lazy Rendering for One-at-a-Time Containers

Tabs, pills, sidebar, carousel, and stack containers render only the active slot's children. On slot switch, the swap function tears down the old slot's DOM and renders the new slot lazily.

Key decisions:
- **Swap function as single owner** — each wire function (wireTabs, wireSidebar, wireCarousel, wireStack) builds one swap function that owns slot state, DOM lifecycle, button chrome, and event dispatch. Click handlers and `activateSlot` both delegate to it via a `slotSwapRegistry` WeakMap.
- **`slot-swap.ts` shared module** — consolidated `dispatchSlotChange` from interactive.ts and activate-slot.ts, eliminating duplication.
- **Registry eviction via `isConnected`** — `pages-slot-change` handler scans the registry and removes entries whose element is disconnected from the DOM. O(1) per entry.
- **Accordion stays eager** — all accordion sections start expanded, so lazy rendering would change UX.

### NavTree Page Deduplication

`parsePage` initially included pages both as top-level `content` slot entries AND as slot values inside navigation containers, causing N-fold DOM duplication. Fix: `collectNavTreePageNames` extracts all page names from navTree groups. These are filtered from the root `content` slot. `patchSlotReferences` recursively replaces unresolved page references in nav slots with their resolved versions.

### Cross-Filter Event Protocol

The filter flow (selector → `pages-filter` → listening component re-query) requires:
1. Event listener ordering — `renderComponent` must run AFTER `addEventListener` (custom elements dispatch `pages-data-request` synchronously during `connectedCallback`)
2. `@casehubio/viz` side-effect import — custom elements must be registered for `connectedCallback` to fire
3. `yamlLoad` call in the YAML string path

### i3-style Container Tree

The workspace compositor uses a recursive `Container` model — every entry can itself be a `Container`, forming an arbitrarily deep tree. Each container owns a `LayoutStrategy` that controls how its entries are arranged:

- **Tabbed** — tab strip with drag reorder, cross-container tab DnD, gap preview
- **Free layout** — absolute-positioned entries with drag/resize, zone snapping, arrange presets (grid, rows, columns, stack)
- **Split** (horizontal/vertical) — resizable split panes with divider drag, edge-split creation from tab drops
- **Accordion** — collapsible sections with per-entry height persistence
- **Content** — leaf strategy for single-entry display

Key decisions:
- **Container as the recursive primitive** — `Entry.childContainer` creates nesting. `containerizeEntry` wraps a leaf in a new container; `flattenEntry` collapses a single-child container back to a leaf. Depth is bounded by `ContainerPolicy.maxDepth`.
- **Strategy-per-layout, switchable at runtime** — `setLayout(type)` tears down the current strategy, creates a new one, and re-mounts entries. State is preserved per-layout in `Entry.meta`.
- **Edge splits** — dropping a tab on a container edge creates a split container, inserting the dropped entry alongside the target. Scoping (pane-level vs frame-level) is controlled by `ContainerPolicy`.
- **Toolbar per container** — each container renders a toolbar with layout cycle button and arrange dropdown (free layout only). Positioned at top, reactive to depth.

### Selection Context Bridge

Master-detail selection flows through `SelectionBridge` → `RuntimeContext` → parameterised datasets:
1. Component emits `pages-filter` with selection row
2. `SelectionBridge` captures row, updates `RuntimeContext.selection`
3. Dependent `DataSourceController` instances detect context change, re-resolve their dataset with selection parameters
4. `pages-selection-changed` event forwards selection state to host-panel components

### Scenario Engine

Scenarios are hierarchical YAML documents (chapters → sections → steps → commands) executed by distributed actors:

- **Backend orchestrator** (`scenario-runtime`) — parses YAML, interpolates variables, coordinates execution via push wire protocol. Stepping protocol supports pause/resume/step/speed control.
- **Executor client** (`scenario-client`) — CDI-discovered `@ScenarioAction` handlers. Each handler owns one command type. WebSocket client receives dispatch messages, routes to handlers, reports step results.
- **Browser executor** (`pages-aria`) — ARIA tree walker drives UI automation. Commands: `click`, `fill`, `select`, `assertState`, `waitFor`. Visual feedback overlays (highlights, typing animation) show what's happening.
- **Controller UI** — compact overlay with transport controls (play/pause/step/speed), outline view, dock/undock/detach. YAML viewer shows source with position tracking.
- **Data modes** — `@ScenarioAction` methods declare delivery mode: bulk (all at once), stepped (one row per step), stream (timed emission).

### Graph Model

`graph-core` provides a typed graph with grammar-based validation:

- **Model** — nodes, edges, containment tree (parent-child hierarchy). Nodes carry properties; edges carry source/target with optional port references.
- **StencilGrammar** — connection rules and port cardinality constraints, registered per node type. Validator enforces grammar before mutations land.
- **Edit operations** — add/remove/replace with pre-validation. Operations are atomic — grammar violations reject the entire edit.
- **PersistenceBackend SPI** — serialization contract; implementations handle storage.

`graph-renderer` bridges `graph-core` to React Flow + ELK:

- **Stencil wrapper** — custom node rendering pipeline. `StencilDescriptor` registry maps node types to React components.
- **ELK layout** — automatic layout from containment tree. Per-node size overrides, wrapping, direction-aware handle detection.
- **Edge routing** — crossing-aware shortest path with per-edge handle routing.
- **CSS isolation** — shadow-aware style injection with per-root ref-counting for multi-instance support.

### Design Tokens

`pages-ui-tokens` provides an OKLCH 12-step colour system with design tokens for spacing, typography, elevation, motion, and radius. Tokens are injected as CSS custom properties. Theme generation supports light and dark modes. All `pages-viz` and `pages-ui-components` consume tokens — no hardcoded colours.

---

## §5 Building Block View

| Package | Responsibility |
|---|---|
| `@casehubio/pages-ui-tokens` | OKLCH 12-step design tokens: colour scales, spacing, typography, elevation, motion, radius. Theme generation and injection. Must build before `pages-viz` |
| `@casehubio/pages-data` | DataSet model, reactive event engine (snapshot/append/replace/remove), filter/group/sort operations, external data extraction (JSON, CSV, Prometheus), push sources (PushSource interface, WebSocket, SSE, generic pool), JSONata expressions, `DatasetContract`, `ConnectionStatus`, segment-level wildcard matching (`matchesTopic`), group extraction (`extractGroupBoundaries`, `extractGroupTree`), `SourceConnector` lifecycle primitive |
| `@casehubio/pages-ui` | TypeScript DSL builders, YAML parser, DashBuilder backward compatibility (displayer desugaring, layout placement, nav desugaring), component model |
| `@casehubio/pages-viz` | Web Component wrappers: bar, line, area, pie, scatter, bubble, timeseries, timeline, heatmap, treemap, density-heatmap, meter, map, graph, metric, selector, event-timeline (vertical/horizontal/compact), grouped-view, action-button, alert, badge, countdown, legend, iframe-plugin, schema-form, form inputs (text, number, date, textarea) |
| `@casehubio/pages-component` | CSS grid layout renderer, interactive containers (tabs, pills, sidebar, carousel, stack, accordion), split layouts, dock bars, slot management, context subsystem (expression evaluator, template parser), `DataSourceController`, `createStandaloneConnector`, `emitPagesEvent`/`onPagesEvent` event helpers |
| `@casehubio/pages-primitives` | Lit-dependent UI primitives: a11y mixins (RovingTabindex, FocusTrap, KeyboardShortcut, LiveRegion) |
| `@casehubio/pages-table` | Data table Web Component (`<pages-table>`): TypedDataSet-native API with `columnRenderers` and `TableColumnConfig`, CSS Grid rendering, virtual scroll, sorting, filtering, column visibility, multi-mode selection, multi-column sort, tree/expandable rows, CSV export, ARIA grid, keyboard navigation, native `groupBy` |
| `@casehubio/pages-runtime` | Site orchestrator: `loadSite()` API, panel hosting, page navigation, data pipeline, event delegation, Container tree (frame-sandbox: tabbed/split/free-layout/accordion strategies with DnD, edge splits, toolbar, arrange presets), floating workspace (`wireFloatingWorkspace`, z-order, spatial nav, zone picker, keyboard, animations, snap), detach controller, dock bar, layout store/migration, selection bridge/forwarding, server pagination |
| `@casehubio/pages-filter-bar` | Standalone filter bar: type chips, entity dropdown, date range picker |
| `@casehubio/pages-ui-components` | Lit web components styled with design tokens: badge, button, checkbox, confirm-dialog, input, select, sparkline, status-dot, textarea, property-tree |
| `@casehubio/pages-aria` | ARIA-based browser automation for scenario demos: tree walker, command executor (`click`, `fill`, `select`, `assertState`, `waitFor`), scenario handler (push wire dispatch), visual feedback (highlights, typing animation), YAML viewer with syntax highlighting, scenario controller (compact overlay, transport controls, dock/undock, detach) |
| `@casehubio/graph-core` | Graph model (nodes, edges, containment tree), `StencilGrammar` registry (connection rules, port cardinality), constraint validator, edit operations (add/remove/replace), `PersistenceBackend` SPI, traversal, query |
| `@casehubio/graph-renderer` | React Flow + ELK layout bridge, stencil wrapper (custom node rendering pipeline), edge routing (crossing-aware shortest path), CSS isolation (shadow-aware per-root ref-counting), work stencil renderer, marketplace stencil registry |
| `@casehubio/graph-work-registry` | Marketplace work stencil discovery: YAML loader (fetch, parse, validate, cache), category index, palette-ready query API |
| `@casehubio/pages-examples` | Examples gallery: dev server, Playwright tests, sample validation, server-dependent examples tab |

**Iframe Component API** (`packages/`):
- `@casehubio/pages-iframe-api` — Component controller for iframe-isolated components
- `@casehubio/pages-iframe-dev` — Development utilities for component testing

**Standalone Components** (`components/`):
- `@casehubio/pages-component-llm-prompter` — LLM prompt engineering UI
- `@casehubio/pages-component-svg-heatmap` — SVG-based heatmaps
- `@casehubio/pages-component-terminal` — xterm.js Web Component

**Backend (Java)** (`backend/`):
- `casehub-pages-push` — Typed wire protocol SDK: `PushMessage` (server→client builders), `PushRequest` (sealed client→server parser with ack/error correlation), `TopicRegistry` (wildcard-aware connection tracking), `EventStore` SPI + `InMemoryEventStore` (bounded per-topic event replay). jackson-core only, no Quarkus
- `casehub-pages-push-runtime` — CDI producers for EventBroadcaster, TopicRegistry, EventStore. @DefaultBean InMemoryEventStore with configurable capacity. Consumer provides SessionSender. Quarkus Arc, no JPA
- `casehub-pages-push-store-jdbc` — JDBC durable event store implementation
- `casehub-pages-push-store-redis` — Redis durable event store implementation
- `casehub-pages-data` — Data provider SPI + REST relay/query resource, caching, filter/sort push-down. No JDBC
- `casehub-pages-data-sql` — SQL data provider via Agroal
- `casehub-pages-layout` — Layout persistence SPI (`LayoutPersistenceStore`) + REST resource
- `casehub-pages-layout-sqlite` — SQLite layout store implementation
- `casehub-pages-auth` — Dev authentication: token-based login resource
- `casehub-pages-mcp` — MCP server integration: ARIA command bridge, scenario resolver
- `casehub-pages-scenario` — Scenario model: hierarchical format parser (chapters/sections/steps/commands), ARIA targets, triggers, narrative content. J2CL-compatible
- `casehub-pages-scenario-client` — Distributed executor: WebSocket client, `@ScenarioAction` CDI handlers, sequence execution, step result reporting
- `casehub-pages-scenario-runtime` — Scenario orchestrator: variable interpolation, event-driven await, REST controller API, stepping protocol (pause/resume/step/speed)

---

## §6 Runtime View

### Application Loading

1. Host calls `loadSite(container, tree)` with a TypeScript DSL component tree (or YAML string)
2. Runtime parses input via `@casehubio/pages-ui` → `ComponentNode` tree + `DataSetDef[]`
3. Runtime registers event listeners for `pages-data-request`, `pages-filter`, `pages-sort`, `pages-page`, `pages-event`
4. Runtime calls `renderComponent()` → `@casehubio/pages-component` renders CSS grid layout
5. `hostPanel` activation mounts custom Web Components via `configure()` then `appendChild()`
6. Viz Web Components fire `pages-data-request` during `connectedCallback`
7. Runtime resolves each dataset via `@casehubio/pages-data` (HTTP, WebSocket, SSE, expression) and posts results back
8. Components render with ECharts / DOM

### Push Source Lifecycle

1. Component requests a dataset with `ws://` or `sse://` URL
2. Data pipeline acquires a `PushSource` from the pool (keyed by base URL, one connection per origin)
3. Pipeline calls `source.subscribe(dataSetId, def, listener, onError)` — WebSocket sends subscribe message, SSE is receive-only
4. Source receives wire messages with `op` field routing to dataset mutations (`snapshot`, `append`, `replace`, `remove`) or inter-panel events (`event`)
5. Dataset mutations apply to `DataSetManager`, cascading to all bound components
6. Errors classified as transient (logged, reconnect continues) or permanent (propagated to components via `target.error`)
7. `MutationObserver` detects component unmount, calls `source.unsubscribe(dataSetId)` when last subscriber disconnects
8. On dispose, pipeline disconnects observer, unsubscribes all push sources, releases pools

### Cross-Filtering

1. User clicks a data point (chart bar/slice, table cell, selector option, iframe message)
2. Emitter resolves `row` and `value` at dispatch time, emits `pages-filter` custom event with `PagesFilterApply` (discriminated union: `columnId`, `value`, `row`, `reset: false`, `group`) or `PagesFilterReset` (`columnId`, `reset: true`, `group`)
3. Runtime uses `detail.value` directly — no fallback logic or row extraction
4. If child DataScope exists and row contains `idColumn` → record selection path; otherwise → cross-filter path
5. Runtime re-queries listening components via the data pipeline with updated `FilterState`
6. Components re-render; emitters track selection via `_selectedValue` for toggle (click-again-to-deselect) and visual feedback (ECharts `highlight`/`downplay` for charts, `.selected` CSS for tables)

### Container Lifecycle

1. `wireFloatingWorkspace` creates the root `Container` with a `ContainerPolicy` and `ContentFactory`
2. `addEntry` creates an `Entry` (key, label) and delegates to the active `LayoutStrategy`
3. Strategy mounts the entry's DOM — tab in strip, absolute-positioned div, split pane, or accordion section
4. Tab drag fires `pages-tab-drag-start` → cross-container DnD transfers entries via `detachEntry`/`addEntry`
5. Edge drops trigger `onEdgeSplit` → `createSplitStrategy` wraps the target entry and the dropped entry in a new child container
6. `setLayout(type)` switches strategy at runtime — entries survive, only their arrangement changes
7. Layout state persists via `LayoutStore` (local or REST-backed) — `captureContainerState`/`restoreContainerFromState` serialize the full tree
8. `migrateFrameLayout` converts legacy `FrameLayout[]` to `ContainerState` for backward compatibility

### Scenario Execution

1. Host loads a scenario YAML document. Backend `HierarchicalParser` produces a `HierarchicalScenario` (chapters → sections → steps → commands)
2. `ScenarioOrchestrator` walks the tree, dispatching each command via push wire protocol to registered executors
3. Executor receives dispatch, routes to matching `@ScenarioAction` CDI handler, executes, reports `StepResult`
4. Browser executor (`pages-aria`) resolves ARIA targets via tree walker, executes UI commands (`click`, `fill`, `select`), overlays visual feedback
5. Stepping protocol — orchestrator supports pause/resume/step/speed. Controller UI renders transport controls
6. Data delivery — `@ScenarioAction` methods declare delivery mode (bulk/stepped/stream). Orchestrator adjusts emission timing
7. Narrative content — optional markdown per chapter/section/step, rendered in `pages-scenario-narrative` component

---

## §7 Deployment View

Packages published to GitHub Packages (`npm.pkg.github.com`) under the `@casehubio` scope. Host applications consume packages via Quarkus Quinoa — `npm install` at build time, static serving from `META-INF/resources/` at runtime. No Node.js at runtime.

Convention: `docs/quinoa-convention.md`. Reference template: `templates/quinoa-host/`.

The examples gallery serves at `localhost:8080` via webpack-dev-server (monorepo-internal, not published).

---

## §8 Crosscutting Concepts

| Concern | Approach |
|---|---|
| DashBuilder compatibility | `displayer-desugar.ts` maps DashBuilder YAML properties to casehub component model. `backwards-compat.ts` handles legacy field names. |
| Case-insensitive column matching | `column-lookup.ts` provides `findColumnIndex` with case-insensitive fallback for filter/group/sort operations |
| JSON resilience | `extraction.ts` handles trailing commas, single-quoted JSON, and flat primitive arrays from hand-authored YAML content |
| Column expressions | `cell-extract.ts` evaluates per-cell expressions via JSONata (`compileOrCached` from `jsonata-bridge.ts`). Sandboxed AST evaluation, CSP-safe. Replaces `new Function()` (#16) |
| Design tokens | OKLCH 12-step colour system (`pages-ui-tokens`). CSS custom properties injected at runtime. All viz and UI components consume tokens — no hardcoded colours. Light/dark theme generation |
| ARIA as interaction model | UI automation uses ARIA tree as the addressing layer — scenario commands target elements by role/name, not CSS selectors. Same tree drives accessibility and automated demos |
| J2CL compatibility | Backend core logic modules (scenario model, push protocol types) avoid JVM-only constructs (reflection, CDI, ConcurrentHashMap) so J2CL can transpile them to JS for browser/Node deployment |

---

## §9 Journeys and Chapters

### Chapter 1: TypeScript DataSet Core

**Status:** ✅ complete

GWT-to-TypeScript migration of the core data and rendering pipeline. All packages shipped: DataSet model, operations engine, YAML parser, Web Components, CSS grid layout, and site runtime.

| Milestone | Status |
|---|---|
| DataSet model + operations (group, sort, filter, aggregate) | ✅ shipped |
| Expression evaluator (JSONata bridge) | ✅ shipped |
| YAML parser + component schema | ✅ shipped |
| External data extraction (JSON, CSV, Prometheus) | ✅ shipped |
| @casehubio/pages-viz Web Components | ✅ shipped |
| @casehubio/pages-component CSS grid layout | ✅ shipped |
| @casehubio/pages-runtime — loadSite() | ✅ shipped |

### Chapter 2: Examples Gallery

**Status:** ✅ complete

Interactive gallery with sample pages, dev server, and Playwright smoke tests.

| Milestone | Status |
|---|---|
| Examples runner — host page + dev server | ✅ shipped |
| Axis and grid settings | ✅ shipped |
| Markdown parser | ✅ shipped |
| DashBuilder sample migration and validation | ✅ shipped |
| Global displayer defaults | ✅ shipped |
| Inline content extraction | ✅ shipped |
| Navigation types: tree, menu, tiles, sidebar | ✅ shipped |
| Case-insensitive column matching | ✅ shipped |
| Mock data for Prometheus examples | ✅ shipped |

### Chapter 3: Visual Diagram Editor

**Status:** ✅ complete (foundation)

Graph model, renderer, and marketplace stencil registry. Foundation for visual authoring of process and workflow diagrams.

| Milestone | Status |
|---|---|
| graph-core: model, grammar, validation, edit ops, persistence SPI (#264-#269) | ✅ shipped |
| graph-renderer: React Flow + ELK bridge, stencil wrapper, edge routing, CSS isolation (#270-#276) | ✅ shipped |
| graph-work-registry: marketplace YAML loader, category index, palette query (#280-#284) | ✅ shipped |

### Chapter 4: Workspace Compositor

**Status:** ✅ complete

i3-style Container tree with tabbed, split, free-layout, and accordion strategies. Floating workspace with snap, keyboard, animations, detach. Recursive container model.

| Milestone | Status |
|---|---|
| Floating workspace: types, pure functions, engine, backend, builder, activation, layout persistence (#46) | ✅ shipped |
| FloatingFrameEngine: auto-wire, pluggable chrome, tab-bar drag (#303) | ✅ shipped |
| Detach, organisers, snap, keyboard, animations (#304-#310) | ✅ shipped |
| i3-style Container tree — splits, tabs, accordion (#312) | ✅ shipped |
| Recursive container model — entries as nested Containers (#345) | ✅ shipped |
| Workspace centre as root Container (#369) | ✅ shipped |
| Edge splits, DnD, toolbar, arrange presets (#366-#371, #376) | ✅ shipped |

### Chapter 5: Scenario Engine

**Status:** 🔧 active

Hierarchical scenario execution with distributed actors, ARIA-driven browser automation, and demo controller UI.

| Milestone | Status |
|---|---|
| Scenario model: hierarchical format, parser, ARIA targets (#311, #315) | ✅ shipped |
| Scenario executor: ARIA tree driver, browser automation (#324) | ✅ shipped |
| Local executor base module, stepping protocol (#332, #333) | ✅ shipped |
| Data modes: bulk/stepped/stream delivery (#340) | ✅ shipped |
| Narrative content: markdown, templates, reveal.js (#342) | ✅ shipped |
| Controller UI: compact overlay, transport controls (#341, #347) | ✅ shipped |
| Browser executor: push wire for UI automation (#348) | ✅ shipped |
| YAML viewer: syntax highlighting, position tracking (#349) | ✅ shipped |
| Demo driver mode: start paused, restart (#350) | ✅ shipped |
| Visual feedback: highlights, focus rings, typing animation (#351) | ✅ shipped |
| Distributed executor protocol: @ScenarioAction CDI, orchestrator (#418) | ✅ shipped |
| MCP scenario domain (#419) | ✅ shipped |
| Spotlight targeting, RestStep, end-to-end demo (#356-#359) | 🔲 open |
| Scenario templates: parameterized @include (#327) | 🔲 open |
| Scenario assertions: server-side verification (#328) | 🔲 open |

### Backlog

| Issue | Title | Status |
|---|---|---|
| #12 | Lazy on-demand pagination for datasets | ✅ done |
| #14 | Domain-specific examples for the gallery | ✅ shipped |
| #15 | Accessibility: ARIA attributes, keyboard navigation, screen reader support | 🔲 open |
| #16 | CSP compliance: replace new Function() in column expressions | ✅ shipped |
| #17 | Theming system and dark mode support | ✅ shipped |
| #18 | Table data export (CSV, clipboard) | ✅ shipped |
| #19 | Loading and error states for components | ✅ shipped |
| #20 | Chart click → cross-filter event protocol | ✅ shipped |
| #21 | Optional Quarkus backend MVP | ✅ shipped |
| #22 | Server-side data provider: Prometheus | 🔲 open |
| #23 | Server-side data provider: Elasticsearch | 🔲 open |
| #24 | View state persistence (URL-based) | ✅ shipped |
| #25 | LLM-friendly API documentation for host application integration | ✅ shipped |
| #26 | Platform convention: Quarkus + TypeScript frontend via Quinoa | ✅ shipped |
| #28 | Remove redundant iframe ECharts component — migrate to inline Web Components | ✅ shipped |
| #35 | Map geo data loading — `registerMap()` for ECharts map/geo | ✅ done |
| #36 | Accumulate + expression for inline datasets | ✅ shipped |
| #44 | Minor polish for domain examples | ✅ done |
| #46 | Floating workspace — free-form frame management | ✅ shipped |
| #93 | Layout editor — drag-and-drop dashboard authoring UI | 🔲 open |
| #95 | Dashboard platform completion | 🔲 open |
| #142 | Scenario Engine — composition, triggers, remote control, demo UI (phases 5-7) | 🔲 open |
| #251-#255 | UI component library (badge, status-dot, dialog, button) | ✅ shipped |
| #256 | Durable EventStore implementation (JDBC/Redis) | ✅ shipped |
| #258 | Visual Diagram Editor — Foundation (graph-core, graph-renderer, graph-work-registry) | ✅ shipped |
| #285 | Dock workbench — IntelliJ-style dock layout compositor | ✅ shipped |
| #289 | Master-detail selection context for parameterised drill-down | ✅ shipped |
| #295-#301 | Heatmap, treemap, density heatmap chart wrappers | ✅ shipped |
| #309 | Floating workspace UX polish — detach, organisers, snap, keyboard | ✅ shipped |
| #312 | Workspace compositor — splits, tabs, accordion | ✅ shipped |
| #317 | DSL composition gaps — builders, metrics, event timeline, master-detail | ✅ shipped |
| #344 | J2CL transpilation strategy | 🔲 open |
| #345 | Recursive Container model — entries as nested Containers | ✅ shipped |
| #354 | Extract standalone pages-filter-bar component | ✅ shipped |

---

## §10 Architectural Decisions

Decisions not captured inline in §4:

| Decision | Rationale |
|---|---|
| Web Components over React for viz | Components must work inside any host framework (React, vanilla, GWT iframe). Web Components are framework-agnostic. |
| Custom events over callback API | `pages-filter`, `pages-sort`, `pages-event` decouple components from the runtime. Any host can intercept and handle events. |
| TypeScript DSL as primary API | Type-safe builders with IDE autocompletion. YAML supported for runtime-loaded pages (dynamic content). |
| DashBuilder YAML backward compat | Existing DashBuilder YAML still parses and renders. Parser handles both DashBuilder legacy and clean casehub format. |
| Unified event model for data mutations | snapshot/append/replace/remove as a discriminated union. All sources produce the same events. Enables reactive cascading. |
| PushSource interface for push sources | Encapsulates subscription lifecycle, reconnection, error propagation. WebSocket and SSE share the same wire protocol (`op` field routing), eliminating duplication. Generic `PushPool` factory reduces boilerplate. |
| Error propagation via `onError` callback | Separates data events (mutate datasets) from source health (component error state). Permanent errors set `target.error`, transient errors log and continue. |
| Unified data + event bus | WebSocket and SSE route both dataset mutations and inter-panel events through one connection. `op: "event"` dispatches `pages-event` DOM events; other ops apply to `DataSetManager`. Grafana separates EventBus and Live — we unify. |
| Backend data module: two-module split | `data` (SPI + REST relay/query, no JDBC) / `data-sql` (SQL provider via Agroal). Mirrors `layout`/`layout-sqlite`. Deployers who only need relay include one module; SQL push-down requires the second. |
| Base queries configured server-side | Frontend sends `dataSetId`, backend resolves to a registered SQL query. User-supplied SQL is never accepted — injection surface is zero for the base query path. |
| Three-layer SQL injection prevention | Filter values → bind parameters. Column IDs → validated against allowlist from base query metadata. Column names → ANSI-quoted in generated SQL. |
| serverQuery as fourth source type | `ExternalDataSetDef.serverQuery` is a distinct source alongside url/content/join. YAML operations are pushed to SQL; runtime interactive ops (cross-filters, user sort) apply client-side on the aggregated result. |
| SSRF relay: no redirect following | `HttpClient.Redirect.NEVER` prevents redirect-based SSRF bypassing validateTarget(). Redirects inside the HTTP client layer would skip application-level validation. |
| Segment-level wildcard patterns | `*` matches one segment, `**` matches zero or more (last position only). MQTT-inspired convention adapted for `:` delimiters. `TopicRegistry.matches()` (Java) and `matchesTopic()` (TypeScript) produce identical results. |
| Lit for UI component primitives | `pages-primitives` uses Lit 3.3 for a11y mixins, form components, and UI widgets. `pages-component` stays framework-agnostic (vanilla TypeScript). Separation keeps Lit at the leaf level — data and rendering pipeline are framework-free. |
| Container as recursive primitive | `Entry.childContainer` creates arbitrary nesting. `containerizeEntry`/`flattenEntry` manage depth. Strategy-per-layout, switchable at runtime — entries survive layout changes. Bounded by `ContainerPolicy.maxDepth`. |
| OKLCH design tokens | 12-step perceptually uniform colour scales generated from OKLCH. CSS custom properties, not Sass variables — runtime theme switching without rebuild. All downstream components consume tokens. |
| ARIA as unified interaction model | Scenario automation and accessibility share one addressing layer — the ARIA tree. Commands target elements by role/name, not CSS selectors. Same tree serves screen readers and automated demos. |
| Grammar-validated graph model | `StencilGrammar` enforces connection rules and port cardinality before mutations land. Edit operations are atomic — violations reject entirely. Prevents invalid graph states from reaching the renderer. |
| React Flow for graph rendering | React Flow provides the interaction layer (pan/zoom/selection/DnD); ELK provides automatic layout. Stencil wrapper bridges custom node types to React Flow nodes. CSS isolation handles multi-instance shadow DOM. |
| Hierarchical scenario format | Chapters → sections → steps → commands. Structure mirrors presentation (narrative content per level) and execution (orchestrator walks the tree). Flat step lists would lose grouping and narrative placement. |
| Distributed executor pattern | Scenario execution is not monolithic — each `@ScenarioAction` handler is a CDI bean discovered at startup. Browser, backend, and MCP executors run independently, connected via push wire protocol. Enables multi-service demo orchestration. |
| J2CL-compatible core logic | Backend scenario model and push protocol types avoid JVM-only constructs. Enables future transpilation to JS for browser-only or Node.js deployment. CDI adapters are exempt — they don't transpile. |
| Layout persistence SPI | `LayoutStore` interface with local (localStorage) and REST-backed implementations. Container tree serializes to `ContainerState` — full tree captured/restored. Migration path from legacy `FrameLayout[]` format. |

---

## §11 Quality Requirements

| Requirement | Metric |
|---|---|
| DashBuilder compatibility | 28/31 sample pages render correctly (validation matrix: `examples/VALIDATION.md`) |
| Test coverage | 1229 tests (@casehubio/data), 331 tests (@casehubio/component), 1535 tests (@casehubio/runtime), 108 tests (@casehubio/graph-core), 78 tests (@casehubio/graph-renderer), 14 Playwright spec files (smoke + gallery + domain examples) |
| No Java at runtime | `loadSite()` works without GWT compilation or Java process |

---

## §12 Risks and Technical Debt

| Risk | Impact | Mitigation |
|---|---|---|
| ~~`new Function()` requires CSP `unsafe-eval`~~ | Resolved (#16) | Column expressions migrated to JSONata AST evaluation. No `unsafe-eval` required |
| Map geo data requires CDN fetch | Maps depend on jsDelivr CDN at runtime for world GeoJSON | Resolved (#35) — lazy-loaded with cache and error handling; offline renders error instead of empty chart |

---

## §13 Glossary

| Term | Definition |
|---|---|
| `DataSet` | Column-oriented tabular data — the wire format between data resolution and visualization |
| `DataSetLookup` | A query against a named dataset: filter → group → sort pipeline |
| `DataSetEvent` | Discriminated union of mutation types: snapshot, append, replace, remove |
| `ComponentNode` | A node in the parsed layout tree — carries type, props, slots (children), and optional dataset reference |
| `loadSite()` | Entry point: accepts component tree or YAML string, renders into a DOM container, returns a dispose handle |
| `NavTree` | Navigation structure: groups of named pages rendered as tabs, tree, menu, or tiles |
| `PushSource` | Interface for push-based data sources (WebSocket, SSE). Encapsulates subscription lifecycle, reconnection, and error propagation. |
| `PushSourceError` | Error from a push source — `message` and `permanent` flag. Permanent errors propagate to components (`target.error`), transient errors log and continue. |
| `PushPool` | Generic pool factory for push sources. One connection per base URL, shared across subscriptions. Configurable via `DataProviderConfig`. |
| `hostPanel` | Component type that mounts a registered custom Web Component inside the pages tree. Host app calls `registerPanel(typeName, tagName)` before `loadSite()`. |
| `pages-event` | DOM custom event for inter-panel communication. Dispatched by panels, listened on `document`, bubbles through Shadow DOM via `composed: true`. |
| `Container` | Recursive workspace primitive — holds entries, owns a `LayoutStrategy`, enforces a `ContainerPolicy`. Entries can themselves contain child containers, forming an arbitrarily deep tree. |
| `LayoutStrategy` | Pluggable arrangement for a container's entries: tabbed, free-layout, split (h/v), accordion, or content (leaf). Switchable at runtime via `setLayout()`. |
| `ContainerPolicy` | Constraints on a container tree: allowed layout types and maximum nesting depth. `DEFAULT_POLICY` allows free/tabbed/accordion; `SPLIT_POLICY` adds horizontal/vertical splits. |
| `ContainerState` | Serializable snapshot of a full container tree — entries, layout type, per-layout state, child container states. Used by `LayoutStore` for persistence. |
| `StencilGrammar` | Connection rules and port cardinality constraints for a graph node type. Validator enforces grammar before edit operations land. |
| `StencilDescriptor` | Registration of a graph node type — maps a type name to a React component, declared ports, and rendering metadata. |
| `HierarchicalScenario` | Parsed scenario document: chapters → sections → steps → commands. Structure mirrors both narrative presentation and execution flow. |
| `@ScenarioAction` | CDI qualifier for scenario command handlers. Each handler owns one command type, discovered at startup. Executor routes dispatched commands to matching handlers. |
| `SelectionBridge` | Connects component selection events to `RuntimeContext.selection`. Enables master-detail flows where selecting a row in one component parameterises datasets in another. |
| `DetachController` | Manages pop-out of pages content to separate browser windows. Copies styles, relays events, and synchronizes data pipeline across windows. |

---

*Created 2026-06-17. Updated 2026-08-26 — added Container tree compositor, scenario engine, graph model, design tokens, selection bridge, new backend modules (data, layout, scenario, auth, MCP, durable event stores), expanded viz and UI component surface.*
