# casehub-pages

A web application framework where YAML is the programming language.

Declare data sources, layouts, charts, forms, tables, real-time streams, and inter-component communication in a single `.page.yaml` file. The runtime compiles it into a reactive application — no JavaScript required. When you need programmatic control, an equivalent TypeScript DSL gives you full IDE autocompletion and type safety over the same component model.

115 working examples ship with the framework. Run `./gallery.sh` to see them.

```yaml
datasets:
  - uuid: sales
    url: /api/sales

pages:
  - name: Sales
    grid:
      - at: { x: 0, y: 0, w: 6, h: 2 }
        type: bar
        properties:
          title: Revenue by Region
          lookup:
            uuid: sales
            group: { by: Region, columns: [Region], functions: [sum(Revenue)] }

      - at: { x: 6, y: 0, w: 6, h: 2 }
        type: data-table
        properties:
          lookup: { uuid: sales }
          sortable: true
          filter: { enabled: true }
```

Both components bind to the same dataset. Filter one, the other updates. Change the data source, nothing else moves.

Licensed under the Apache License, Version 2.0.

---

## What you can build

Pages is not a charting library. It is a composition framework for entire applications.

**Monitoring** — 13 production-grade monitoring pages ship as examples: Prometheus, OpenTelemetry, JVM, Quarkus, Ansible, Backstage, JupyterHub, Kepler, ModelMesh, Triton inference server. Real-time WebSocket push with event replay and automatic reconnection.

**CRUD applications** — Helpdesk ticketing, contact management, task tracking. Schema-driven forms with validation, master-detail layouts, data-scoped record editing with auto-save.

**Workbench IDEs** — Split panes, dockable panels, tabbed editors, floating workspaces. Mount your own Web Components (terminals, diff viewers, code editors) and let Pages manage layout and lifecycle.

**Graph editors** — Interactive node-and-edge diagrams with ELK auto-layout, drag-and-drop from stencil palettes, multi-select, nested sub-graphs.

**Playbook orchestration** — Visual workflow authoring with control flow (if/else, match, try/catch), concurrency primitives (parallel, barrier, race, quorum), decorators (timeout, retry, loop, guard), and time-controllable simulation.

**Data exploration** — Cross-filtered charts and tables, drill-through navigation, grouped and tree views, virtual-scroll tables with 10k+ rows, CSV export, heatmaps, treemaps, timeseries.

---

## Run the examples gallery

### Client-side only (no backend needed)

```bash
./gallery.sh
```

Installs dependencies, builds packages, and starts a webpack dev server at `http://localhost:8080` with hot reload. Browse all examples by category: Charts, Tables, Forms, Layout, Monitoring, Scenarios, Graph Editing, Grid Editing, Domain Showcases, Theming, and more.

First run takes ~60 seconds to build packages; subsequent starts are near-instant.

### With the Java backend (real-time push, server data)

```bash
./gallery-server.sh
```

Starts the Quarkus backend on port 8090 (WebSocket push, event generators, Prometheus relay) and the gallery on port 8080. The gallery proxies `/api/` and `/ws/` to the backend automatically. The Server category examples come alive — live event streams, multi-topic push, reconnect with replay.

**Prerequisites:** Node.js 18+, Java 21+ (for server mode only).

---

## Core design

### YAML is the programming language

A `.page.yaml` file is a complete application definition: data sources, layouts, components, navigation, interactivity, and styling. The runtime parses it into a reactive component tree and manages everything — data fetching, event propagation, lifecycle, and rendering.

There is no "YAML config layer over a real API." The YAML surface **is** the API. It drives the same component model as the TypeScript DSL.

### Data-display separation

Data is defined once and bound by reference. The same dataset drives a chart, a table, and a form simultaneously. Swap the visualization without touching the data. Change the source without touching the components.

```yaml
datasets:
  - uuid: tickets
    url: /api/tickets             # REST endpoint
  - uuid: events
    url: ws://localhost:8090/push  # real-time WebSocket
  - uuid: metrics
    url: http://prometheus:9090   # Prometheus PromQL
    type: metrics
```

### Reactive pipeline

