# @casehub/runtime — Site Runtime Design

Covers issue #13. Designs `@casehub/runtime` — the integration package that wires `@casehub/component` (layout renderer), `@casehub/ui` (page model), `@casehub/data` (dataset engine), and `@casehub/viz` (Web Component visualizations) into a working site runtime.

**Architectural decisions made during brainstorming:**
- **New `@casehub/runtime` package (Option 2)** — the runtime is a distinct concern from the model (`@casehub/ui`). Putting it in `@casehub/ui` would blur a definition package into an execution engine, force DOM/fetch dependencies on model-only consumers, and create a circular dependency with `@casehub/viz`. A separate package sits cleanly at the top of the DAG.
- **Render callback activation (Approach B)** — add an `onNode` callback to `RenderOptions` in `@casehub/component`. The runtime provides this callback to activate viz and content components inline during the render pass. No post-render DOM walk needed. The callback receives both the DOM element and the component model — no JSON-parsing `data-component-props` back out.
- **On-demand dataset resolution** — datasets are not fetched eagerly on `loadSite()`. Viz components fire `casehub-data-request` on `connectedCallback`; the runtime resolves each `ExternalDataSetDef` on first request and deduplicates concurrent requests for the same `dataSetId`. This gives fast initial paint (DOM structure appears immediately, data fills in progressively).
- **Navigation via slot-change events** — the interactive renderer in `@casehub/component` already handles tab/sidebar/accordion visibility toggling. Rather than duplicate this, the runtime observes `casehub-slot-change` events to track which page is active. Programmatic navigation uses a new `activateSlot()` export from `@casehub/component`.

---

## 1. Package Architecture

```
@casehub/runtime → @casehub/viz       (Web Component types for type-safe activation)
                 → @casehub/ui        (model, parser, DSL)
                 → @casehub/component (renderComponent, onNode callback, activateSlot)
                 → @casehub/data      (DataSetManager, resolver, ops, provider factory)
```

No package depends on `@casehub/runtime` — it sits at the top of the DAG. No cycles.

### Dependency graph (complete)

```
@casehub/runtime → @casehub/viz → @casehub/ui → @casehub/component
                                              → @casehub/data
                                              → zod
                 → @casehub/component (direct, for renderComponent + activateSlot)
                 → @casehub/data (direct, for DataSetManager + resolver + createDataProviderFactory)
```

### Package naming

`@casehub/data` is the logical name. The actual workspace package is `@melviz/core` (in `packages/core/package.json`). Import paths in the codebase use `@casehub/data` via tsconfig path mapping. The runtime follows this existing convention.

### Yarn workspace

`packages/casehub-runtime/` alongside the other `packages/*` directories. Root `package.json` already has `"packages/*"` — auto-discovered, no change needed.

---

## 2. Public API

```typescript
interface LiveSite extends Site {
  navigate(path: string): void;
  dispose(): void;
}

interface SiteOptions {
  readonly permissions?: PermissionContext;
  readonly fetch?: typeof globalThis.fetch;
  readonly providerConfig?: DataProviderConfig;
}

function loadSite(
  target: HTMLElement,
  source: string | Component,
  options?: SiteOptions,
): Promise<LiveSite>;
```

`loadSite` is async — the promise resolves when the DOM is rendered and event listeners are wired. Data arrives asynchronously via the event protocol (components show "Loading..." until their dataset is pushed).

**`LiveSite` extends `Site`** (declared in `@casehub/ui/model/page-types.ts`) with runtime operations. The `Site` interface stays unchanged — consumers who only need query access (`page()`, `dataset()`, `state`) type as `Site`.

- **`navigate(path)`** — programmatically navigate to a page. Parses path segments, activates slots along the path via `activateSlot()`, updates `state.currentPage`, syncs URL. Uses an internal `_navigating` flag to suppress per-slot `pushState` calls during multi-segment navigation, then does a single `pushState` at the end.
- **`dispose()`** — calls `abortController.abort()` to remove all event listeners in one operation, clears all source-level refresh timers (stored in `refreshTimers: Map<DataSetId, ReturnType<typeof setInterval>>`), clears `target.innerHTML` (triggers `disconnectedCallback` on all viz components — they clean up their own timers/observers), clears internal registries.

