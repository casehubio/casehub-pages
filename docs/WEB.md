# casehub-pages — Web Architecture

**Tier:** Foundation  
**Position:** Frontend runtime for CaseHub platform applications  
**Repository:** casehubio/casehub-pages  
**Scope:** Pure TypeScript dashboard/workbench framework — zero upstream CaseHub dependencies

## Tier Position

casehub-pages is the **Foundation tier** in the CaseHub platform hierarchy:

```
                   DraftHouse, Claudony, DevTown
                   (Application tier — domain logic)
                              ↓
                      casehub-pages
                   (Foundation tier — UI framework)
                              ↓
                    Apache ECharts, JSONata
                   (npm packages — visualization)
```

**Foundation tier characteristics:**
- No upstream CaseHub dependencies (platform, engine, worker)
- Consumed by application-tier projects via npm packages
- Published to GitHub Packages under `@casehubio` scope
- Zero build-time coupling — runtime-only consumption via iframe embedding or direct integration

**Not an application.** casehub-pages provides the primitives — layout, data pipeline, visualization, panel hosting — that applications compose into workbench shells, dashboards, CRUD interfaces, and custom UIs.

## Package Architecture

casehub-pages is a TypeScript monorepo managed with Yarn workspaces. Build order matters: packages → components → webapp → examples.

### Monorepo Structure

```
packages/            Core TypeScript libraries
components/          Iframe-isolated React microfrontend visualization components
webapp/              Webpack orchestrator — assembles final application bundle
examples/            Interactive examples gallery
_legacy/             Former Java/GWT core (reference only, not built)
```

### Package Dependency Graph

```
                    pages-ui
                   (DSL, YAML)
                        ↓
                   pages-data ──────────────┐
              (DataSet, operations,         │
               push sources, JSONata)       │
                        ↓                   │
                 pages-component ←──────────┘
              (Layout renderer,
               interactive containers)
                        ↓
                    pages-viz
               (Web Component wrappers)
                        ↓
                  pages-runtime
              (Site orchestrator,
               panel hosting,
               data pipeline)
```

**Dependency order (build sequence):**

1. `@casehubio/pages-data` — DataSet model, reactive event engine (snapshot/append/replace/remove), filter/group/sort operations, external data extraction (JSON, CSV, Prometheus), push sources (PushSource interface, WebSocket, SSE, generic pool), JSONata expressions
2. `@casehubio/pages-component` — Component type model, CSS grid layout renderer, interactive containers (tabs, pills, sidebar, carousel, stack, accordion), split layouts, dock bars, slot management
3. `@casehubio/pages-viz` — Web Component wrappers: bar, line, area, pie, donut, bubble, timeseries, meter, map, table, metric, selector
4. `@casehubio/pages-ui` — TypeScript DSL builders, YAML parser, DashBuilder backward compatibility (displayer desugaring, layout placement, nav desugaring), component model
5. `@casehubio/pages-runtime` — Site orchestrator: `loadSite()`, panel hosting (`registerPanel`, `hostPanel`), page navigation, data pipeline, event delegation
6. `@casehubio/pages-examples` — Examples gallery: dev server, Playwright tests, sample validation

**Key architectural boundaries:**

- `pages-data` has zero UI dependencies — pure data structures, operations, and external source resolvers
- `pages-component` depends on `pages-data` for type definitions but doesn't execute data operations
- `pages-viz` wraps ECharts and DOM rendering — no awareness of the data pipeline
- `pages-ui` provides the DSL surface but doesn't render — parsing only
- `pages-runtime` wires everything together — it's the only package that imports all others

### Iframe Component API

Separate packages for building iframe-isolated components:

- `@casehubio/pages-iframe-api` — Component controller for iframe-isolated components
- `@casehubio/pages-iframe-dev` — Development utilities for component testing
- `@casehubio/pages-echarts-base` — Reusable ECharts wrapper library

**Standalone iframe components** (published separately):

- `@casehubio/pages-component-echarts` — Apache ECharts visualizations
- `@casehubio/pages-component-llm-prompter` — LLM prompt engineering UI
- `@casehubio/pages-component-svg-heatmap` — SVG-based heatmaps

These are legacy — the migration path is to replace iframe components with inline Web Components (`pages-viz`).

## Data Flow Pipeline

The complete rendering pipeline from YAML/DSL to rendered DOM:

