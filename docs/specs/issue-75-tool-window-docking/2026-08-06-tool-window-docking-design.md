# IntelliJ-Style Tool Window Docking — Design Spec

**Issue:** casehubio/casehub-pages#75
**Date:** 2026-08-06
**Approach:** Thin Builder, Zone Runtime Layer (Approach B)

## Overview

Extend the existing `dockWorkbench()` primitives with IntelliJ-style tool window docking: a 6-zone layout model, constrained drag-and-drop rearrangement of panels between zones, configurable button bar placement, and extended layout persistence.

The design adds one new abstraction — the **zone layout engine** in `pages-runtime` — and extends existing components (`dock-bar`, `split`, `LayoutState`) without introducing new component types.

## Key Decisions

- **Re-render on drop, not DOM manipulation.** When a panel is dragged to a new zone, the workbench subtree is torn down and rebuilt from an updated component tree. This guarantees the tree always matches the DOM and avoids memory leaks from orphaned listeners.
- **Drag source is dock-bar buttons only.** Panel title bars are not drag sources. This matches IntelliJ's primary interaction pattern.
- **One side stripe per side, buttons grouped by zone.** Each side has one dock-bar. Buttons are spatially grouped by zone with a flex spacer between groups (top/bottom for vertical bars, left/right for horizontal).
- **Exclusive scoping is per zone group, not per bar.** Clicking a button in one zone group does not close panels in the other zone group on the same side.

## 1. Zone Model & Data Structures

### Zone identifiers

```typescript
type DockZone =
  | "left-top" | "left-bottom"
  | "right-top" | "right-bottom"
  | "bottom-left" | "bottom-right";

type DockSide = "left" | "right" | "bottom";
```

Six possible zones, named `side-position`. Vertical sides use top/bottom positions; the horizontal bottom side uses left/right.

### Zone map

```typescript
type ZoneMap = ReadonlyMap<string, DockZone>;
```

Maps each panel key to its current zone. Built from config defaults, overridden by saved LayoutState. Updated on drag-drop.

### Extended LayoutState

```typescript
interface LayoutState {
  readonly splits: Readonly<Record<string, readonly number[]>>;
  readonly docks: Readonly<Record<string, boolean>>;
  readonly panels: Readonly<Record<string, PanelEntry>>;
  readonly zones?: Readonly<Record<string, DockZone>>;
}
```

The `zones` field is optional for backward compatibility. Absent means "use config defaults."

### Extended DockPanelConfig

```typescript
interface DockPanelConfig {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly defaultOpen?: boolean;
  readonly content: Component;
  readonly minSize?: number;
  readonly zone?: "top" | "bottom" | "left" | "right";
  readonly allowedZones?: readonly DockZone[];
  readonly fixed?: boolean;
}
```

`zone` is the initial position within the panel's declared side. Defaults to the first position ("top" for vertical, "left" for horizontal).

### Extended DockWorkbenchConfig

```typescript
interface DockSideConfig {
  readonly zones?: 1 | 2;
  readonly buttonPosition?: "start" | "end";
  readonly panels: readonly DockPanelConfig[];
}

interface DockWorkbenchConfig {
  readonly storageKey?: string;
  readonly centre: Component | Component[];
  readonly left?: readonly DockPanelConfig[] | DockSideConfig;
  readonly right?: readonly DockPanelConfig[] | DockSideConfig;
  readonly bottom?: readonly DockPanelConfig[] | DockSideConfig;
}
```

Flat array form (`left: [...]`) normalized to `{ zones: 1, panels: [...] }`. `buttonPosition: "end"` means outside edge (IntelliJ default).

## 2. Builder Changes

### Tree structure

The builder generates the same primitive types (`split`, `rows`, `columns`, `dock-bar`, `deferred`) with zone awareness:

- **Per-zone containers** — `rows(...panels.map(wrapPanel))` scoped to one zone's panels
- **Per-side split** — `split("vertical", [topZone, bottomZone])` for left/right, `split("horizontal", [leftZone, rightZone])` for bottom — only when zones: 2 and at least one panel in each zone
- **Dock bar** — one per side with zone-tagged items, exclusive within each zone group
- **Zone container IDs** — `__zone:left-top`, `__zone:right-bottom`, etc.

### DockItem extension

