# OKLCH Token Alignment — Design Spec

**Issue:** #124
**Date:** 2026-07-06
**Status:** Draft

## Context

The examples gallery and auth widgets predate the OKLCH design token system
(`@casehubio/pages-ui-tokens`). They use 75+ hardcoded hex colours, raw px
values, and a custom purple gradient brand. Since pages is the reference
implementation that downstream consumers follow, this creates confusion
about the "right" visual language.

The token system is already fully adopted by pages-primitives,
pages-component, and pages-viz. The examples gallery and auth widgets are
the remaining gaps.

## Scope

**In scope:**
- Fresh `examples/src/styles.css` rewrite on the token system (port, not patch)
- Wire `injectTheme()` and `applyThemeMode()` into the gallery entry point
- Theme toggle (light/dark) and density toggle (comfortable/compact) in the gallery header
- Auth widget token migration (`identity-widget.ts`, `dev-auth-gate.ts`)
- PagesBadge `DEFAULT_PALETTE` replacement with token-derived colours

**Out of scope:**
- Downstream app audits (Phase 4 from the issue — tracked as new issue, see below)
- blocks-ui token migration (blocks-ui#21)
- npm publish (tracked as #121)
- Gallery structural changes (layout, JS logic, sample loading — unchanged)

**Deferred-scope GitHub issues to create at implementation time:**
- Phase 4 downstream app token audit — one issue per consuming app
  (DraftHouse, Claudony, DevTown) for their respective repos

## Design

### 1. Examples gallery `styles.css` — fresh rewrite

Write a new `styles.css` from scratch using the token system. Every selector
from the current 445-line file is ported — same selectors, same layout
behaviour, different visual values. Gap analysis against the original
ensures nothing is missed.

Key mapping decisions:

| Element role | Token mapping |
|-------------|---------------|
| Page background | `var(--pages-neutral-2)` |
| Surfaces (sidebar, cards, panels) | `var(--pages-neutral-1)` |
| Borders | `var(--pages-neutral-4)` |
| Headings | `var(--pages-neutral-12)` / `var(--pages-font-weight-semibold)` |
| Body text | `var(--pages-neutral-11)` |
| Labels | `var(--pages-neutral-9)` / `var(--pages-font-size-sm)` |
| Hints | `var(--pages-neutral-8)` / `var(--pages-font-size-xs)` |
| Accent colour (header, active, focus) | `var(--pages-accent-9)` |
| Accent hover | `var(--pages-accent-10)` |
| Active item background | `var(--pages-accent-3)` |
| Hover backgrounds | `var(--pages-neutral-2)` |
| Spacing (padding, gap, margin) | `var(--pages-space-*)` scale (see rounding strategy below) |
| All font sizes | `var(--pages-font-size-*)` scale |
| All border-radius | `var(--pages-radius-*)` scale |
| All shadows | `var(--pages-shadow-*)` scale |
| All transitions | `var(--pages-duration-*) var(--pages-ease-*)` |
| Font family | `var(--pages-font-family)` |

**Header:** Solid `var(--pages-accent-9)` background with white text.
No gradient — adapts to dark mode and accent hue changes automatically.

**Code panel:** Keeps hardcoded dark colours (`#1e1e1e`, `#d4d4d4`) — code
panels have their own colour system independent of the theme. The border
between the code panel and main content uses `var(--pages-neutral-6)` so
the visual boundary adapts in dark mode (where both areas are dark).

**Spacing rounding strategy:** Values that fall between token steps round
to the nearest token. `padding: 10px 12px` becomes `var(--pages-space-3)
var(--pages-space-3)` (12px, rounding 10→12). `top: 5px` becomes
`var(--pages-space-1-5)` (6px, rounding 5→6). Sizing values (`width`,
`height`) are not spacing and stay as literal px when no semantic token
applies. The stat card display size (`font-size: 36px`) exceeds the
typography scale (max 2xl=24px) — keep as `36px` literal; display sizes
are one-off values that don't belong in the scale.

**Config bar:** Tokenised — input borders, focus ring, button colours all
use tokens.

### 2. Theme injection and toggles

**`examples/src/casehub-entry.ts`** — add theme injection at bundle load
time (before `app.js` runs). `app.js` is vanilla JavaScript loaded via
`<script src="app.js">` — it cannot use ES module imports from npm
packages.

```typescript
import { injectTheme, applyThemeMode, DEFAULT_THEME } from '@casehubio/pages-ui-tokens';

// Inject tokens onto document root so the gallery shell gets them immediately
injectTheme(DEFAULT_THEME);
applyThemeMode(document.documentElement, 'light');

// Expose toggle functions for app.js
export { injectTheme, applyThemeMode, DEFAULT_THEME };
```

The `window.casehubPages` global (already used by `app.js` for
`loadSite()`) gains `applyThemeMode` for the toggle handlers.

**Dual injection:** `injectTheme()` is called twice — once on
`document.documentElement` (by `casehub-entry.ts`, for the gallery shell)
and once on `sampleTarget` (by `loadSite()`, for the rendered dashboard).
This is correct: the gallery shell (sidebar, header, search) needs tokens,
and each sample gets its own scoped injection. CSS cascade means the
`sampleTarget`-scoped tokens win inside samples — a `SiteOptions.themeConfig`
override would diverge from the gallery theme for that sample only, which
is the desired behavior.

**Theme/density toggles** in the gallery header (`.header` section):
- Light/dark toggle — calls `applyThemeMode()` on both `document.documentElement`
  (gallery shell) and the current `LiveSite.setTheme()` (rendered sample)
- Comfortable/compact toggle — toggles `.pages-density-compact` class on `document.documentElement`
- Small icon buttons, right-aligned in the header

### 3. Auth widget token migration

Both widgets use inline `<style>` in Shadow DOM with `attachShadow({ mode:
'open' })`. CSS custom properties inherit through Shadow DOM boundaries —
this is how every `pages-viz` component already works (`PagesElement.ts`
uses `var(--pages-neutral-12, #333)` etc. inside shadow roots without any
theme injection into the shadow root).

**Approach:** Replace hardcoded hex values with `var(--pages-*, fallback)`
references in the existing inline `<style>` blocks. No `adoptedStyleSheets`,
no `CSSStyleSheet` sharing, no browser fallback logic. The tokens resolve
via inheritance from whatever ancestor has `injectTheme()` and
`.pages-theme-light` / `.pages-theme-dark`.

Note: `generateThemeCSS()` produces class-scoped rules (`.pages-theme-light
{ ... }`). These selectors would not match inside a shadow root (no element
carries the class there), so `adoptedStyleSheets` would fail silently.

Token mappings for auth widgets:

| Current | Token |
|---------|-------|
| `#f0f0f0` | `var(--pages-neutral-2)` |
| `#e0e0e0` | `var(--pages-neutral-4)` |
| `#ccc` | `var(--pages-neutral-5)` |
| `#007bff` | `var(--pages-accent-9)` |
| `#0056b3` | `var(--pages-accent-10)` |
| `rgba(0,0,0,0.2)` shadow | `var(--pages-shadow-2)` |
| `rgba(0,0,0,0.3)` shadow | `var(--pages-shadow-3)` |
| `rgba(0,0,0,0.5)` overlay | `oklch(0% 0 0 / 0.5)` (keep as literal — overlay opacity isn't a token) |
| `white` | `var(--pages-neutral-1)` |
| `border-radius: 4px` | `var(--pages-radius-sm)` |
| `border-radius: 8px` (dialog) | `var(--pages-radius-lg)` |

### 4. PagesBadge palette

`PagesBadge.ts` already uses several tokens for its CSS. The issue is
`DEFAULT_PALETTE` — a 9-colour hex array used for auto-assigning badge
colours.

**Replace with token-derived colours** using the semantic scales:

```typescript
const DEFAULT_PALETTE = [
  'var(--pages-accent-9)',
  'var(--pages-success-9)',
  'var(--pages-warning-9)',
  'var(--pages-danger-9)',
  'var(--pages-info-9)',
  'var(--pages-accent-11)',
  'var(--pages-success-11)',
  'var(--pages-warning-11)',
  'var(--pages-danger-11)',
];
```

This gives 9 distinct colours from the semantic scales that adapt to
theme changes. Step 9 (lightness 50%) and step 11 (lightness 35%) both
pass WCAG AA contrast with white badge text. Step 7 (lightness 62%) was
rejected — it gives only ~2.76:1 contrast with white, failing both AA
(4.5:1) and large-text AA (3:1) thresholds.

**Note:** `badge.style.backgroundColor = color` sets inline style. CSS
custom property references work in inline styles — `element.style.backgroundColor = 'var(--pages-accent-9)'`
is valid and resolves at paint time.

## Testing

- **Playwright smoke tests:** The existing 77+ Playwright tests (`smoke.spec.ts`
  loads every sample and verifies no rendering errors) catch functional
  regressions. These are functional tests — they verify element presence,
  component rendering, and error-free loading. They do not perform visual
  comparison (no screenshot baselines).
- **Visual verification:** Serve the examples gallery (`yarn workspace
  @casehub/pages-examples run serve`), walk through every dashboard category,
  confirm visual coherence with the token system. Visual changes are expected
  and desired (hex→token alignment).
- **Theme toggle:** Verify light/dark switch works across all gallery UI and rendered dashboards
- **Density toggle:** Verify compact mode tightens spacing in gallery shell
- **Auth widgets:** Test login flow with token-based styles
- **PagesBadge:** Verify badge colours render from token values
- **Post-migration:** Establish Playwright screenshot baselines for future
  regression detection after the token migration is visually verified

## Implementation order

1. Fresh `styles.css` + theme injection + toggles (largest change, standalone)
2. Auth widget migrations (small, independent)
3. PagesBadge palette replacement (smallest, independent)
