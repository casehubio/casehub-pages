# Layout Serialization — Save/Restore Workspace Profiles

**Issue:** #76
**Date:** 2026-07-01

## Context

Workbench primitives (#64) gave casehub-pages resizable splits, dock toggles, and panel hosting. But layout mutations are fire-and-forget: split drag modifies DOM flex values without firing events or updating state; dock state reaches the URL but nothing else is serializable. Users can't save a workspace arrangement and restore it later.

This feature makes layout a first-class runtime concept — observable, serializable, and optionally persistent.

## Root Problem

`wireSplit()` in `interactive.ts` sets `flex: 0 0 ${px}px` on drag and fires no event. The state change is trapped in the DOM. Without observability, there's nothing to serialize.

## Design

### LayoutState Type

The serializable snapshot of workspace arrangement. Keyed by component ID — only components with explicit IDs (via `withId()`) are captured. Auto-generated IDs are unstable across sessions and silently skipped.

```typescript
interface LayoutState {
  readonly splits: Readonly<Record<string, readonly number[]>>;
  readonly docks: Readonly<Record<string, boolean>>;
  readonly panels: Readonly<Record<string, PanelEntry>>;
}

interface PanelEntry {
  readonly typeName: string;
  readonly props?: Readonly<Record<string, unknown>>;
}
```

**`splits`** — component ID → proportional ratios (e.g., `{ "main-split": [60, 40] }`). Proportional, not pixels — adapts to container size on restore.

**`docks`** — panel ID → visible (e.g., `{ "debug-panel": false }`). Same data as the existing dock state map, now serializable.

**`panels`** — component ID → panel type and props (e.g., `{ "editor": { typeName: "diff-viewer", props: { pathA: "a.md" } } }`). Captured from the ComponentRegistry at serialization time. On restoration, serves as documentation and enables validation (warn if a registered panel type is missing).

**Excluded:** navigation state (page path, active tabs — ViewState/DeepLink), data state (filters, sort, pagination — ViewState), transient panel-internal state (scroll, cursor — panel's responsibility), edit state (form fields — SaveAdapter's domain).

### Observable Split Resize

On `mouseup` (drag complete), compute proportional ratios from the current pixel sizes of all children, then fire a `pages-split-resize` CustomEvent.

The existing `attachDragHandler(handle, index, direction, slotNames, panels, minSizes)` gains one parameter: `componentId: string`. The caller (`wireSplit`) passes `container.dataset.componentId` — the component ID is already on the container element's `data-component-id` attribute (set by `renderNode` in `render.ts`).

```typescript
function onMouseUp(): void {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  const ratios: number[] = [];
  for (const name of slotNames) {
    const panel = panels.get(name);
    if (panel) {
      const size = direction === "horizontal" ? panel.offsetWidth : panel.offsetHeight;
      ratios.push(size);
    }
  }
  const total = ratios.reduce((a, b) => a + b, 0);
  const normalized = total > 0
    ? ratios.map(r => Math.round(r / total * 100))
    : ratios;

  handle.dispatchEvent(new CustomEvent("pages-split-resize", {
    bubbles: true,
    composed: true,
    detail: { componentId, ratios: normalized },
  }));
}
```

DOM stays pixel-based during the session (existing behavior unchanged). The event reports proportional meaning. On restore, proportional ratios are applied as `flex: 60` / `flex: 40`, same as initial rendering.

**Ratio normalization note:** `Math.round` does not guarantee the ratios sum to exactly 100 for N-way splits (e.g., 3-way equal split produces `[33, 33, 33]` = 99). This is intentional — the ratios are proportional hints used as flex-grow values, not CSS percentages. The browser's flex algorithm normalizes them identically regardless of whether they sum to 99 or 100.

Event naming follows the existing pattern: `pages-filter`, `pages-sort`, `pages-dock-toggle`, `pages-slot-change` → `pages-split-resize`.

### LayoutStore Contract

Persistence abstraction. Contract-based, backend-agnostic.

```typescript
interface LayoutStore {
  load(key: string): Promise<LayoutState | null>;
  save(key: string, state: LayoutState): Promise<void>;
  delete(key: string): Promise<void>;
}
```

**`load`** — returns the stored layout for the given key, or `null` if nothing stored. Must not throw — implementations catch all errors internally (network, auth, parse) and return `null`. This is a contract requirement, not a suggestion.

**`save`** — persists the layout state. Implementations decide durability semantics. Must not throw — implementations catch all errors internally and log warnings.

**`delete`** — removes the stored layout for the given key. No-op if the key doesn't exist. Must not throw.

**`key`** — consuming app chooses. Identifies the workspace profile (e.g., `"drafthouse-main"`, `"claudony-review-session-123"`). The framework doesn't interpret it.

**Framework safety net:** Despite the "must not throw" contract, `loadSite` wraps `store.load(key)` in try/catch and treats exceptions as "no saved state" with a `console.warn`. This guards against buggy implementations without crashing the init sequence.

**Built-in: `createLocalLayoutStore()`**

```typescript
function createLocalLayoutStore(prefix?: string): LayoutStore
```

Uses `localStorage` with keys namespaced by prefix (default: `"pages-layout:"`). Graceful on storage errors — `save` catches `QuotaExceededError` and logs a warning; `load` catches parse errors and returns `null`; `delete` catches and logs. No throws propagated.

**Future: REST adapter (#21)**

The optional Quarkus backend issue provides a REST-based implementation: `GET /layouts/{key}`, `PUT /layouts/{key}`, `DELETE /layouts/{key}`. Same interface, different transport. The API is contract-based — any backend (not just Quarkus) can implement it.

**Not in the contract:** listing, versioning, conflict resolution. Application concerns — consuming apps build on top of `load`/`save`/`delete` or directly against their backend.

### API Surface

**SiteOptions gains three optional fields:**

```typescript
interface SiteOptions {
  // ... existing (permissions, fetch, baseUrl, providerConfig, adapters)
  readonly layout?: LayoutState;
  readonly layoutStore?: LayoutStore;
  readonly layoutKey?: string;
}
```

Two modes of layout injection:

- **`layout`** — direct state injection. Seeds the internal layout state maps from the provided snapshot. No auto-save. Useful for testing, SSR, migration, or one-off restore from any source. Read-only — the framework applies it but doesn't persist changes.
- **`layoutStore` + `layoutKey`** — managed persistence. The framework loads state from the store on init and auto-saves on changes. Both must be provided; either alone is ignored.

If both `layout` and `layoutStore + layoutKey` are provided, the store takes precedence (it may have newer state). `layout` serves as a fallback if `store.load()` returns `null`.

**Design note:** Issue #76 sketched direct injection (`layout: savedState`). This spec adds store indirection alongside it because auto-save requires framework-managed lifecycle — direct injection alone has no save path. Both approaches coexist cleanly: `layout` for manual control, `layoutStore` for managed persistence.

**LiveSite gains a `layout` getter:**

```typescript
interface LiveSite extends Site {
  // ... existing (navigate, setTheme, dispose)
  readonly layout: LayoutState;
}
```

Returns a snapshot of current layout state. Always available regardless of store configuration — consuming apps can call `JSON.stringify(site.layout)` for manual export.

### Initialization Sequence

Extends the existing `loadSite` flow:

1. Parse source → Component tree (existing)
2. Build indices (existing)
3. **Seed layout state:** If `layoutStore` + `layoutKey` configured, `await store.load(key)` (wrapped in try/catch — exceptions treated as `null` with `console.warn`). If `layout` also provided, use it as fallback when `store.load()` returns `null`. If only `layout` provided (no store), seed from it directly. Result seeds internal layout state maps (split ratios, dock state). If nothing available, no-op.
4. Render component tree (existing) — initial ratios from Component tree
5. **Apply saved split ratios** (post-render):
   ```typescript
   function applySavedSplitRatios(container: HTMLElement, savedSplits: Record<string, number[]>): void {
     for (const [componentId, ratios] of Object.entries(savedSplits)) {
       const splitEl = container.querySelector(`[data-component-id="${componentId}"]`);
       if (!splitEl) continue;
       const slots = splitEl.querySelectorAll(`:scope > [data-slot]`);
       if (ratios.length !== slots.length) continue; // structural mismatch — discard
       slots.forEach((slot, i) => {
         (slot as HTMLElement).style.flex = String(ratios[i]);
       });
     }
   }
   ```
   **Ratio count guard:** If `ratios.length !== slots.length`, the component tree structure has changed since the layout was saved. The entire ratio set for that split is discarded and component-tree defaults apply. Partial application (e.g., applying 2 saved ratios to a 3-way split) would produce incorrect proportions.
6. Apply URL state (existing) — DeepLink.dock overrides stored dock state
7. Return LiveSite

### Lazy Container Restore

Splits inside lazy containers (tabs, pills, sidebar, carousel, stack, tree, menu, tiles) are not rendered at init time — their DOM elements don't exist when step 5 executes. The `pages-slot-change` event (dispatched by `dispatchSlotChange` in `interactive.ts` when a lazy slot is activated) triggers deferred restore:

```typescript
target.addEventListener("pages-slot-change", (e) => {
  // ... existing slot-change handling ...
  // After lazy content is rendered, apply current ratios to newly-mounted splits
  const container = (e as CustomEvent<SlotChangeDetail>).detail.containerId;
  const containerEl = target.querySelector(`[data-component-id="${container}"]`);
  if (containerEl instanceof HTMLElement) {
    applySavedSplitRatios(containerEl, splitRatios);
  }
});
```

The `applySavedSplitRatios` function is reused from init step 5. It scopes the query to the activated container, so only newly-rendered splits are affected. The ratio count guard applies here too.

**Critical: `splitRatios` is the live internal split ratios map, not a snapshot of the original store data.** `buildSwap` in `interactive.ts:255-257` destroys old slot content on every tab switch (`oldPanel.innerHTML = ""`), then re-renders from the Component tree with default ratios. This means `pages-slot-change` fires on every tab switch — not just first activation — and the restore must apply the current internal map (including any user modifications made during this session). If a snapshot were used, user adjustments to split ratios would be lost every time tabs switch.

### Restore Layering

| Source | Priority | When |
|--------|----------|------|
| Component tree props (`ratio: [70, 30]`) | Lowest | Always — the default |
| LayoutStore (`store.load(key)`) | Middle | On init, if configured |
| URL hash (DeepLink.dock) | Highest | On init, if present |

Stored layout overrides component defaults. URL overrides stored layout. A shared URL with `dock=sidebar:closed` overrides the stored dock preference and becomes the new persistent state — auto-save persists whatever state exists at save time, regardless of how it was set. There is no origin-tracking; URL-injected state is indistinguishable from user-toggled state once applied. If the user wants to revert a URL override, they toggle the dock back — that toggle is then auto-saved.

### Runtime Event Handling

New listeners alongside existing dock toggle handler in `site.ts`:

- `pages-split-resize` → update internal split ratios map → trigger debounced save
- `pages-dock-toggle` → update dock state map (existing) → also trigger debounced save

**Store guard:** The debounced save path is only wired when `layoutStore` and `layoutKey` are both configured. Without them, events only update the internal state maps (needed for the `site.layout` getter).

**Debounced auto-save:** 500ms after the last layout change, calls `store.save(key, site.layout)`. Multiple rapid changes collapse into one save. If the store throws, log warning — never propagate.

**Dispose cleanup:** `dispose()` cancels the pending layout debounce timer (`clearTimeout(layoutSaveTimer)`) alongside the existing `saveTimers` cleanup. This prevents a dangling `setTimeout` from firing `store.save()` after disposal.

**Hidden dock panel correction:** When the `pages-split-resize` handler receives ratios, it checks each value against the existing internal map. If a ratio is 0 and the previous stored ratio for that position was non-zero, the slot was hidden during the resize (dock panel with `display: none` measures as 0). The handler substitutes the last known non-zero ratio, preserving the hidden panel's size for when it's re-opened. This correction happens in `site.ts` (the runtime layer that owns dock state), not in `interactive.ts` (the event emitter, which simply reports what it measures).

### `site.layout` Getter Semantics

The `layout` getter returns a snapshot built from the internal layout state maps:

- **`splits`** — the internal split ratios map, seeded by `store.load()` (or `layout` injection) on init, updated by `pages-split-resize` events during the session. In a fresh session with no store and no injection, `splits` is empty — no user modifications exist. This is intentional: the getter captures deviations from component-tree defaults, not a full DOM measurement. Callers doing manual export (`JSON.stringify(site.layout)`) get a compact delta; restoring it reproduces the user's customizations.
- **`docks`** — the internal dock state map, seeded by `store.load()` on init, updated by `pages-dock-toggle` events and URL state.
- **`panels`** — built on access by querying the `ComponentRegistry` (not a Component tree traversal).

### Panel Capture

The `panels` record is built by iterating the runtime's `ComponentRegistry` — the same registry used for data pipeline, filters, and view state. Each `ComponentEntry` has `hasExplicitId: boolean` (set during component activation in `activation.ts`) and `component: Component` (the source component).

Data flow: iterate `ComponentRegistry` → filter entries where `component.type === "host-panel"` AND `hasExplicitId === true` → extract `(component.props as HostPanelProps).typeName` as the panel type name and `(component.props as HostPanelProps).panelProps` as the panel's own props → build `panels` record keyed by component ID.

`HostPanelProps` (`component-props.ts:38-41`) defines `typeName: string` (the hosted panel type, e.g., `"diff-viewer"`) and `panelProps?: Record<string, unknown>` (the panel's configuration props). This is distinct from `Component.type` (which is always `"host-panel"` for these entries) and `Component.props` (which is the full `HostPanelProps` object).

This runs on each `site.layout` access. The registry is a `Map` — iteration is O(n) where n is total registered components. For typical workbench layouts (tens to low hundreds of components), this is negligible.

**Lazy container scope:** Only currently rendered panels are captured. Panels in inactive lazy slots have been destroyed by `buildSwap` (`innerHTML = ""`) and are not in the registry. The `panels` record reflects the visible workspace at the time of access, not the full component tree definition. Switching tabs and reading `site.layout` again may produce a different panel set. This is consistent with the delta semantics of `splits` and `docks` — the getter captures current runtime state, not the static definition.

On restoration, if a layout references a panel type not in the registry, the runtime logs a warning. No error, no blocking — the layout still applies for components that do exist.

## Package Placement

No new packages. Same split as workbench primitives.

| Addition | Package | Rationale |
|----------|---------|-----------|
| `LayoutState`, `PanelEntry` types | `pages-component` | Model types live here |
| `pages-split-resize` event dispatch | `pages-component` | `wireSplit` / `interactive.ts` lives here |
| `LayoutStore` interface | `pages-runtime` | Runtime contracts live here |
| `createLocalLayoutStore()` | `pages-runtime` | Runtime API surface |
| Layout state management + auto-persistence | `pages-runtime` | `site.ts` event handling lives here |
| Panel capture (registry query) | `pages-runtime` | Operates on `ComponentRegistry` |

## Files Touched

| File | Change |
|------|--------|
| `pages-component/src/model/types.ts` | Add `LayoutState`, `PanelEntry` types |
| `pages-component/src/model/index.ts` | Export `LayoutState`, `PanelEntry` (package root `src/index.ts` uses `export *` — no change needed there) |
| `pages-component/src/renderer/interactive.ts` | `attachDragHandler` gains `componentId` param, fires `pages-split-resize` on mouseup |
| `pages-runtime/src/layout-store.ts` | New: `LayoutStore` interface + `createLocalLayoutStore()` |
| `pages-runtime/src/site.ts` | `SiteOptions` fields, layout state maps, `pages-split-resize` handler with hidden-panel correction, debounced save with store guard, `layout` getter, post-render restore, lazy container restore, dispose cleanup |
| `pages-runtime/src/index.ts` | Export `LayoutStore`, `LayoutState`, `createLocalLayoutStore` |

## Testing Strategy

### Unit Tests (Vitest)

- **Split resize event:** simulate mousedown/mousemove/mouseup, verify `pages-split-resize` fires with proportional ratios and correct component ID
- **Ratio normalization:** verify pixel sizes [600, 400] normalize to [60, 40]; single-child edge case; zero-size edge case
- **LayoutStore localStorage adapter:** save/load/delete round-trip; load missing key returns `null`; corrupted JSON returns `null`; QuotaExceededError on save logs warning, doesn't throw; delete removes entry; delete missing key is no-op
- **Layout getter:** verify `site.layout` returns current splits, docks, and panels; verify panels captured from ComponentRegistry with explicit IDs only via `HostPanelProps.typeName` and `HostPanelProps.panelProps`; verify fresh session with no store returns empty splits
- **Post-render restore:** verify saved split ratios applied to DOM after rendering; verify missing component IDs silently skipped; verify ratio count mismatch discards saved ratios for that split
- **Lazy container restore:** verify splits inside inactive tabs get saved ratios applied when tab is activated; verify `pages-slot-change` triggers deferred restore; verify user-modified ratios survive tab switch (live map, not snapshot)
- **Debounced save:** verify multiple rapid split resizes produce one `save` call; verify dock toggle triggers save; verify dispose cancels pending debounce timer; verify no save attempt when store not configured
- **Direct injection:** verify `layout` option seeds state without a store; verify store takes precedence over `layout` when both provided; verify `layout` used as fallback when store returns `null`
- **Error resilience:** verify `store.load()` throwing is caught and treated as `null`; verify warning logged
- **Hidden dock panel correction:** verify resize with hidden dock panel preserves last known ratio instead of recording 0; verify re-opening panel gets non-zero flex

### Integration Tests

- **Full round-trip:** build workbench → drag split → read `site.layout` → dispose → `loadSite` with saved layout → verify split ratios match
- **Layered restore:** store has dock=open, URL has dock=closed → verify URL wins; verify URL-applied dock state is auto-saved (URL overrides become persistent)
- **No store configured:** verify `site.layout` works, no errors, no localStorage writes
- **Panel validation:** save layout with `typeName: "test-panel"`, clear registry, restore → verify warning logged, no crash
- **Dock + resize round-trip:** 3-way split, hide one panel via dock toggle, resize remaining two, save, restore, re-open docked panel → verify all three panels have correct ratios

## Design Constraints Verified

- **Foundation tier:** no casehub upstream dependencies introduced
- **Persistence is optional:** graceful when LayoutStore absent — `site.layout` still works for manual export
- **Contract-based storage:** `LayoutStore` interface is backend-agnostic; Quarkus adapter (#21) implements the same contract
- **No new packages:** model types in pages-component, runtime wiring in pages-runtime

## Out of Scope

- **REST LayoutStore adapter** — ships with Quarkus backend (#21)
- **PLATFORM.md update** — cross-repo; approved wording captured, applied separately
- **Drag-and-drop panel rearrangement** — #75, separate future epic
- **Floating/popout panels** — #77, separate future epic