Every data source — REST, WebSocket, SSE, CSV, inline, Prometheus, simulated — produces the same event model: snapshot, append, replace, remove. Mutations cascade automatically to all bound components. No manual refresh, no subscription wiring, no state management.

### Recursive composition

Any component nests inside any other. Tabs inside splits inside grids. Forms alongside charts inside accordions. The tree is the API — there are no fixed slots, no special containers, no depth limits.

### Component hosting

`hostPanel` mounts arbitrary Web Components inside the layout tree with managed lifecycle. Build domain-specific UI (terminal emulators, diff viewers, diagram editors) in whatever framework you like, and let Pages handle layout, data flow, and communication around it.

---

## Capabilities

### Layout

| Primitive | What it does |
|-----------|-------------|
| Grid | CSS Grid with `{x, y, w, h}` placement. 12-column default. Drag-and-drop editing with compaction, resize, split, merge, and cross-grid moves. |
| Columns + Rows | Proportional column distribution with nested row slots. Drag to resize column ratios. |
| Tabs / Pills | Tabbed containers with lazy rendering. Pill variant for compact layouts. |
| Split | Resizable N-panel splits with drag handles. Horizontal and vertical. Nest splits for IDE-style arrangements. |
| Dock | Collapsible panels with toggle strips. Shrink to icon bar, expand on demand. |
| Sidebar | Collapsible sidebar with header and toggle. |
| Accordion | Expandable sections. Single or multi-open. |
| Carousel / Stack | Card carousel with auto-advance. Stack for layered views. |
| Floating workspace | Detachable panels that float over the layout. |
| Frame sandbox | Iframe-isolated regions for untrusted content. |

### Data sources

| Source | Description |
|--------|-------------|
| REST (`url:`) | JSON endpoints with optional polling refresh. |
| Mutable REST | Full CRUD — `createUrl`, `updateUrl`, `deleteUrl` with `keyColumn`. |
| WebSocket | Real-time push with topic subscriptions, event replay, and automatic reconnection. |
| SSE | Server-Sent Events for one-way streaming. |
| CSV | Local or remote CSV files, parsed automatically. |
| Inline (`content:`) | Embedded JSON data for demos and prototypes. |
| Prometheus (`type: metrics`) | PromQL queries with configurable time ranges. |
| Join | Client-side joins across datasets on shared keys. |
| Composite | Merge multiple sources into one dataset. |
| Simulated | Mutation operators for testing — inject delays, errors, partial updates. |
| Server query | Push-down queries to backend data providers (SQL, IoTDB). |
| Expression | Computed datasets from expressions over other datasets. |
| PostMessage | Data from parent window or iframe host. |
| Recording / Replay | Capture and replay data sessions for demos and testing. |

### Visualization (Apache ECharts)

Bar, line, area, pie, scatter, bubble, timeseries, timeline, heatmap, density heatmap, treemap, histogram, graph (network), map (choropleth). Every chart type supports cross-filtering, theming, and responsive sizing.

### Tables

Virtual-scroll CSS Grid table engine. Sortable columns, filterable rows, CSV export, row detail expansion, master-detail, cell spanning, tree/hierarchical data, grouped views, row accent styling, inline editing, keyboard navigation, ARIA grid roles. Handles 10k+ rows without pagination.

### Forms

Schema-driven form rendering from JSON Schema with recursive nesting. Input types: text, number, select, checkbox, date, datetime, duration, textarea, tag editor, colour swatch, slider. Array groups, variant groups (oneOf/discriminator), object groups. Data-scoped record editing with auto-save and local/REST adapters. Custom renderers via `x-renderer`.

### Content

HTML, Markdown, titles, alerts, badges, metric cards, countdown timers, action buttons, status indicators.

### Interactivity

| Feature | Description |
|---------|-------------|
| Cross-filtering | Click a chart segment, bound tables and charts update. Filter groups isolate channels. Toggle semantics. |
| Navigation | Multi-page sites with shared data context. URL state for filters, pagination, dock positions. Drill-through links. |
| Dynamic visibility | Show/hide components based on expressions or selections. |
| Action buttons | Trigger navigation, data operations, or custom events. |
| Selectors | Dropdown, radio, and label selectors that drive filters across all bound components. |