```typescript
interface DockItem {
  readonly icon: string;
  readonly label: string;
  readonly panelId: string;
  readonly defaultOpen?: boolean;
  readonly zone?: string;
  readonly allowedZones?: readonly DockZone[];
  readonly fixed?: boolean;
}
```

### DockBarProps extension

```typescript
interface DockBarProps {
  readonly orientation: "vertical" | "horizontal";
  readonly items: readonly DockItem[];
  readonly exclusive?: boolean;
  readonly side?: DockSide;
}
```

### Backward compatibility

Flat array config → `{ zones: 1, panels: [...] }`. All panels default to the first zone. Drag can still create a second zone at runtime.

## 3. Zone Layout Engine

### Interface

```typescript
interface ZoneLayoutEngine {
  readonly config: DockWorkbenchConfig;
  readonly zoneMap: ReadonlyMap<string, DockZone>;

  buildTree(): Component;
  movePanel(panelKey: string, targetZone: DockZone): Component;
  getConstraints(panelKey: string): { allowedZones: readonly DockZone[]; fixed: boolean };
  getValidDropZones(panelKey: string): readonly DockZone[];
}
```

### Construction

```typescript
function createZoneLayoutEngine(
  config: DockWorkbenchConfig,
  savedZones?: Readonly<Record<string, DockZone>>,
): ZoneLayoutEngine
```

Normalizes config, builds initial zone map from config defaults + saved overrides. Invalid overrides (violating `allowedZones`) fall back to config defaults. Stale overrides (panels no longer in config) are dropped.

### Location

`packages/pages-runtime/src/zone-layout-engine.ts`

### Lifecycle

Instantiated in `loadSite()` when the root component uses the dock workbench pattern. The site holds a reference for re-render cycles. The engine is stateless beyond the zone map — no DOM references, no event listeners.

## 4. Dock-Bar Zone Grouping

### Activation callback changes

The dock-bar activation code renders buttons in two spatial groups separated by a flex spacer:

```html
<div data-component-type="dock-bar">
  <div data-dock-zone="top" style="display:flex; flex-direction:column; gap:2px;">
    <button data-dock-panel-id="nav" data-dock-zone="top">...</button>
  </div>
  <div style="flex:1"></div>
  <div data-dock-zone="bottom" style="display:flex; flex-direction:column; gap:2px;">
    <button data-dock-panel-id="agent" data-dock-zone="bottom">...</button>
  </div>
</div>
```

Single-zone bars render without a spacer — same as today.

### Exclusive scoping

Click handler iterates siblings within the same `data-dock-zone` group, not all buttons in the bar.

## 5. Drag-and-Drop System

### Drag initiation

`mousedown` + 5px `mousemove` threshold on non-fixed dock-bar buttons starts drag. Click without movement still toggles the panel. Fixed buttons have no drag behavior.

### Drag ghost

Semi-transparent clone of the button, positioned at cursor via `position: fixed`. Original button gets reduced opacity.

### Drop targets

Two kinds:

1. **Existing zone** — cursor over a `[data-component-id^="__zone:"]` element in the valid set. Indicator: semi-transparent accent overlay on the zone.
2. **Inter-zone gap** — cursor in the gap between a zone and centre on a 1-zone side. Indicator: line showing where the split will appear. Only available when `allowedZones` includes the new zone.

At most one indicator visible at a time.

### Constraint validation

On drag start: `engine.getValidDropZones(panelKey)` returns the set of zones this panel can reach. Only those zones show indicators. `fixed: true` panels are not draggable.

### Drop execution

On `mouseup` over valid target:

1. Determine target zone
2. `engine.movePanel(panelKey, targetZone)` → new component tree
3. Dispatch `pages-dock-rearrange` event
4. Site handler: teardown + re-render + restore state + save layout

On `mouseup` over invalid/no target: cancel, restore visuals.

### Event contract

```typescript
// pages-dock-rearrange
interface DockRearrangeDetail {
  readonly panelKey: string;
  readonly fromZone: DockZone;
  readonly toZone: DockZone;
}
```

Added to reserved events in `pages-event-contract` protocol.

### Keyboard support

Not in initial scope. Panels remain keyboard-accessible (button focus, Enter/Space toggle). Keyboard rearrangement deferred to future work (context menu: "Move to → [zone list]").

## 6. Teardown & Re-render

### Scoped teardown

`rerenderWorkbench(newTree)` in `site.ts`:

