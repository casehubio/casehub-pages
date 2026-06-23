# Theme System, Table Export, Loading States — Design Spec

Covers #17 (theming + dark mode), #18 (CSV/clipboard export), #19 (loading/error states).

## #17 — Theme System

### New module: `packages/pages-viz/src/base/theme.ts`

**`CasehubTheme` interface** — maps all CSS custom property tokens to values:
- `font`, `fontSize`, `text`, `textMuted`, `bg`, `bgAlt`, `bgHover`, `bgDisabled`, `border`, `radius`, `accent`, `accentHover`, `accentSubtle`

**`LIGHT_THEME`** — uses the existing component fallback values (e.g. `#333`, `#fff`, `#5470c6`).

**`DARK_THEME`** — dark counterparts (e.g. `#e0e0e0`, `#1a1a2e`, `#7c8cf8`).

**`applyTheme(el, theme)`** — calls `el.style.setProperty()` for each token. Sets `data-casehub-theme` attribute.

**`clearTheme(el)`** — calls `removeProperty()` for each, removes data attribute.

### Changes to `interactive.ts`

Replace all ~30 hardcoded hex colors with `var(--casehub-*, fallback)`. No structural changes.

### Changes to `site.ts`

- Replace manual 2-property dark mode with `applyTheme(target, isDark ? DARK_THEME : LIGHT_THEME)`.
- Add `setTheme(theme: "light" | "dark" | CasehubTheme): void` to `LiveSite`.
- `setTheme()` applies theme to target, then iterates component registry to set `.theme` on chart elements (triggers ECharts re-init).

### Exports

`CasehubTheme`, `LIGHT_THEME`, `DARK_THEME`, `applyTheme`, `clearTheme` from `@casehubio/pages-viz`.

## #18 — Table Export

### New module: `packages/pages-viz/src/components/table-export.ts`

**`tableToCsv(dataset, columns?, columnSettings?)`** — converts TypedDataSet to CSV string. Respects column name overrides. Handles quoting/escaping.

**`copyToClipboard(text)`** — `navigator.clipboard.writeText()` with fallback to `document.execCommand("copy")`.

**`downloadCsv(csv, filename?)`** — creates Blob, temporary `<a>` element, triggers download.

### Changes to `CasehubTable.ts`

When `props.csvExport` is truthy, render an export toolbar button (download icon) in the toolbar. On click: generate CSV from current filtered/sorted view, trigger download. Shift+click or separate button: copy to clipboard.

### Exports

`tableToCsv`, `copyToClipboard`, `downloadCsv` from `@casehubio/pages-viz`.

## #19 — Loading and Error States

### Changes to `CasehubElement.ts`

Override `renderLoading()` to show a CSS-only skeleton/pulse animation instead of "Loading…" text. The skeleton uses `--casehub-bg-alt` and `--casehub-border` for theme-aware appearance.

Override `renderError()` to show a structured error card with icon, message, and optional retry button. The retry button re-fires `casehub-data-request`. Uses `--casehub-accent` for the retry button.

### CSS

All loading/error CSS uses existing `--casehub-*` custom properties (theme-aware by design via #17).

### No changes to `site.ts` error banner

The `showErrorBanner()` in site.ts is a different concern (site-level operational errors). Component-level loading/error states are independent.