### Real-time push

WebSocket push protocol with topic-based subscriptions, wildcard matching, and sequence-based event replay. Automatic reconnection with replay from last-seen sequence — no data loss on network interruption.

Backend: Quarkus CDI integration with `EventBroadcaster`, `EventStore` (in-memory, JDBC, Redis), and typed SDK. One annotation wires a bean to the push pipeline.

### Design tokens and theming

OKLCH 12-step colour scales across 8 semantic palettes. Spacing, typography, elevation, and motion tokens. Light and dark presets. Interactive theme designer and theme picker components. Register custom themes with `registerTheme()`.

### Graph editing

Domain-agnostic graph model with stencil grammar, ELK auto-layout, React Flow rendering, edge routing, drill-down, multi-select, and SVG/PNG export. Drag from a stencil palette to build node-and-edge diagrams interactively.

### Playbook system

Full workflow language runtime in TypeScript: step execution, decorator chain (timeout, loop, retry, parallel, cancel, background, guard), control flow (if/else, match, try/catch, barrier, race, quorum, select), concurrency primitives (semaphore, latch, signal, channel, state machine, event router, correlation scope). Variables, modules, forEach, conditionals, CSV data sources, import/include. Visual step viewer renders playbooks as swim lane diagrams.

Simulation infrastructure: corpus management, phased execution, streaming, and overlay strategies. The same YAML drives both real execution and simulated data injection.

### Editor infrastructure

| Package | What it provides |
|---------|-----------------|
| `pages-code-editor` | CodeMirror 6 Lit component with YAML syntax, schema-driven completion, linting. |
| `pages-markdown-editor` | Milkdown/ProseMirror Lit component. WYSIWYG, source, and split views. Toolbar, annotations, scroll sync. |
| `pages-document-diff` | LCS diff engine with word-level highlights, canvas minimap, scroll sync. Split and unified views. |
| `pages-editor-core` | EditableText interface and bridge. MCP tool adapter for LLM-assisted editing. |

### Visual page builder

Drag-and-drop page composition with bidirectional YAML sync. Component catalogue with contextual filtering, outline tree with reorder, selection overlay, grid editing (move, resize, split, merge), paste indicators, diff patching. YAML is always the source of truth — the builder is a view.

### Language Server (LSP)

Schema-driven completion, diagnostics, hover, and navigation for all CaseHub YAML formats. Runs in Node and browser. Powers the IntelliJ plugin and the code editor component.

### IntelliJ plugin

LSP client for IntelliJ-family IDEs via LSP4IJ. Schema-driven YAML autocomplete and diagnostics for `.page.yaml` and playbook files, directly in the IDE.

### Accessibility

FocusTrapMixin, RovingTabindexMixin, KeyboardShortcutMixin, LiveRegionMixin. ARIA grid roles on tables. Keyboard navigation throughout. `<pages-modal>` with focus management.

### UI component library

Standalone Lit web components styled with design tokens: Badge, Button, Checkbox, Colour Swatch, Confirm Dialog, Date/DateTime/Duration inputs, Event Trail, Number Input, Property Tree, Select, Slider, Sparkline, Split Workbench, Status Badge, Status Dot, Submit Button, Tag Editor, Textarea. All light/dark aware.

---

## TypeScript DSL

When YAML doesn't fit — dynamic pages, programmatic composition, build-time generation — the TypeScript DSL covers the same surface with full type safety.

```typescript
import { page, barChart, table, columns, dataset } from "@casehubio/ui";
import { lookup, groupBy, col, sum } from "@casehubio/data";
import { loadSite } from "@casehubio/pages-runtime";

dataset("sales", "/api/sales");

const app = page("Sales",
  columns([1, 1],
    [barChart({
      title: "Revenue by Region",
      lookup: lookup("sales", groupBy("Region", col("Region"), sum("Revenue"))),
    })],
    [table({ lookup: lookup("sales") })],
  ),
);

await loadSite(document.getElementById("app")!, app);
```

`loadSite()` accepts both component trees and YAML strings. It wires data to components, sets up event delegation, and manages the lifecycle.

### Bring your own components