```
TypeScript DSL (or YAML string)
    ↓  (DSL builders / js-yaml)
Component tree + DataSetDef[]       — layout model
    ↓
resolveDataSet() / PushSource       — @casehubio/pages-data
    ↓
DataSet (columns + rows)            — reactive: mutations cascade to bound components
    ↓
renderNode() / renderComponent()    — @casehubio/pages-component
    ↓
<pages-bar-chart> / hostPanel()     — @casehubio/pages-viz Web Components + custom panels
    ↓
pages-filter / pages-sort / pages-event — DOM custom events back to data layer
```

### Reactive Data Pipeline

The `DataSetManager` uses a unified event model — `apply(id, event)` accepts a discriminated union of four event types:

| Event Type | Purpose | Fields |
|------------|---------|--------|
| `snapshot` | Replace entire dataset | `dataset: TypedDataSet` |
| `append` | Add rows to end | `rows: TypedRow[]`, `maxRows?: number` |
| `replace` | Update a specific row | `keyColumn: ColumnId`, `key: string`, `row: TypedRow` |
| `remove` | Delete a specific row | `keyColumn: ColumnId`, `key: string` |

All sources — HTTP resolver, expression generator, WebSocket, SSE — produce `DataSetEvent` objects. The manager applies them uniformly, and changes cascade automatically to all bound components.

### Pull Sources (HTTP)

1. Component requests dataset via `pages-data-request` custom event
2. Data pipeline resolves dataset definition from scope (global, page-scoped, or DataScope)
3. External resolver fetches data via HTTP, parses JSON/CSV/Prometheus
4. Result posted back to component via `element.dataSet = dataset`
5. Refresh timers schedule periodic re-fetch if `refreshTime` is set

### Push Sources (WebSocket / SSE)

1. Component requests dataset with `ws://` or `sse://` URL
2. Data pipeline acquires a `PushSource` from the pool (keyed by base URL, one connection per origin)
3. Pipeline calls `source.subscribe(dataSetId, def, listener, onError)` — WebSocket sends subscribe message, SSE is receive-only
4. Source receives wire messages with `op` field routing to dataset mutations (`snapshot`, `append`, `replace`, `remove`) or inter-panel events (`event`)
5. Dataset mutations apply to `DataSetManager`, cascading to all bound components
6. Errors classified as transient (logged, reconnect continues) or permanent (propagated to components via `target.error`)
7. `MutationObserver` detects component unmount, calls `source.unsubscribe(dataSetId)` when last subscriber disconnects
8. On dispose, pipeline disconnects observer, unsubscribes all push sources, releases pools

## Push Source Architecture

### PushSource Interface

Encapsulates subscription lifecycle, reconnection, and error propagation for push-based data sources.

```typescript
interface PushSourceError {
  readonly message: string;
  readonly permanent: boolean;
}

interface PushSource {
  subscribe(
    dataSetId: DataSetId,
    def: ExternalDataSetDef,
    listener: DataSetEventListener,
    onError: (error: PushSourceError) => void,
  ): void;
  unsubscribe(dataSetId: DataSetId): void;
  close(): void;
}
```

**Implementations:**

- `createWebSocketSource(baseUrl, config?, WSConstructor?)` — WebSocket implementation with reconnection backoff
- `createSseSource(baseUrl, config?, ESConstructor?)` — SSE implementation using browser's `EventSource` API

**Generic pool factory:**

```typescript
interface PushPool {
  configure(config: PushSourceConfig): void;
  acquire(baseUrl: string): PushSource;
  releaseAll(): void;
}

function createPushPool(
  factory: (baseUrl: string, config?: PushSourceConfig) => PushSource,
): PushPool
```

One pool per source type (WebSocket, SSE). One connection per base URL, shared across all subscriptions to that origin.

### Wire Protocol

Unified operation vocabulary routed by `op` field:

```json
{"op": "snapshot", "dataset": "metrics", "seq": "1", "columns": [...], "rows": [...]}
{"op": "append", "dataset": "metrics", "seq": "2", "columns": [...], "rows": [[...]]}
{"op": "replace", "dataset": "metrics", "seq": "3", "columns": [...], "row": [...], "key": "id-123"}
{"op": "remove", "dataset": "metrics", "seq": "4", "key": "id-123"}
{"op": "event", "topic": "selection-changed", "payload": {"location": "line:42"}}
```

**Shared message processing:** `processWireMessage()` in `push-source.ts` handles all ops uniformly. Both WebSocket and SSE call the same function — eliminates ~100 lines of duplication.