1. Cancel pending layout save timer
2. Reattach any detached panels
3. Clear component registry
4. Clear DOM: `target.innerHTML = ""`
5. Re-render: `renderComponent(target, newTree, { permissions, onNode })`
6. Reapply saved split ratios
7. Reapply dock state
8. Re-trigger data requests for newly rendered components
9. Schedule layout save

### What survives re-render

Survives: `dockState`, `splitRatios`, data pipeline, filter state, edit state, abort controller, zone layout engine, context manager.

Does not survive: DOM elements, component registry entries, event listeners on old DOM, deferred render state, detached panel windows, dock-bar button handlers, split drag handlers.

### Data pipeline reconnection

Activation callback re-registers components and dispatches `pages-data-request`. Cached datasets in the data pipeline serve immediately — no re-fetch.

### Re-render timing

Synchronous in the `pages-dock-rearrange` handler. Single frame update — no flash of empty content.

## 7. Layout Persistence

### Capture

`captureLayout()` includes `zones: Object.fromEntries(engine.zoneMap)` when a zone engine exists. Non-workbench layouts omit the field.

### Restore

1. Load LayoutState from store
2. Seed `splitRatios` and `dockState` (existing)
3. Pass `zones` to `createZoneLayoutEngine(config, savedZones)`
4. Engine builds tree with saved zone assignments
5. Render and apply dock state (existing)

### Resilience

- Saved zone for panel no longer in config → dropped
- New panel not in saved zones → config default
- Saved zone violating `allowedZones` → config default fallback

### URL hash

Zone assignments are NOT in the URL hash. They are user preferences persisted via LayoutStore, not shareable navigation state. Same pattern as dock visibility.

### REST layout store

No code changes. `zones` is an optional `Record<string, DockZone>` — `JSON.stringify`/`JSON.parse` handle it. Old saved layouts without `zones` load fine.

## 8. Testing Strategy

### Unit tests — Zone Layout Engine

`packages/pages-runtime/src/zone-layout-engine.test.ts`

- Tree generation: 1-zone → single container; 2-zone → split with two containers
- Zone map initialization from config defaults
- Zone overrides from saved state
- Invalid/stale override handling
- `movePanel` updates zone map and tree
- Constraint validation: `allowedZones`, `fixed`
- Dynamic zone creation (1→2) and collapse (2→1)
- Backward compat: flat-array normalization

### Unit tests — Dock-Bar Zone Grouping

`packages/pages-runtime/src/activation.test.ts` (extend)

- Zone group rendering with spacer
- Exclusive scoping per zone group
- Single-zone bar unchanged
- `data-dock-zone` attributes on groups and buttons

### Integration tests — Workbench

`packages/pages-runtime/src/workbench.test.ts` (extend)

- Two-zone workbench renders correctly
- Rearrange → re-render → panel in new zone
- Layout persistence round-trip with zones
- Cascading collapse with zones
- Backward compat with flat-array config

### Integration tests — Drag System

`packages/pages-runtime/src/dock-drag.test.ts` (new)

- Drag initiation threshold (5px)
- Fixed button not draggable
- Drop indicator visibility on valid/invalid zones
- Successful drop fires `pages-dock-rearrange`
- Cancelled drop cleans up
- Constraint validation during drag

## File Impact Summary

| File | Change |
|------|--------|
| `pages-component/src/model/types.ts` | Add optional `zones` to `LayoutState` |
| `pages-component/src/model/component-props.ts` | Extend `DockItem`, `DockBarProps` with zone/constraint fields |
| `pages-ui/src/dsl/builders.ts` | Extend `DockPanelConfig`, `DockWorkbenchConfig`, `DockSideConfig`; extract tree generation logic |
| `pages-runtime/src/zone-layout-engine.ts` | **New** — zone layout engine |
| `pages-runtime/src/zone-layout-engine.test.ts` | **New** — zone engine unit tests |
| `pages-runtime/src/activation.ts` | Zone-grouped dock-bar rendering, exclusive scoping |
| `pages-runtime/src/site.ts` | Zone engine integration, `rerenderWorkbench()`, `pages-dock-rearrange` handler, extended `captureLayout()` |
| `pages-runtime/src/dock-drag.ts` | **New** — drag-and-drop system |
| `pages-runtime/src/dock-drag.test.ts` | **New** — drag system tests |
| `pages-runtime/src/workbench.test.ts` | Extend with zone tests |
| `docs/protocols/casehub/pages-event-contract.md` | Add `pages-dock-rearrange` to reserved events |