`hostPanel()` mounts any Web Component inside the layout tree. Build domain-specific UI in whatever framework you like — Pages manages layout, lifecycle, and communication.

```typescript
import { split, hostPanel } from "@casehubio/ui";
import { registerPanel, loadSite } from "@casehubio/pages-runtime";

registerPanel("my-terminal", "app-terminal");
registerPanel("my-editor", "app-code-editor");

const workbench = split("horizontal", [
  hostPanel("my-editor"),
  hostPanel("my-terminal", { sessionId: "abc" }),
], { ratio: [70, 30] });

await loadSite(document.getElementById("app")!, workbench);
```

---

## Architecture

### Data flow

```
YAML page file  ─or─  TypeScript DSL
         ↓
    Component tree + DataSetDef[]
         ↓
    pages-data: resolve sources, apply reactive events
         ↓
    DataSet (columns + rows) ── mutations cascade to all bound components
         ↓
    pages-component: layout rendering (CSS Grid, tabs, splits, docks)
         ↓
    pages-viz: charts, tables, metrics (ECharts Web Components)
  + hostPanel: custom Web Components with managed lifecycle
         ↓
    User interactions (filter, sort, navigate, action) → back to data layer
```

### Package map

**Runtime core:**

| Package | Role |
|---------|------|
| `pages-data` | Dataset model, reactive event engine, 14 data source types, operations (filter, group, sort, aggregate), JSONata transforms. |
| `pages-ui` | TypeScript DSL builders, YAML parser, component model, schema validation. |
| `pages-viz` | Web Component wrappers for charts, tables, metrics, forms (ECharts). |
| `pages-component` | CSS Grid layout renderer, interactive containers, grid editing (drag/resize/split/merge). |
| `pages-runtime` | Site orchestrator: `loadSite()`, navigation, data pipeline, event delegation, panel hosting, error boundaries. |
| `pages-table` | CSS Grid table engine: virtual scroll, tree rows, spanning, sorting, CSV export. |

**Authoring:**

| Package | Role |
|---------|------|
| `pages-builder` | Visual page builder with bidirectional YAML sync. |
| `pages-lsp` | Language Server Protocol for YAML formats. |
| `pages-code-editor` | CodeMirror 6 with schema-driven YAML completion. |
| `pages-markdown-editor` | Milkdown/ProseMirror with WYSIWYG/source/split modes. |
| `pages-document-diff` | LCS diff engine with minimap and scroll sync. |
| `pages-editor-core` | EditableText interface, MCP tool adapter. |
| `pages-document` | CST-backed typed facade for page YAML manipulation. |
| `pages-schema` | Zod schemas for all component types. |

**Playbook and scenarios:**

| Package | Role |
|---------|------|
| `yaml-core` | Playbook language runtime: steps, decorators, control flow, concurrency, simulation, variables, modules. |
| `pages-aria` | Scenario/playbook executor for the browser: commands, spotlight, visual feedback, scheduling, triggers. |
| `pages-step-viewer` | Lit components for rendering playbooks as visual cards, swim lanes, and control flow diagrams. |

**Graph editing:**

| Package | Role |
|---------|------|
| `graph-core` | Domain-agnostic graph model, grammar, query, traversal, edit operations. |
| `graph-renderer` | React Flow rendering, ELK layout, edge routing, gestures, drill-down, export. |
| `pages-diagram-core` | Diagram base mixin, toolbar, YAML integration, schema registry. |
| `pages-diagram-palette` | Draggable stencil palette and node chooser. |

**Design system:**

| Package | Role |
|---------|------|
| `pages-ui-tokens` | OKLCH colour scales, spacing, typography, elevation, motion. Theme designer and picker. |
| `pages-ui-components` | Standalone Lit web components (inputs, badges, status dots, buttons). |
| `pages-filter-bar` | Type-ahead filter chips with date ranges. |
| `pages-primitives` | Accessibility mixins, context menus, dock primitives, modal. |
| `pages-property-palette` | Schema-driven property inspector. |

**Iframe isolation:**

| Package | Role |
|---------|------|
| `pages-iframe-api` | Component controller and communication bridge for sandboxed components. |
| `pages-iframe-dev` | Development utilities for iframe component testing. |

