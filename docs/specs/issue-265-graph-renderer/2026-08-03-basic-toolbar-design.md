# graph-renderer: Basic Toolbar — Design Spec

**Date:** 2026-08-03
**Issue:** #276 (graph-renderer: basic toolbar — zoom controls, layout reset)
**Parent:** #265 (Phase 1B — graph-renderer)
**Depends on:** #274 (ELK layout), #275 (interaction layer)
**Status:** Approved

---

## 1. Scope

Add a re-layout button to React Flow's existing Controls component and
style the controls with `--pages-*` design tokens. Zoom in/out/fit are
already provided by `<Controls />`.

**In scope:**
- `ControlButton` with re-layout action inside existing `<Controls>`
- `onRelayout` callback from ReactFlowApp to GraphCanvas
- `graph:layout:relayout` event emitted on re-layout
- CSS styling of `.react-flow__controls` with pages design tokens

**Out of scope:**
- Domain-specific toolbar buttons (Phase 4+)
- Separate toolbar component
- Keyboard shortcuts for layout

## 2. Decisions

### 2.1 Extend Controls, don't replace

React Flow's `<Controls />` already renders zoom in/out/fit-to-view
with accessible buttons, keyboard support, and positioning. Adding a
`<ControlButton>` inside it is the intended extension mechanism.

**Rationale:** XS scope. Building a separate toolbar for one extra
button is overengineered. React Flow's Controls handles the hard parts
(viewport API integration, ARIA labels).

### 2.2 Re-layout triggers full pipeline

The `onRelayout` callback calls `_runLayout()` on GraphCanvas — the
same method that runs on model change. This re-runs ELK on the current
model with current layout options.

**Rationale:** No new code path. The layout pipeline already handles
generation counters and error fallback.

## 3. API Changes

### 3.1 ReactFlowApp props

```typescript
export interface ReactFlowAppProps {
  // ... existing props unchanged
  onRelayout?: () => void;
}
```

### 3.2 ControlButton

```tsx
import { ControlButton } from '@xyflow/react';

<Controls>
  <ControlButton onClick={onRelayout} title="Re-layout">
    <span style={{ fontSize: '16px' }}>↻</span>
  </ControlButton>
</Controls>
```

### 3.3 GraphCanvas wiring

```typescript
onRelayout: () => {
  emitPagesEvent(this, 'graph:layout:relayout', {});
  void this._runLayout();
},
```

The event fires before the layout starts — consumers can show a loading
indicator. The layout result triggers a re-render automatically via
`_nodes`/`_edges` state updates.

## 4. CSS Styling

Inject styles for `.react-flow__controls` alongside the existing
isolation styles. Target the controls container and buttons:

```css
.react-flow__controls {
  background: var(--pages-neutral-1, #fafafa);
  border: 1px solid var(--pages-neutral-4, #ccc);
  border-radius: var(--pages-radius-md, 8px);
  box-shadow: var(--pages-shadow-sm, 0 1px 3px rgba(0,0,0,0.1));
}
.react-flow__controls-button {
  background: var(--pages-neutral-1, #fafafa);
  border-bottom: 1px solid var(--pages-neutral-3, #ddd);
  color: var(--pages-text-primary, #111);
  fill: var(--pages-text-primary, #111);
}
.react-flow__controls-button:hover {
  background: var(--pages-neutral-2, #f0f0f0);
}
```

Added to `css-isolation.ts`'s injected styles — no new file needed.

## 5. Test Coverage

| Test | What |
|------|------|
| ControlButton exists | ReactFlowApp renders a button with title "Re-layout" |
| onRelayout callback fires | Click re-layout button → callback invoked |

Existing bridge tests unchanged.

## 6. File Changes Summary

| File | Action |
|------|--------|
| `src/bridge/ReactFlowApp.tsx` | Add `onRelayout` prop, `ControlButton` inside `Controls` |
| `src/bridge/GraphCanvas.ts` | Wire `onRelayout` to `_runLayout()` + event emission |
| `src/bridge/css-isolation.ts` | Add controls styling to injected CSS |

## 7. Protocols Consulted

- **css-design-tokens** (PP-20260705-2ae91d) — `--pages-*` token usage
- **pages-event-contract** (PP-20260705-bac842) — `graph:layout:relayout` topic