### Error Propagation

Errors classified by `permanent` flag:

- **Transient** (corrupt message, reconnecting) — `onError({ message, permanent: false })` → logged via `console.warn`, reconnection continues
- **Permanent** (auth expired, server-rejected close code 4000+) — `onError({ message, permanent: true })` → propagated to components via `target.error`, no further reconnection attempts

**Close code tiers (WebSocket):**

| Code Range | Tier | Action |
|------------|------|--------|
| 1000 | Normal Closure | Silent — intentional close by server |
| 1001, 1006 | Network/Protocol | Reconnect with backoff — no error emitted |
| 1002–1015 | Protocol Errors | Log warning — developer bugs, not user-facing |
| 4000+ | Application Errors | Permanent error — propagate to components |

**SSE limitation:** The `EventSource` API only transitions to `CLOSED` readyState for HTTP-level failures (non-200 status, wrong content-type). Network-level failures (DNS, connection refused, TLS errors) leave `readyState === CONNECTING` with indefinite automatic reconnection — the browser never signals a permanent failure. SSE error propagation covers HTTP errors but not network-level permanent failures.

### Subscription Lifecycle

**MutationObserver-based cleanup:**

The runtime uses a `MutationObserver` to detect component unmount (element disconnected from DOM). When a component is removed:

1. Observer fires with `removedNodes` batch
2. Runtime checks if any removed element is (or contains) a registered viz element
3. Defers check via `queueMicrotask` (handles DOM moves — detach + reattach)
4. If element is still disconnected, remove component from `pushSubscribers` tracking map
5. If no subscribers remain for that dataset, call `source.unsubscribe(dataSetId)` and remove from pool

**Why not `disconnectedCallback()`:** Web Components can't dispatch bubbling events from `disconnectedCallback` (no parent). Dispatching on `document` loses natural scoping to the target element. MutationObserver is scoped, requires zero viz-layer changes, and the runtime controls its own lifecycle.

**Dispose cleanup:**

```typescript
dispose(): void {
  if (observer) { observer.disconnect(); observer = undefined; }
  for (const timer of refreshTimers.values()) clearInterval(timer);
  refreshTimers.clear();
  for (const [dataSetId, source] of pushSubscriptions) source.unsubscribe(dataSetId);
  pushSubscriptions.clear();
  pushSubscribers.clear();
  wsPool.releaseAll();
  ssePool.releaseAll();
  for (const controller of abortControllers.values()) controller.abort();
  abortControllers.clear();
  pendingResolutions.clear();
}
```

Disconnect observer **before** DOM teardown to avoid spurious cleanup during `target.innerHTML = ""`.

## Event System Catalog

All communication uses DOM custom events with `bubbles: true, composed: true`.

| Event | Emitted By | Listened By | Detail Type | Purpose |
|-------|-----------|-------------|-------------|---------|
| `pages-data-request` | Viz components | Runtime | `{ element, lookup }` | Request dataset resolution |
| `pages-filter` | Selectors, tables, charts, iframe plugins | Runtime | `PagesFilterDetail` | Cross-component filtering |
| `pages-sort` | Table (server-side) | Runtime | `{ columnId, order }` | Server-side sorting |
| `pages-page` | Table (server-side) | Runtime | `{ offset, count }` | Server-side pagination |
| `pages-field-change` | Form inputs | Runtime | `{ field, value, committed }` | Form field editing |
| `pages-slot-change` | Navigation components | Runtime | `{ activeSlot, containerId }` | Slot switching |
| `pages-dock-toggle` | Dock bar | Runtime | `{ panelId, visible }` | Panel visibility toggle |
| `pages-event` | Custom panels, push sources | Runtime + panels | `{ topic, payload }` | Inter-panel communication |

**Event delegation pattern:** Runtime registers listeners once on the target container. Events bubble up from components. Single registration point, no per-component listener management.

## Component Model

### Component Tree

Every UI element is a `Component` object:

```typescript
interface Component {
  readonly type: string;          // "page", "bar-chart", "table", "tabs", etc.
  readonly id?: string;           // Unique identifier (auto-generated for grids)
  readonly props?: object;        // Type-specific configuration
  readonly style?: Record<string, string>;  // Inline CSS overrides
  readonly slots?: Record<string, readonly Component[]>;  // Named child slots
  readonly items?: readonly GridItem[];     // Grid placement items
}
```

**Rendering pipeline:**