**Iframe-isolated components** (`components/`):
LLM prompter, SVG heatmap, terminal emulator.

### Backend (Java / Quarkus)

| Module | Role |
|--------|------|
| `push` + `push-runtime` | WebSocket push protocol: topic subscriptions, wildcard matching, event replay, `EventBroadcaster`, CDI integration. |
| `push-store-jdbc` | JDBC-backed durable event store (Postgres, H2). |
| `push-store-redis` | Redis-backed durable event store. |
| `data` + `data-json` | Data provider SPI. JSON/file provider, app catalogue, seed data, schema validation. |
| `data-prometheus` | Prometheus metrics data provider. |
| `data-sql` | SQL push-down data provider. |
| `data-iotdb` | Apache IoTDB time-series provider. |
| `playbook` + `playbook-runtime` | Playbook model, GraphQL dispatch, trigger dispatch, activation queue, `@DefaultBean` producers. |
| `scenario` + `scenario-runtime` | Scenario model, execution runtime, REST client. |
| `terminal` + `terminal-runtime` | Terminal model and WebSocket handler. |
| `auth` | JWT dev-auth resource. |
| `layout` + `layout-sqlite` | Layout persistence API with SQLite store. |
| `pages-sqlite` | SQLite app store. |
| `mcp` | MCP server integration. |
| `cross-parser-test` | TypeScript/Java YAML parser parity verification. |

### IntelliJ plugin

`plugins/intellij/` — Kotlin/Gradle LSP client using LSP4IJ. Bundles the pages-lsp for schema-driven autocomplete and diagnostics. Requires JDK 21.

---

## Building

### Prerequisites

- Node.js 18+
- Yarn 4.10.3 (included via Yarn Berry — no global install needed)
- Java 21+ (backend and IntelliJ plugin only)

### Quick start

```bash
yarn install
yarn build
```

Builds all packages in dependency order. Output in `webapp/dist/`.

### Gallery

```bash
# Client-side gallery (no backend)
./gallery.sh

# With Quarkus backend (real-time push, server data sources)
./gallery-server.sh
```

### Development

```bash
# Gallery with hot reload
yarn workspace @casehubio/pages-examples run dev

# Specific package
yarn workspace @casehubio/pages-data run test
yarn workspace @casehubio/pages-component-llm-prompter run start
```

### Production

```bash
yarn build:prod
```

Optimized webpack builds for all packages, minified bundles, examples gallery with validation tests.

### Granular builds

```bash
yarn build:packages      # Core packages only
yarn build:components    # Iframe components (needs packages first)
yarn build:webapp        # Final webapp (needs everything)
yarn build:examples      # Examples gallery (needs webapp)
```

### Quarkus integration

Quinoa gives you a single `mvn quarkus:dev` that hot-reloads both Java and TypeScript. One `mvn package` produces a single JAR with the frontend included. No Node.js at runtime. See `docs/quinoa-convention.md`.

### Testing

```bash
yarn workspaces foreach -A run test     # All packages
yarn workspace @casehubio/pages-data run test  # Specific package
```

---

## Key technologies

| Technology | Role |
|-----------|------|
| TypeScript 5.x | Type-safe development across all packages |
| Lit | Web Components for visualization, editors, and UI components |
| Apache ECharts | Chart rendering |
| CodeMirror 6 | Code editing with schema-driven completion |
| Milkdown / ProseMirror | Rich text editing |
| React Flow | Graph rendering and editing |
| ELK | Automatic graph layout |
| JSONata | Data transformation expressions |
| Zod | Schema validation |
| Yarn 4 (Berry) | Workspace management |
| Webpack 5 | Module bundling |
| Vitest / Playwright | Unit and E2E testing |
| Quarkus 3 | Java backend runtime |

---

<details>
<summary>History</summary>

casehub-pages descends from dashbuilder, a GWT dashboard authoring platform. The melviz fork modernised the frontend, progressively replacing GWT with TypeScript Web Components. casehub-pages completes that journey — 100% TypeScript, zero GWT — and extends it from dashboards into a general-purpose application composition framework for the CaseHub platform.

</details>
