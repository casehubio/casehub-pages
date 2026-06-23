# Runtime Improvements — #17

Four batched improvements from the runtime code review (#13). M1 was addressed during the code review implementation — numbering starts at M2.

## M2 — navigate() tree-walk

### Problem

`navigate()` in `site.ts` does a flat `querySelectorAll` across the entire DOM for interactive containers, then tries `activateSlot` on each until one matches the current path segment. Two problems:

1. **Correctness bug: missing interactive types.** The DOM selector hardcodes 6 types (`tabs`, `pills`, `sidebar`, `accordion`, `carousel`, `stack`), but `INTERACTIVE_TYPES` in `navigation.ts` has 9 — it also includes `tree`, `menu`, `tiles`. These three types are wired interactively via `wireTabs` (interactive.ts:81-83), rendered lazily (render.ts:12 includes them in `LAZY_TYPES`), and participate in navigation (`computeCurrentPage` checks them via `INTERACTIVE_TYPES`). The current `navigate()` silently ignores them.

2. **Fragility: flat DOM query vs tree model.** The global `querySelectorAll` can misfire with duplicate slot names at different nesting levels and is O(n) over all containers per segment instead of walking the known tree path.

### Design

Walk the Component tree model instead of querying the DOM. This resolves both problems — the tree walk uses `INTERACTIVE_TYPES` from the model, so `tree`, `menu`, `tiles` participate in navigation automatically.

Add `walkNavigate` in `navigation.ts`:

```typescript
function walkNavigate(
  root: Component,
  segments: string[],
  target: HTMLElement,
  lazyPageResolutions: Map<Component, Component>,
): string
```

**Return type:** The reached page path as a string (segments joined by `/`). On partial match (segment N has no matching container), returns the path reached up to segment N-1. On full match, returns the complete path.

**Algorithm:** For each segment, descend the component tree from the current position, find the interactive container (checked via `INTERACTIVE_TYPES`) whose `slots` include that segment name. Use the container's `component.id` to locate its DOM element via `target.querySelector([data-component-id="${id}"])` and call `activateSlot` on it.

**Sequential activation ordering contract:** Each segment's `activateSlot` call MUST complete before processing the next segment. For lazy containers (all `LAZY_TYPES`), `activateSlot` triggers the swap function (interactive.ts:153-177), which calls `lazy.renderSlot` synchronously. This synchronous render creates the DOM for the next level's interactive container. If the swap function is ever made async, this contract breaks silently — the next segment's container would not exist yet. The sequential walk enforces this: one segment at a time, no batching.

**Lazy-page overlay:** When `walkNavigate` encounters a `lazy-page` component, it consults the `lazyPageResolutions` map (see M4) to follow the resolved subtree instead of stopping at the placeholder. This means navigation paths that pass through a resolved lazy page work correctly.

`navigate()` in `site.ts` calls `walkNavigate`, then sets `currentPage` from the result and syncs the URL. The `_navigating` flag suppression of `casehub-slot-change` → URL sync remains unchanged.

### Files

- `packages/casehub-runtime/src/navigation.ts` — add `walkNavigate` export, accept `lazyPageResolutions` parameter
- `packages/casehub-runtime/src/site.ts` — replace DOM query loop with `walkNavigate` call

## M3 — URL encoding

### Problem

`serializeToUrl` inserts the page path raw (`#/page/${link.page}`). Filter columns and values are `encodeURIComponent`'d but page path segments are not. A page name containing spaces, `?`, `#`, or `&` breaks URL parsing. `parseFromUrl` reads the path raw with no decoding.

### Design

Split the page path on `/`, `encodeURIComponent` each segment, join with `/`. Mirror on the parse side: split on `/`, `decodeURIComponent` each segment, join with `/`.

Empty segments from split are filtered out (matching existing `navigate` behaviour).

Note: `decodeURIComponent` on a string that was never encoded is a no-op (unless it contains `%XX` sequences), so previously bookmarked URLs with unencoded page names continue to work.

### Files

- `packages/casehub-runtime/src/url.ts` — encode segments in `serializeToUrl`, decode in `parseFromUrl`
- `packages/casehub-runtime/src/url.test.ts` — add cases for page names with spaces and special characters; verify round-trip

## M4 — Lazy page activation

### Problem

`type: "lazy-page"` components have types (`LazyPageProps` with `name` and `href`) and a type guard (`isLazyPage`) but the fetch/parse/render flow is not wired. They render as empty containers. The site runtime spec (§7.4) designed the lazy-page resolution flow including `PagePathMap` and `DataSetScope` extension, but it was a scope cut during implementation.

### Design

#### Core resolution flow

Handle lazy-page in the activation callback. When a lazy-page component's container element is rendered, detect `component.type === "lazy-page"`, fetch the YAML from `href`, parse it, integrate it into the component tree model, and render it.

#### Closure self-reference for onNode

The activation callback needs to pass itself as `onNode` when rendering fetched content. This requires a closure self-reference:

```typescript
let callback: (el: HTMLElement, component: Component) => void;
callback = (el, component) => {
  // ... for lazy-page rendering:
  renderComponent(el, parsedRoot, { permissions, onNode: callback });
};
```

This changes the declaration from a returned arrow function to a `let`-then-assign pattern. The callback variable is captured by closure, not by value at declaration time.

#### Fetch and caching

**Fetch injection:** `createActivationCallback` gains `fetch`, `baseUrl`, and `abortSignal` parameters. The `href` is resolved against `baseUrl` using `new URL(href, baseUrl)` when `baseUrl` is provided.

**Cache:** `Map<string, string>` keyed by resolved URL, storing the raw YAML response text (not a parsed Component). On cache hit, `parsePage(yamlLoad(cachedText))` creates a fresh Component tree. This ensures each lazy-page gets its own Component object identity — critical because `pagePathMap` keys on Component identity. If two lazy-pages reference the same `href`, they each get independent Component trees with correct, separate `pagePath` entries.

**Abort on dispose:** Pass `abortController.signal` to the fetch call so in-flight fetches are cancelled when `dispose()` is called. This prevents rendering into a detached DOM element after the site is torn down.

#### Tree integration — pagePathMap, dataSetScope, pageIndex

Per the site runtime spec §7.4, lazy-page resolution extends the runtime data structures:

1. **`pagePathMap`:** After parsing the fetched content, call `buildPagePathMap` logic rooted at the lazy-page's own `pagePath` (looked up from the parent `pagePathMap`). Add all entries to the existing `pagePathMap`.

2. **`dataSetScope`:** Call `buildDataSetScope` logic for the fetched subtree, inheriting datasets from the lazy-page's parent page scope. Add entries to the existing `dataSetScope`.

3. **`pageIndex`:** Call `buildPageIndex` logic for the fetched subtree using the extended `pagePathMap`. Add entries to the existing `pageIndex`.

4. **`lazyPageResolutions`:** A `Map<Component, Component>` that maps the original lazy-page Component to its resolved content root. This overlay allows `walkNavigate` (M2) to descend into resolved lazy-page content when traversing the component tree. All tree-walking functions (`walkNavigate`, and the pageIndex/pagePathMap/dataSetScope builders on re-invocation) consult this map.

This means `createActivationCallback` needs access to `pagePathMap`, `dataSetScope`, `pageIndex`, and `lazyPageResolutions` — all mutable maps passed by reference.

#### Interactive containers inside lazy pages

Fetched lazy-page content may contain interactive containers (tabs, sidebar, etc.) that participate in URL navigation paths. Because the resolved subtree is registered in `lazyPageResolutions` and the tree integration extends `pagePathMap` and `pageIndex`, `walkNavigate` can traverse into resolved lazy-page content naturally. The `renderComponent` call with `onNode` handles activation of all components including interactive containers — their slots are rendered, `wireInteractivity` is called, and they participate in slot-change events.

#### Activation flow — three paths

The activation callback is synchronous (`onNode` is called inline by render.ts:84). Lazy-page activation has three distinct paths with different timing characteristics:

**Path A — Re-activation (lazyPageResolutions hit): Synchronous.**

When a lazy container swaps away from a slot containing a lazy-page, `buildSwap` clears the panel's DOM (`oldPanel.innerHTML = ""`). When the user swaps back, `lazy.renderSlot` re-creates the lazy-page's container div and fires `onNode`. The resolved content root is available in `lazyPageResolutions` — re-render it immediately. No fetch, no map extension (already done on first activation).

Steps:
1. Activation callback detects `component.type === "lazy-page"`
2. Check `lazyPageResolutions` — hit: retrieve `resolvedRoot`
3. Call `renderComponent(el, resolvedRoot, { permissions, onNode: callback })`
4. Return (content visible immediately, no flicker)

**Path B — Initial activation, YAML cache hit: Synchronous.**

Applies when two different lazy-page Components point to the same `href` — the second lazy-page gets the cached YAML text and resolves inline without awaiting a fetch.

Steps:
1. Activation callback detects `component.type === "lazy-page"`
2. Check `lazyPageResolutions` — miss
3. Resolve URL: `new URL(href, baseUrl)` if `baseUrl` provided, else `href` directly
4. Check YAML cache — hit: use cached text
5. Parse: `parsePage(yamlLoad(cachedText))` — fresh Component tree (independent identity)
6. Extend `pagePathMap`, `dataSetScope`, `pageIndex` for the fetched subtree
7. Register in `lazyPageResolutions`: `lazyPageResolutions.set(component, parsedRoot)`
8. Call `renderComponent(el, parsedRoot, { permissions, onNode: callback })`

**Path C — Initial activation, YAML cache miss: Asynchronous.**

The callback fires the fetch and returns. The container is empty until the fetch completes. Steps 5-9 execute in the promise handler.

Steps:
1. Activation callback detects `component.type === "lazy-page"`
2. Check `lazyPageResolutions` — miss
3. Resolve URL: `new URL(href, baseUrl)` if `baseUrl` provided, else `href` directly
4. Check YAML cache — miss: fetch with `{ signal: abortSignal }`
5. *(async, in .then():)* Cache YAML response text
6. Parse: `parsePage(yamlLoad(responseText))`
7. Extend `pagePathMap`, `dataSetScope`, `pageIndex` for the fetched subtree
8. Register in `lazyPageResolutions`: `lazyPageResolutions.set(component, parsedRoot)`
9. Call `renderComponent(el, parsedRoot, { permissions, onNode: callback })`
10. On fetch/parse error, render an error message into `el`

**Key distinction:** `lazyPageResolutions` controls map-extension deduplication (same Component object, re-activated after DOM teardown → skip fetch and map extension, always render). The YAML text cache controls fetch deduplication (different Component objects pointing to same `href` → skip fetch, still extend maps for the new Component's identity). Rendering always happens on all three paths.

#### New cross-package import

`activation.ts` gains an import of `renderComponent` from `@casehubio/component/dist/renderer/render.js`. The cross-package dependency already exists at the package level (`@casehubio/runtime` → `@casehubio/component`), and `site.ts` already imports `renderComponent`. This adds a new file-level import within an existing dependency direction — no new architectural edge.

### Files

- `packages/casehub-runtime/src/activation.ts` — lazy-page handling, `renderComponent` import, closure self-reference, cache, abort signal, tree integration calls
- `packages/casehub-runtime/src/site.ts` — pass `fetch`, `baseUrl`, `permissions`, `abortController.signal`, `pagePathMap`, `dataSetScope`, `pageIndex`, `lazyPageResolutions` to `createActivationCallback`; create `lazyPageResolutions` map
- `packages/casehub-runtime/src/page-paths.ts` — export inner `walk` function (or a `buildPagePathMapFrom(root, basePath, map)` variant) for incremental extension
- `packages/casehub-runtime/src/dataset-scope.ts` — export a variant for incremental extension from a given scope
- `packages/casehub-runtime/src/navigation.ts` — `walkNavigate` accepts `lazyPageResolutions` parameter; `buildPageIndex` unchanged (incremental extension operates on already-resolved subtrees directly)

## M5 — Accordion initial state

### Problem

`wireAccordion` doesn't explicitly set initial panel visibility. Panels start with whatever `display` value they have from DOM creation (empty string = visible). The toggle test assumes this implicitly — if the default ever changes, it breaks.

### Design

Add `panel.style.display = ""` explicitly in the `wireAccordion` `forEach` loop, immediately after the `if (panel)` guard (line 274), before creating the header button. This makes "all sections expanded by default" a deliberate contract.

### Files

- `packages/casehub-component/src/renderer/interactive.ts` — add explicit initial display in `wireAccordion`

## Testing

Unit tests only for this branch. No browser/visual verification.

### M2 tests

- `navigation.test.ts`: test `walkNavigate` against a component tree fixture:
  - Single-level path (one interactive container with matching slot)
  - Multi-level path (nested interactive containers)
  - Partial match — first segment matches, second doesn't. Returns partial path, stops cleanly
  - All interactive types participate — test with `tree`, `menu`, `tiles` alongside `tabs`, `sidebar` etc.
  - Lazy container sequential activation — verify that `activateSlot` on a lazy container triggers synchronous `renderSlot`, making the next depth's container available for the subsequent segment
  - Lazy-page overlay — `walkNavigate` follows resolved lazy-page content via `lazyPageResolutions`

### M3 tests

- `url.test.ts`: page names with spaces (`"Q1 Report"`), hash (`"Section#2"`), question mark (`"FAQ?"`), ampersand (`"R&D"`); round-trip encoding/decoding preserves original

### M4 tests

- `activation.test.ts`:
  - Mock fetch returning YAML, verify lazy-page content rendered into container
  - Verify cache hit on second activation (same href, different Component) — fetch called once, both get independent content
  - **Re-activation after slot swap:** lazy-page inside a lazy container (tabs). First activation fetches and renders. Swap to another tab (DOM cleared by `innerHTML = ""`). Swap back — verify content re-rendered from `lazyPageResolutions` without re-fetching (fetch called once total, content visible both times)
  - Verify error message on fetch failure
  - Verify `onNode` called for children in fetched content (data components get full activation)
  - **pagePath correctness:** components inside fetched lazy-page content get the correct pagePath in the registry (not `""`)
  - **dataSetScope extension:** datasets defined in pages within fetched content are resolvable
  - **pageIndex extension:** pages in fetched content are findable via `pageIndex`
  - **abort on dispose:** in-flight fetch is cancelled when site is disposed
  - **Two lazy-pages, same href:** each gets independent Component identity and correct pagePath

### M5 tests

- Existing accordion tests in `interactive.test.ts` continue to pass — the explicit initial state matches the current implicit behaviour

## Known limitations

**Initial deep-link through an unresolved lazy-page.** When the initial URL is `#/page/Sales/Details` and "Details" lives inside a lazy-page under "Sales": `loadSite` renders the tree, the lazy-page's `onNode` fires and kicks off an async fetch (Path C). Render completes. The initial URL application (`site.navigate("Sales/Details")`) runs synchronously before the fetch resolves — `walkNavigate` activates "Sales" but stops at the lazy-page boundary because `lazyPageResolutions` has no entry yet. The user sees the Sales page but not Details. When the fetch completes, the content renders, but the URL is not re-applied.

Future enhancement: after lazy-page resolution, re-check the current URL path and re-navigate if it passes through the newly-resolved content.

## Out of scope

- Loading indicators for lazy-page fetch
- Pre-fetching or background loading of lazy pages
- Deep-link slot-0 optimization (pass initial path to `wireInteractivity` to skip slot-0 rendering — noted as a follow-up in the lazy-tab rendering spec)