1. `renderNode(component, container)` — entry point
2. Dispatch to layout branch (has `slots` or `items`) or leaf branch (activation callback)
3. Layout types apply CSS, render children recursively
4. Leaf types activate via `onNode(component, element)` callback

### PagesElement Interface

Web Components in `pages-viz` implement:

```typescript
interface PagesElement extends HTMLElement {
  dataSet: unknown;        // Dataset posted from runtime
  totalRows: number;       // Total row count (for pagination)
  theme: string;           // Current theme ("light" | "dark")
  error: string;           // Error message (permanent push source errors)
  activeSort: SortColumn | undefined;   // Active sort column
  activePage: number | undefined;       // Current page number
}
```

**Activation sequence:**

1. Component rendered → container `<div>` created and appended to DOM
2. `onNode` callback fires (in `activation.ts`)
3. For data components: custom element created, appended → `connectedCallback()` fires
4. `connectedCallback` dispatches `pages-data-request` with `{ element, lookup }`
5. Runtime resolves dataset, posts result back via `element.dataSet = dataset`
6. Component renders with ECharts / DOM

**For `hostPanel`:**

1. `onNode` looks up registered tag name from type registry
2. If not found → render error placeholder: `"Unknown panel type: <typeName>"`
3. Create custom element: `document.createElement(tagName)`
4. Call `panel.configure(props)` if method exists — **before** `appendChild`
5. Append to container → `connectedCallback()` fires
6. Panel initializes, registers event listeners via `document.addEventListener("pages-event", ...)`

### Component Registry

Runtime maintains a `ComponentRegistry` — `Map<string, ComponentEntry>`:

```typescript
interface ComponentEntry {
  component: Component;
  vizElement: PagesElement | null;
  originalLookup: DataSetLookup | null;
  pagePath: string;
}
```

Keyed by component ID. Used by:
- Data pipeline to re-query components on filter/sort/pagination events
- Push source subscription tracking (which components depend on which datasets)
- MutationObserver to detect unmounted components

## Workbench Primitives

Three new component types for building resizable workbench layouts:

### split

Resizable layout with drag handles between children. Uses flex layout (not CSS Grid) so hidden children redistribute space automatically.

**Rendering:**
- `applyLayoutCSS`: sets `display: flex` with `flex-direction: row` (horizontal) or `flex-direction: column` (vertical)
- `wireInteractivity`: applies `flex: <ratio>` to each child, inserts drag handles, attaches mouse handlers

**Resize:** drag adjusts `flex` values of adjacent children. `minSizes` enforced during drag.

**Hidden child handling:** when a dock toggle hides a child, its drag handle is also hidden. Flex redistributes space to siblings.

### dockBar

Icon strip that toggles visibility of referenced components by ID. Click dispatches `pages-dock-toggle` → runtime finds element by `data-component-id` → toggles `display: none`.

**Rendering:** `onNode` activation callback (same path as `hostPanel`, data components):
1. Read `component.props.items` (DockItem[])
2. Create icon buttons inside container div
3. Attach click handlers that dispatch `pages-dock-toggle`
4. Set initial `data-active` state from `defaultOpen` props

**State persistence:** Dock open/closed state persists in URL hash (`?dock=debate:open,review:closed`).

### hostPanel

Mounts a registered custom Web Component inside the pages component tree.

**Registration:** Host app calls `registerPanel(typeName, tagName)` before `loadSite()`. Stores `Map<string, string>` — type name to custom element tag.

**Mount sequence:** (see Component Model → PagesElement Interface above)

## Cross-Filter Event Protocol

Selectors, tables, charts, and iframe components emit `pages-filter` events on user interaction. Listening components re-query with updated `FilterState`.

**Event detail (discriminated union):**

```typescript
type PagesFilterDetail = PagesFilterApply | PagesFilterReset;

interface PagesFilterApply {
  readonly columnId: string;
  readonly value: string;      // Resolved by emitter at dispatch time
  readonly row: TypedRow;       // Full row reference
  readonly reset: false;
  readonly group: string | undefined;
}

interface PagesFilterReset {
  readonly columnId: string;
  readonly reset: true;
  readonly group: string | undefined;
}
```

**Key behaviors:**