**`SiteOptions`:**
- `permissions` — `PermissionContext` for access control (defaults to `ALLOW_ALL`).
- `fetch` — injectable fetch function for testing and auth proxying. Passed through `createDataProviderFactory(options?.fetch)` (defaults to `globalThis.fetch`).
- `providerConfig` — `DataProviderConfig` from `@casehub/data`. Enables CORS proxy and server relay configuration. Defaults to `{}` (direct browser fetch, no proxy).

---

## 3. Changes to `@casehub/component`

Four additions to support the runtime. All are natural extensions of the renderer's existing role.

### 3.1 `onNode` callback in `RenderOptions`

```typescript
interface RenderOptions {
  readonly permissions?: PermissionContext;
  readonly document?: Document;
  readonly onNode?: (el: HTMLElement, component: Component) => void;
}
```

`renderComponent()` calls `onNode(el, component)` **after `parent.appendChild(el)` but before recursing into children**. In the current `render.ts`, this is between line 70 (`parent.appendChild(el)`) and line 73 (child rendering begins). This insertion point ensures:
- The element is connected to the DOM when the callback fires
- Web Components appended by the callback have their `connectedCallback` invoked immediately (because `el` is already in the document tree)
- Child elements have not been rendered yet, so the callback can modify `el` before children are added

### 3.2 `casehub-slot-change` event in `wireInteractivity`

When the interactive renderer toggles slot visibility (tab click, sidebar selection, accordion expand, carousel advance), it dispatches:

```typescript
new CustomEvent('casehub-slot-change', {
  bubbles: true,
  composed: true,
  detail: { activeSlot: slotName, containerId: el.dataset.componentId }
})
```

The runtime listens for this to track the current page path.

### 3.3 `activateSlot()` public export

```typescript
function activateSlot(container: HTMLElement, slotName: string): boolean;
```

Programmatically activates a named slot in a navigation container. Reads `container.dataset.componentType` to determine the container type, then applies type-specific logic:

- **tabs / pills / sidebar:** find `button[data-slot="<slotName>"]` in the header bar, update active state, hide all slot panels, show the target.
- **accordion:** show the target panel, hide all others.
- **carousel:** set the carousel index to the target slot's position.
- **stack:** set the visible index to the target slot's position.

`activateSlot` always ensures exactly one slot is visible, regardless of container type. This differs from the accordion's native click handler, which toggles (expand/collapse is its UX). Programmatic activation via `activateSlot` is navigation — "ensure this page is visible" — not native widget interaction.

After the visual update, dispatches `casehub-slot-change`. Returns `false` if the slot name doesn't exist on the container.

Used by the runtime for:
- Applying URL state on initial load
- `site.navigate(path)` — walk the tree, activate slots along the path
- `popstate` event — back/forward buttons

### 3.4 `wireSidebar` in `wireInteractivity`

Add sidebar handling to the `wireInteractivity` switch statement. Sidebar is the natural navigation metaphor for multi-page sites and is the primary navigation example in this spec.

Sidebar creates a vertical navigation panel with slot-name labels and one-visible-at-a-time slot toggling — structurally identical to `wireTabs` but with a vertical layout class (`casehub-sidebar` instead of `casehub-tabs`). Click handler hides all slots, shows the selected one, dispatches `casehub-slot-change`.

`tree` and `menu` remain unwired — their visual rendering (nested expand/collapse, dropdowns, keyboard navigation) is too complex for the renderer. They are valid component types with empty activation containers.

---

## 4. Activation Model

### 4.1 Page path pre-computation

Before calling `renderComponent()`, the runtime walks the `Component` tree to build a `Component → pagePath` map using object identity:

```typescript
// Component (by identity) → page path string
type PagePathMap = Map<Component, string>;
```

