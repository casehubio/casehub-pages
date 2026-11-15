# Phase 5 — Step-Viewer Visual Parity Design

**Issue:** casehubio/casehub-pages#643
**Date:** 2026-11-09
**Package:** `packages/pages-step-viewer/`
**Scale:** M | **Complexity:** Low

---

## Summary

Complete the step-viewer rendering to cover all decorator types, missing action icons, and new step types (ControlStep, FusedPipelineStep). Refactors the badge system from hardcoded per-kind logic to a data-driven config map.

## L2 — Decorator Badge Rendering

### Problem

`decorator-badge.ts` renders 9 of 36 decorator types. The remaining 27 are silently dropped — present in the step's `decorators` map but never rendered. The current architecture uses:
- A `DecoratorKind` union type (9 values)
- Per-kind CSS `:host([kind="..."])` color rules (9 rules)
- A hardcoded `ICONS` record (9 entries)
- A 40-line if-chain in `step-card.ts:renderDecorators()` (9 branches)

This doesn't scale to 36 entries.

### Design

**New file: `decorator-config.ts`**

A single `DECORATOR_CONFIG` map: `Record<string, { icon: string; bg: string; fg: string; label: (v: unknown) => string }>`.

Each entry specifies the icon glyph, background RGB components (for `rgba(r,g,b, 0.2)`), foreground hex color, and a label formatting function.

**Semantic color groups** (Catppuccin Mocha palette):

| Group | Color | fg hex | Decorators |
|-------|-------|--------|------------|
| Control flow | Mauve | `#cba6f7` | `if`, `when`, `on-success`, `on-failure`, `on-error`, `on-complete` |
| Iteration | Teal | `#94e2d5` | `loop`, `forEach` |
| Timing | Yellow | `#f9e2af` | `timeout`, `delay`, `wait`, `speed` |
| Synchronisation | Red | `#f38ba8` | `mutex`, `semaphore`, `barrier`, `quorum`, `cancel` |
| Data flow | Blue | `#89b4fa` | `publish`, `from`, `transform`, `capture`, `content` |
| Lifecycle | Peach | `#fab387` | `retry`, `trigger`, `transition`, `signal`, `at`, `resource`, `priority` |
| Execution | Green | `#a6e3a1` | `background`, `simulation`, `mode` |
| Metadata | Grey | `#7f849c` | `label`, `target`, `actor`, `await` |

**Refactored `decorator-badge.ts`:**
- Remove `DecoratorKind` union type — `kind` becomes `string`
- Remove per-kind CSS `:host([kind="..."])` rules
- Import `DECORATOR_CONFIG` and resolve `icon`, `bg`, `fg` from the map at render time
- Apply colors via inline CSS custom properties: `style="--badge-bg: rgba(${bg}, 0.2); --badge-fg: ${fg}"`
- Single CSS rule using the custom properties

**Refactored `step-card.ts:renderDecorators()`:**
- Replace the if-chain with iteration over `Object.entries(decs)`
- For each key present in `DECORATOR_CONFIG`, emit a `<decorator-badge>` with the config's label function applied to the value
- Special case: `if` maps to `when` config (existing behaviour preserved)
- Special case: `forEach` label handles both string and object forms (existing behaviour preserved)

### Icon assignments

| Decorator | Icon | Rationale |
|-----------|------|-----------|
| `retry` | ↻ | Existing |
| `timeout` | ⏱ | Existing |
| `loop` | ↻ | Existing |
| `when` / `if` | ? | Existing |
| `mutex` | 🔒 | Existing |
| `forEach` | ∀ | Existing |
| `publish` | 📡 | Existing |
| `from` | 📥 | Existing |
| `cancel` | ⏹ | Existing |
| `on-success` | ✓ | Success/green check |
| `on-failure` | ✗ | Failure/cross |
| `on-error` | ⚠ | Warning/error |
| `on-complete` | ◉ | Completion dot |
| `delay` | ⏱ | Same as timeout (timing) |
| `wait` | ⏳ | Hourglass (blocking wait) |
| `speed` | ⚡ | Lightning (rate) |
| `trigger` | ⚡ | Lightning (event trigger) |
| `transition` | ⇢ | State transition arrow |
| `signal` | ◇ | Diamond (existing in icons.ts) |
| `transform` | ⇄ | Bidirectional transform |
| `capture` | ⊙ | Target/capture |
| `content` | ≡ | Content lines |
| `semaphore` | ⊜ | Permit counter |
| `barrier` | ‖ | Barrier bars |
| `quorum` | ⊞ | Quorum grid |
| `background` | ⟳ | Async loop |
| `simulation` | ◈ | Simulated diamond |
| `mode` | ⊕ | Mode switch |
| `label` | ≋ | Label tag |
| `target` | ⊚ | Target ring |
| `actor` | ◇ | Actor diamond |
| `await` | ◈ | Await (existing in icons.ts) |
| `at` | @ | At-sign (scheduling) |
| `resource` | ⊟ | Resource box |
| `priority` | ↑ | Priority arrow |