- **Emitters resolve `value` and `row` at dispatch time.** The runtime never extracts values from the row or falls back to positional indices.
- **Toggle semantics:** All emitters (except slider and iframe components) support click-to-select, click-again-to-deselect. Charts and tables track `_selectedValue`; selectors track `_selectedValue` for labels.
- **Visual feedback:**
  - Charts use ECharts `highlight`/`downplay` actions (same appearance as hover).
  - Tables use `.selected` CSS class (`background: var(--pages-bg-selected, #e8f0fe)`).
  - Selectors use label chip highlighting (existing behavior).
- **NULL values:** Emitters skip the event when the resolved cell value is NULL.
- **Record selection:** Any component (not just tables) can trigger DataScope record selection if the emitted row contains the child DataScope's `idColumn`. The runtime infers the path from the data shape via try/catch on `row.cell(idColumn)` for apply events and `ds.columns.some()` for reset events.

## Deployment

Packages published to GitHub Packages (`npm.pkg.github.com`) under the `@casehubio` scope. Host applications consume packages via Quarkus Quinoa:

1. `npm install` at build time (triggered by Maven)
2. Webpack bundles TypeScript → static JS/CSS
3. Quinoa copies output to `META-INF/resources/`
4. Static serving from Quarkus at runtime — no Node.js process

**Convention:** `docs/quinoa-convention.md`  
**Reference template:** `templates/quinoa-host/`

The examples gallery serves at `localhost:8080` via webpack-dev-server (monorepo-internal, not published).

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Web Components over React for viz | Components must work inside any host framework (React, vanilla, GWT iframe). Web Components are framework-agnostic. |
| Custom events over callback API | `pages-filter`, `pages-sort`, `pages-event` decouple components from the runtime. Any host can intercept and handle events. |
| TypeScript DSL as primary API | Type-safe builders with IDE autocompletion. YAML supported for runtime-loaded pages (dynamic content). |
| PushSource interface for push sources | Encapsulates subscription lifecycle, reconnection, error propagation. WebSocket and SSE share the same wire protocol (`op` field routing), eliminating duplication. Generic `PushPool` factory reduces boilerplate. |
| Error propagation via `onError` callback | Separates data events (mutate datasets) from source health (component error state). Permanent errors set `target.error`, transient errors log and continue. |
| Unified data + event bus | WebSocket and SSE route both dataset mutations and inter-panel events through one connection. `op: "event"` dispatches `pages-event` DOM events; other ops apply to `DataSetManager`. Grafana separates EventBus and Live — we unify. |
| MutationObserver for subscription cleanup | Detects component unmount without requiring `disconnectedCallback` changes in viz layer. Scoped to target element, runtime owns lifecycle. |
| Flex layout for `split`, Grid for `columns` | Flex redistributes space when children hide (dock toggles). Grid leaves dead tracks. Separate types with clear CSS semantics. |
| `configure()` before `appendChild()` | Ensures event listeners can be registered during `configure()` before `connectedCallback()` fires. Critical for panel initialization order. |

## Testing

| Package | Test Count | Framework | Scope |
|---------|-----------|-----------|-------|
| `pages-data` | 615 tests | Vitest | DataSet model, operations, external resolvers, push sources |
| `pages-component` | 158 tests | Vitest | Layout rendering, slot management, split/dock/hostPanel |
| `pages-runtime` | 183 tests | Vitest | Site orchestration, data pipeline, event delegation |
| `pages-examples` | 77 tests | Playwright | Smoke tests, gallery rendering, domain examples |

**Integration tests:** Full workbench render, dock bar ↔ split interaction, event round-trip (panel A → `pages-event` → panel B), WebSocket/SSE event routing.

**Garden entries referenced:**
- GE-20260617-0b0dba: `configure()` before `appendChild()` ordering
- GE-20260617-cc0834: Keyboard event target walking through Shadow DOM
- GE-20260623-06914b / GE-20260629-ebdb0a: Bundler config for hosted Web Components (`sideEffects: true`)

## Documentation

| Document | Scope |
|----------|-------|
| `CLAUDE.md` | Project conventions (build, test, naming) |
| `ARC42STORIES.MD` | Arc42 architecture documentation — system context, building blocks, runtime view, decisions |
| `CASEHUB-PAGES.MD` | LLM integration guide — API documentation, DSL builders, examples |
| `WEB.md` (this file) | Web architecture — tier position, package architecture, data flow, push sources, event system, component model |
| `docs/quinoa-convention.md` | Quarkus + Quinoa integration pattern |
| `templates/quinoa-host/` | Reference template for host applications |

---

*Created 2026-06-30. Reflects implemented state after workbench primitives + push source abstraction epic.*