The walk visits **every component** in the tree, tracking the current path as it recurses. Page-type components push a new path segment (using the slot name from the parent's `slots` record). All other components inherit the current path from their nearest page ancestor. Every node — page or not — gets an entry in the map:

```
root (page "App")  → currentPath = ""
  sidebar           → currentPath = "" (inherits from root)
    page "Sales"    → currentPath = "Sales"
      bar-chart     → currentPath = "Sales" (inherits from Sales)
      tabs          → currentPath = "Sales" (inherits from Sales)
        page "Revenue" → currentPath = "Sales/Revenue"
          table     → currentPath = "Sales/Revenue" (inherits from Revenue)
```

The `onNode` callback does a single `pagePathMap.get(component)` lookup — no stack management needed, no exit signal required.

**Why slot names, not `PageProps.name`:** Navigation paths use slot names — the keys of the parent component's `slots` record. In the DSL, `page(name, ...)` uses `name` as both `PageProps.name` and the slot key, so they align in practice. But the canonical source is the slot key, because that's what `activateSlot()` operates on.

### 4.2 Component classification

The `onNode` callback classifies each component by type and activates accordingly:

| Category | Types | Activation |
|----------|-------|-----------|
| Data components | `bar-chart`, `line-chart`, `area-chart`, `pie-chart`, `scatter-chart`, `bubble-chart`, `timeseries`, `table`, `metric`, `meter`, `selector`, `map` | Create custom element, set `props`, append to container. Element fires `casehub-data-request` on `connectedCallback`. |
| Iframe plugin | `iframe-plugin` | Create `<casehub-iframe-plugin>`, set `props`, append. Same data-request flow if `props.lookup` is present. |
| Content — title | `title` | Create heading element (`h1`–`h6` from `props.size`, default `h1`), set `textContent`. Zero deps. |
| Content — html | `html` | Set `el.innerHTML` from `props.content`. Matches GWT precedent. |
| Content — markdown | `markdown` | Deferred — initial implementation renders as `<pre>` with raw text. Follow-up issue #14 adds a markdown parser. |
| Layout/nav | `grid`, `columns`, `rows`, `stack`, `tabs`, `pills`, `sidebar`, `accordion`, `carousel`, `app-grid`, `panel` | Already handled by `renderComponent()` — no additional activation. |
| Page | `page` | Register in page index for navigation tracking and dataset scoping. |
| Lazy page | `lazy-page` | Register placeholder. Content fetched and rendered on navigation (see §7). |
| Unknown types | anything else | Container is created by `renderComponent()` with `data-component-type` and `data-component-props`. No activation — extensibility point for future component types. |

**Custom element tag name rule:** The tag name is `"casehub-" + component.type`. This holds for all 13 viz types: `bar-chart` → `casehub-bar-chart`, `timeseries` → `casehub-timeseries`, `iframe-plugin` → `casehub-iframe-plugin`. The mapping is a direct string concatenation, not a lookup table.

### 4.3 ComponentRegistry

The runtime maintains a registry built during the activation pass:

```typescript
interface ComponentEntry {
  readonly element: HTMLElement;       // container div from renderComponent
  readonly vizElement?: CasehubElement<VizComponentProps>;  // viz Web Component (data components only)
  readonly component: Component;       // model node
  readonly pagePath: string;           // from PagePathMap lookup
  readonly originalLookup?: DataSetLookup; // snapshot for cross-filtering reset
}

// componentId → ComponentEntry
type ComponentRegistry = Map<string, ComponentEntry>;
```

---

## 5. Data Pipeline

### 5.1 Dataset scope map

At load time, the runtime walks the component tree and builds a per-page dataset scope:

```typescript
// pagePath → dataSetId → ExternalDataSetDef
type DataSetScope = Map<string, Map<DataSetId, ExternalDataSetDef>>;
```

Each page inherits its parent's datasets, with own-page definitions winning (shallow override, per spec §2 merge semantics). When resolving a `dataSetId` for a component, the runtime looks up the component's `pagePath` in this scope, then walks up ancestors until a match is found.

### 5.2 On-demand resolution

When `casehub-data-request` arrives:

1. Extract `{ element, lookup }` from event detail. Find the component's entry in `ComponentRegistry`.
2. Check if `lookup.dataSetId` is registered in `DataSetManager`.
3. **If registered:** resolve and push data (see step 5 below).
4. **If not registered:**
   - Find the `ExternalDataSetDef` via `DataSetScope` for the component's page.
   - Check `pendingResolutions: Map<DataSetId, Promise<ResolveResult>>` for an in-flight fetch.
   - If already in-flight, await the existing promise.
   - If not, call `resolveExternalDataSet(def, resolverCtx)` — stores the promise in `pendingResolutions`.
   - On completion: remove from `pendingResolutions`. Then proceed to step 5.
5. **Resolve and push data:**
   - Check `filterState` for active filters on this component's page and applicable groups. If any exist, build `FilterOp` expressions and append to the lookup's operations (same logic as §6.2 step 5). This ensures deep-link filters and interactive cross-filters use the same code path.
   - Call `manager.lookup(effectiveLookup)` → returns `LookupResult { dataset, totalRows }`.
   - Set `element.dataSet = result.dataset` and `element.totalRows = result.totalRows`.
6. Set `element.theme` from the page's `settings.mode` (or inherited from ancestor).
7. On error: set `element.error` with the error message.

### 5.3 ResolverContext — uses existing @casehub/data infrastructure

The runtime constructs a `ResolverContext` using the existing provider factory from `@casehub/data`:

```typescript
import { createDataSetManager } from "@casehub/data";
import { createDataProviderFactory, createPresetRegistry } from "@casehub/data";

const manager = createDataSetManager();
const resolverCtx: ResolverContext = {
  manager,
  providerFactory: createDataProviderFactory(options?.fetch),
  providerConfig: options?.providerConfig ?? {},
  presetRegistry: createPresetRegistry(),
};
```

`createDataProviderFactory()` already handles routing correctly:
- `def.content` → `InlineProvider` (inline data, no fetch)
- `def.join` → returns `undefined` (join handled by resolver directly)
- `def.url` → `BrowserFetchProvider` (browser fetch), optionally wrapped with `CorsProxyProvider` when `providerConfig.corsProxy` is configured
- `providerConfig.defaultProvider === "server-relay"` → `ServerRelayProvider`

### 5.4 Refresh

**Component-level refresh:** The viz components own their refresh timers (§3.5 of the viz spec). When a timer fires, the component resets `_dataRequested` and re-dispatches `casehub-data-request`. The runtime handles it identically to the initial request — but since the dataset IS registered (from the first resolution), it re-queries `DataSetManager` immediately.

**Source-level refresh:** For datasets with `ExternalDataSetDef.refreshTime`, the runtime sets up a timer to re-fetch the external source via `resolveExternalDataSet()` and re-register with `DataSetManager`. After re-registration, it pushes updated data to all components in the `ComponentRegistry` that reference that `dataSetId`. The timer is created after the first successful resolution of each dataset (during §5.2 step 4, on completion) — not at `loadSite()` time, which would violate the on-demand resolution principle. Subsequent data requests for the same dataset reuse the existing timer. Timers are stored in `refreshTimers: Map<DataSetId, ReturnType<typeof setInterval>>` and explicitly cleared via `clearInterval()` on `dispose()` (AbortController does not clear `setInterval` timers).

---

## 6. Cross-Filtering

### 6.1 Filter state

```typescript
// pagePath → group (undefined = ungrouped) → column → values
type FilterState = Map<string, Map<string | undefined, Map<ColumnId, string[]>>>;
```

### 6.2 Filter event flow

When `casehub-filter` arrives with `{ columnId, rowIndex, reset, group }`:

1. **Identify source:** find the component entry in `ComponentRegistry` via the event target. Get its `pagePath` and current dataset.
2. **Resolve cell value:** `dataset.rows[rowIndex]` → find cell for `columnId` → convert via `String(cellToRaw(cell))` from `@casehub/viz`. `cellToRaw()` handles the `CellValue` discriminated union (`NUMBER`, `DATE`, `TEXT`, `NULL`) → primitive. `String()` produces the filter argument string compatible with the filter resolution pipeline's string→typed parsing in `@casehub/data`.
3. **Update filter state:**
   - If `reset: true` → clear the filter for `columnId` in this group on this page.
   - If `reset: false` → set `filterState[pagePath][group][columnId] = [cellValue]`.
4. **Find affected components:** iterate `ComponentRegistry` entries where:
   - Same `pagePath` as source.
   - `component.props.filter.listening !== false` (listening defaults to true — components hear filters unless explicitly opted out).
   - Same `group` as source, OR receiver has no `group` (hears everything).
   - Exclude source component unless `component.props.filter.selfApply === true`.
5. **Re-query each affected component:**
   - Take its `originalLookup` (stored in `ComponentRegistry` at activation time).
   - Collect all active filter expressions for the component's page and applicable groups.
   - Build `FilterOp` expressions and append to the lookup's operations.
   - `manager.lookup(modifiedLookup)` → set `element.dataSet` and `element.totalRows`.

### 6.3 ViewState.activeFilters derivation

`ViewState.activeFilters` is a flattened projection of the current page's `FilterState`. It merges all filter groups into a single `Record<ColumnId, readonly string[]>` — group information is lost in the public view. This is intentional: the public `ViewState` serves URL serialisation and external consumers who need "what's filtered" without "which group owns the filter."

If a column appears in multiple groups with different values, the values are unioned in `activeFilters`. This is consistent with the spec's rule that ungrouped receivers hear all groups.

### 6.4 Pagination and sort events

`casehub-page` and `casehub-sort` follow the same pattern but are simpler — they affect only the source component:

- **`casehub-page`** `{ offset, count }`: re-query the source component's lookup with `LookupOptions { rowOffset: offset, rowCount: count }`. `totalRows` does not change — same dataset, same filters, different window.
- **`casehub-sort`** `{ columnId, order }`: append a `SortOp` to the source component's lookup operations (or replace the existing sort if one is present), re-query. Sort must be last — `validateOpOrder()` enforces `^F*G*S?$`.

Sort is component-scoped ephemeral state — not tracked in `ViewState` or the URL.

---

## 7. Navigation

### 7.1 Page index

Built during the page path pre-computation walk (§4.1) — maps page paths to their component nodes:

```typescript
// pagePath → Component (page node)
type PageIndex = Map<string, Component>;
```

`Site.page(path)` looks up this index directly.

### 7.2 Current page tracking

The runtime tracks active slots per navigation container:

```typescript
// containerId → activeSlotName
type ActiveSlots = Map<string, string>;
```

When `casehub-slot-change` fires with `{ containerId, activeSlot }`, the runtime updates `activeSlots`. The current page path is computed by walking from the root through the component tree, collecting active slot names at each navigation container:

```
sidebar(containerId: "root") → activeSlot: "Sales"
  tabs(containerId: "root::Sales::0") → activeSlot: "Revenue"
    → currentPage = "Sales/Revenue"
```

### 7.3 Programmatic navigation

`site.navigate("Sales/Revenue")`:

1. Set internal `_navigating = true` flag.
2. Split path into segments: `["Sales", "Revenue"]`.
3. Walk the component tree from root. At each navigation container, call `activateSlot(container, segment)` with the corresponding segment.
4. `activateSlot()` fires `casehub-slot-change`, which updates `activeSlots` and `state.currentPage`. The `casehub-slot-change` handler skips `pushState` because `_navigating` is true. If `activateSlot()` returns `false` (slot doesn't exist), stop — set `state.currentPage` to the path reached so far.
5. Clear `_navigating = false`.
6. Single `history.pushState` with the final URL (which reflects the path actually reached, not necessarily the requested path).

This avoids N+1 history entries for a path with N segments.

### 7.4 Lazy pages

When navigating to a `lazy-page` component:

1. The runtime detects `type: "lazy-page"` in the page index.
2. Fetches the content from `props.href` (using the configured `fetch`).
3. Parses the response (JSON → Component, or YAML string → `parsePage()`).
4. Extends `PagePathMap` with entries for all components in the new subtree, rooted at the lazy page's own path (already known from the page index). Extends `DataSetScope` with any datasets defined by pages in the lazy subtree.
5. Calls `renderComponent()` on the lazy page's container element with the fetched content and the `onNode` callback — activating any data components in the new subtree.
6. Updates the page index with the resolved content.
7. The lazy-page entry is replaced — subsequent navigations use the cached content.

---

## 8. View State and URL Sync

### 8.1 URL format

Per spec §8b (with sort removed — sort is component-scoped ephemeral state, not navigation state):

```
#/page/Sales/Revenue?filter=region:North|South,year:2024
```

- `#/page/<path>` — current page path (segments joined by `/`)
- `filter=<column>:<value>|<value>,<column>:<value>` — active filters (pipe for multi-value, comma for multi-column)

### 8.2 Pure functions

```typescript
function serializeToUrl(link: DeepLink): string;
function parseFromUrl(hash: string): DeepLink;
```

Both functions use `DeepLink` as the domain type. The runtime converts internal `ViewState` → `DeepLink` before serialisation, and `DeepLink` → state updates after parsing. This keeps the URL functions pure with a single type and enables clean round-tripping: `serializeToUrl(parseFromUrl(hash))` type-checks without a conversion layer.

### 8.3 Sync points

| Trigger | State change | URL update |
|---------|-------------|------------|
| `casehub-slot-change` (not during `_navigating`) | `currentPage` updated | `pushState` |
| `casehub-filter` | `activeFilters` updated | `replaceState` |
| `site.navigate()` | `currentPage` updated | single `pushState` at end (§7.3) |
| `popstate` | restore from URL | no update (already in URL) |

### 8.4 Initial load

On `loadSite()`:

1. Parse `location.hash` → `DeepLink`.
2. If a page path is specified: activate slots along the path via `activateSlot()`.
3. If filters are specified: populate `filterState`. The data-request handler (§5.2 step 5) applies them automatically when components first request data — no separate trigger needed.
4. If no hash: default to root page, first slot of each navigation container.

### 8.5 Event listener management

All event listeners use an `AbortController` signal for clean lifecycle management:

```typescript
private readonly abortController = new AbortController();

// All listeners registered with:
target.addEventListener('casehub-data-request', handler, { signal: this.abortController.signal });
target.addEventListener('casehub-filter', handler, { signal: this.abortController.signal });
target.addEventListener('casehub-slot-change', handler, { signal: this.abortController.signal });
target.addEventListener('casehub-page', handler, { signal: this.abortController.signal });
target.addEventListener('casehub-sort', handler, { signal: this.abortController.signal });
window.addEventListener('popstate', handler, { signal: this.abortController.signal });

// dispose():
this.abortController.abort();  // removes all event listeners
// Plus: explicit clearInterval() for each entry in refreshTimers map (§5.4)
```

### 8.6 Storage tiers (deferred)

The spec defines three storage tiers (`sessionStorage`, `localStorage`, `IndexedDB`). The initial implementation uses URL state only. Storage persistence is additive — follow-up issue #15, no architectural change.

---

## 9. File Organization

```
packages/casehub-runtime/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  # public exports: loadSite, LiveSite, SiteOptions
    ├── site.ts                   # SiteImpl, loadSite()
    ├── activation.ts             # onNode callback logic, component classification
    ├── registry.ts               # ComponentRegistry, ComponentEntry
    ├── page-paths.ts             # PagePathMap pre-computation (tree walk)
    ├── data-pipeline.ts          # data-request handler, on-demand resolution, dedup
    ├── cross-filter.ts           # FilterState, casehub-filter handler, re-query
    ├── navigation.ts             # PageIndex, ActiveSlots, page path computation
    ├── dataset-scope.ts          # DataSetScope builder (page tree walk)
    ├── url.ts                    # serializeToUrl(), parseFromUrl()
    └── content.ts                # title/html/markdown content rendering
```

---

## 10. Changes to `@casehub/data` (prerequisite)

### 10.1 Injectable `fetch` on BrowserFetchProvider

```typescript
// packages/core/src/dataset/external/providers/browser-fetch.ts
export class BrowserFetchProvider implements DataProvider {
  constructor(private readonly _fetch: typeof globalThis.fetch = globalThis.fetch) {}

  async fetch(request: DataRequest): Promise<FetchResult> {
    // ... existing logic, replacing fetch() calls with this._fetch() ...
  }
}
```

`createDataProviderFactory()` gains an optional `fetch` parameter that passes through to `BrowserFetchProvider`:

```typescript
export function createDataProviderFactory(
  fetchFn?: typeof globalThis.fetch,
): DataProviderFactory {
  // ... existing logic, passing fetchFn to new BrowserFetchProvider(fetchFn) ...
}
```

### 10.2 `DataSetManager.lookup()` returns `LookupResult`

The current `DataSetManager.lookup()` returns `TypedDataSet` — the paginated slice only. When pagination is applied (`rowOffset`/`rowCount`), the total pre-pagination row count is lost. The runtime needs this count to set `element.totalRows` for server-side pagination mode in `CasehubTable`.

Change the return type:

```typescript
interface LookupResult {
  readonly dataset: TypedDataSet;
  readonly totalRows: number;  // row count after ops (filter/group/sort) but before pagination
}

interface DataSetManager {
  // ... existing methods ...
  lookup(query: DataSetLookup, options?: LookupOptions): LookupResult;  // was: TypedDataSet
}
```

Inside `DataSetManagerImpl.lookup()`, the `applyOps()` result is already computed before `paginate()` runs. `totalRows` is `opsResult.rows.length` — zero new computation:

```typescript
lookup(query: DataSetLookup, options?: LookupOptions): LookupResult {
  // ... existing validation + applyOps() ...
  const result = applyOps(dataset, resolvedOps, opsOptions);
  const totalRows = result.rows.length;
  const paginated = paginate(result, offset, options?.rowCount ?? -1);
  return { dataset: paginated, totalRows };
}
```

This is a breaking change. The only callers are in `manager.test.ts` — the migration is `result` → `result.dataset` at each call site.

---

## 11. Testing Strategy

### Pure function tests
- `serializeToUrl` / `parseFromUrl` — round-trip with `DeepLink`, edge cases (empty, special chars, multi-value)
- `DataSetScope` builder — inheritance, override, missing datasets
- `PagePathMap` — every component gets an entry; nested pages, root omission, duplicate names at different levels; non-page components inherit correct ancestor path
- Page path computation from `ActiveSlots` — nested navigation containers
- Component classification — every type category

### Integration tests (jsdom/happy-dom)
- `loadSite()` end-to-end: YAML → DOM → data request events fired → datasets resolved → pushed to elements
- Deep-link filters: URL with filters → filterState populated → first data push includes filters (§5.2 step 5)
- Cross-filtering: emit filter event → affected components receive updated datasets, unaffected don't
- Filter groups: grouped emitter → only same-group listeners updated; ungrouped listener hears all
- Pagination: emit page event → component re-queried with offset/count; `totalRows` unchanged
- `totalRows` propagation: `LookupResult.totalRows` → `element.totalRows` for `CasehubTable` pagination UI
- Sort: emit sort event → component re-queried with sort op (ephemeral, not in URL)
- Inline content datasets: `def.content` → `InlineProvider` (no fetch), data pushed to component

### Navigation tests
- `activateSlot()` → type-specific header update → `casehub-slot-change` fired → `state.currentPage` updated
- `site.navigate(path)` → correct slots activated in sequence, single `pushState`
- URL → DeepLink → URL round-trip (no sort in URL)
- `popstate` → state restored
- Sidebar navigation → slot change events fire correctly
- Lazy page: navigate → fetch → PagePathMap extended → subtree rendered → data components activated

### Activation tests
- Data component types → Web Component created with tag `"casehub-" + type`, props set, appended
- Content types → correct DOM output (heading element, innerHTML)
- Layout/nav types → no additional activation
- Unknown types → container exists, no crash
- `PagePathMap` correctness — deeply nested pages resolve to correct paths; non-page components inherit nearest page ancestor path

### Dataset resolution tests
- On-demand: first request triggers fetch, subsequent requests use cached
- Deduplication: concurrent requests for same dataSetId → one fetch (`pendingResolutions`)
- Inline content: routed to `InlineProvider`, no network call
- Error handling: fetch failure → `element.error` set
- Source-level refresh: dataset re-fetch → all referencing components updated
- CORS proxy: `providerConfig.corsProxy` → `CorsProxyProvider` wraps fetch

### Cleanup tests
- `dispose()` → `abortController.abort()` → all event listeners removed
- `dispose()` → `refreshTimers` cleared via `clearInterval()` → no dangling timers
- `dispose()` → `target.innerHTML = ""` → `disconnectedCallback` fires on all viz components

---

## 12. Deferred Concerns

- **Markdown parsing** — initial implementation renders as `<pre>`. Follow-up issue #14 adds a parser dependency.
- **HTML sanitisation** — DOMPurify integration. Follow-up issue.
- **Storage tiers** — `sessionStorage`/`localStorage`/`IndexedDB` persistence for view state. Follow-up issue #15.
- **Lazy page caching** — cache fetched lazy page content in `IndexedDB` for offline support.
- **Server-side view state sync** — cross-device state persistence.
- **Drill-down** — `casehub-filter` with `drillDown` triggers navigation + filter context. The filter event and navigation infrastructure are in place; the drill-down handler chains them.
- **Property substitution at runtime** — `allowUrlProperties` + query parameter override.
- **`tree` and `menu` interactive wiring** — complex visual rendering (nested expand/collapse, dropdowns, keyboard navigation) deferred. Valid component types with empty activation containers.