## L3 — Action Icon Coverage

### Problem

`icons.ts` ICON_MAP covers 10 actions. 6 are missing: `rest-request`, `process`, `agent-invoke`, `mcp`, `emit-event`, `verify-simulation`.

### Design

Add entries to `ICON_MAP` and corresponding CSS color classes to `step-card.ts`:

| Action | Symbol | colorClass | Color |
|--------|--------|------------|-------|
| `rest-request` | ⇄ | `rest` | Peach (`#fab387`) |
| `process` | ⊞ | `process` | Grey (`#7f849c`) |
| `agent-invoke` | ◈ | `agent` | Teal (`#94e2d5`) |
| `mcp` | ⊛ | `mcp` | Mauve (`#cba6f7`) |
| `emit-event` | ◇ | `event` | Yellow (`#f9e2af`) |
| `verify-simulation` | ✓ | `assert` | Green (reuse existing `assert` class) |

Tests: add one `expect` per new action to `icons.test.ts`.

## L4 — New Step-Type Components

### ControlStep (`control-step.ts`)

A single card showing the control action (pause or resume) with target.

- Icon: `⏸` for pause, `▶` for resume
- Layout: `[icon] [action] [target]` — same horizontal flow as step-card
- Color: Yellow background (pause = warning-like) or green (resume = go)
- Decorator badges rendered via the same data-driven system as step-card
- Registered as `<control-step>` custom element

### FusedPipelineStep (`fused-pipeline-step.ts`)

A vertical chain of stage cards showing the streaming pipeline flow.

- Each stage rendered as a compact card: `[icon] [actionName] [params summary]`
- Stages connected by `→` pipe connectors (thin vertical line + arrow between cards)
- Stage icons use `getActionIcon()` from icons.ts
- Outer container has a subtle pipeline-specific border (teal, matching streaming theme)
- Decorator badges on the outer step rendered above the pipeline chain
- Registered as `<fused-pipeline-step>` custom element

### step-dispatch.ts changes

Add two cases to `renderStepContent()`:

```typescript
case 'control':
  return html`<control-step .step=${step}></control-step>`;
case 'fused-pipeline':
  return html`<fused-pipeline-step .step=${step}></fused-pipeline-step>`;
```

Import both new components at the top of the file.

## Files Changed

| File | Change |
|------|--------|
| `src/decorator-config.ts` | **New** — DECORATOR_CONFIG map (35 entries) |
| `src/decorator-badge.ts` | Refactor — resolve from config, CSS custom properties |
| `src/step-card.ts` | Refactor — data-driven renderDecorators(), new icon color classes |
| `src/icons.ts` | Add 6 entries to ICON_MAP |
| `src/icons.test.ts` | Add tests for new icons |
| `src/control-step.ts` | **New** — ControlStep renderer |
| `src/fused-pipeline-step.ts` | **New** — FusedPipelineStep renderer |
| `src/step-dispatch.ts` | Add control + fused-pipeline cases |
| `src/index.ts` | Export new components |

## Testing

- `icons.test.ts` — verify all 16 actions return correct icon/colorClass
- Existing decorator-badge consumers unaffected (Shadow DOM encapsulation)
- Gallery verification — render examples with all decorator types, new step types

## References

- `packages/pages-step-viewer/src/decorator-badge.ts` — existing 9-kind badge component
- `packages/pages-step-viewer/src/step-card.ts:165-206` — existing renderDecorators() if-chain
- `packages/pages-step-viewer/src/icons.ts` — existing 10-entry ICON_MAP
- `packages/pages-step-viewer/src/step-dispatch.ts` — existing step kind dispatch
- `packages/yaml-core/src/step/walker.ts:238-247` — DECORATOR_KEYS (36 entries)
- `packages/yaml-core/src/step/walker.ts:212-219` — ControlStep interface
- `packages/yaml-core/src/step/walker.ts:224-230` — FusedPipelineStep interface
- `packages/yaml-core/src/step/streaming-types.ts:16-23` — FusedStageDescriptor
- `docs/specs/2026-11-07-ts-platform-parity-audit.md` — L2, L3, L4 gap descriptions
- D6, D7, D8 in `decisions.md` — architecture, color grouping, visual approach decisions
