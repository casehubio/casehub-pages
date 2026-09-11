# Theme Designer Component — Design Spec

**Issue:** #415
**Date:** 2026-09-07
**Branch:** `issue-415-theme-designer`

## Overview

Browser-based theme generation component that exposes the existing `pages-ui-tokens` pipeline to end users. Users provide a few brand colours, the pipeline generates a complete theme (12-step colour scales, semantic mappings, elevation, density), and the result is registered and persisted.

The pipeline is already 100% TypeScript with zero Node dependencies. This work wraps it in a UI.

## Architecture

### New files in `packages/pages-ui-tokens/src/`

```
theme-storage.ts        — ThemeStorage SPI + LocalStorageThemeStorage
theme-storage.test.ts
theme-designer.ts       — <pages-theme-designer> Lit component
theme-designer.test.ts
```

### Modified files

```
theme-picker.ts         — add "customize" button that opens designer
theme-picker.test.ts    — tests for new button
index.ts                — export ThemeStorage, PagesThemeDesignerElement
build.ts                — export ThemeStorage interface for build consumers
```

### Server additions (`examples/server/`)

```
src/main/java/io/casehub/pages/examples/ThemeResource.java
src/test/java/io/casehub/pages/examples/ThemeResourceTest.java
```

### Showcase

```
examples/samples/Theming/Theme Designer.dash.yaml
examples/samples/Theming/Theme Designer.ts     (optional companion)
```

## Component: `ThemeStorage` SPI

```typescript
interface ThemeStorage {
  save(name: string, config: PresetConfig): Promise<void>;
  load(name: string): Promise<PresetConfig | undefined>;
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}
```

### `LocalStorageThemeStorage`

Default implementation. Stores `PresetConfig` as JSON under `pages-theme:<name>` keys.

- `save`: `localStorage.setItem('pages-theme:' + name, JSON.stringify(config))`
- `load`: parse from `localStorage.getItem('pages-theme:' + name)`
- `list`: scan `localStorage` keys with `pages-theme:` prefix, return names
- `remove`: `localStorage.removeItem('pages-theme:' + name)`

### `ServerThemeStorage`

REST-backed implementation. Constructor takes a base URL (defaults to `/api/themes`).

- `save`: `PUT /api/themes/{name}` with `PresetConfig` JSON body
- `load`: `GET /api/themes/{name}` → 200 with JSON or 404
- `list`: `GET /api/themes` → string array
- `remove`: `DELETE /api/themes/{name}`

### Auto-detection

On component connection, probe `GET /api/themes` with a short timeout (~2s). If it responds 200, use `ServerThemeStorage`. Otherwise fall back to `LocalStorageThemeStorage`. The `storage` property on the component overrides auto-detection.

## Component: `<pages-theme-designer>`

Lit web component rendered as a full-page modal overlay.

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `open` | `boolean` | `false` | Controls visibility |
| `storage` | `ThemeStorage` | auto-detect | Pluggable storage backend |
| `target` | `HTMLElement` | `document.documentElement` | Where to apply preview theme |
| `preset` | `PresetConfig \| undefined` | — | Pre-populate with existing preset for editing |

### Events

| Event | Detail | When |
|-------|--------|------|
| `pages-theme-created` | `{ name: string, config: PresetConfig }` | New theme saved |
| `pages-theme-updated` | `{ name: string, config: PresetConfig }` | Existing theme updated |
| `pages-theme-deleted` | `{ name: string }` | Theme removed |
| `pages-designer-closed` | — | Modal closed |

### Simple mode (default view)

Controls:
- **Accent hue** — colour wheel or hue slider (0-360)
- **Neutral hue** — hue slider (0-360)
- **Chroma** — slider (0.0 - 0.4)
- **Contrast** — slider (0.0 - 1.0)

These four values map directly to `ThemeConfig` (used in `themes.ts`'s `generateThemeCSS`). On any change, regenerate the theme CSS and apply it live to `target`.

Preview panel:
- 12-step colour swatches for each semantic group (accent, neutral, success, warning, danger, info)
- Mini UI mockup showing buttons, text, surfaces, borders with the generated tokens applied

### Advanced mode (toggle)

Shows the full `PresetConfig` pipeline:
- Each transform stage as a collapsible card
- Cards show: transform name, params as editable controls
- Add/remove/reorder stages via drag or buttons
- Available transforms listed from `listTransforms()`

When advanced mode is active, simple mode controls are hidden — the pipeline is the source of truth. Switching back to simple mode extracts hue/chroma/contrast from the pipeline params if possible.

### Toolbar

- **Name field** — theme name input
- **Save** — runs pipeline, calls `registerTheme(name, css)`, calls `storage.save(name, config)`, dispatches event
- **Load** — dropdown of saved themes from `storage.list()`, selecting one loads the `PresetConfig` into the editor
- **Delete** — removes from storage and registry
- **Import** — file input for JSON, loads `PresetConfig`
- **Export** — downloads current `PresetConfig` as `<name>.theme.json`
- **Close** — closes modal

### Theme registration flow

1. User adjusts controls → pipeline runs on every change → CSS generated → applied to `target` as live preview
2. User clicks Save → `registerTheme(name, generatedCSS)` → theme appears in any `<pages-theme-picker>` on the page
3. `storage.save(name, presetConfig)` persists for reload
4. Dispatches `pages-theme-created` event

### Restoring saved themes on page load

The `init.ts` module already runs at import time and registers builtin themes. Custom themes need the same treatment. Add to `init.ts`:

```typescript
const storage = new LocalStorageThemeStorage();
storage.list().then(names => {
  for (const name of names) {
    storage.load(name).then(config => {
      if (!config) return;
      initPresets();
      const tokens = runPipeline(config);
      const css = generateCSS(tokens, config.$name);
      registerTheme(config.$name, css);
    });
  }
});
```

This ensures custom themes appear in the picker on every page load without requiring the designer to be opened.

## Component: `<pages-theme-picker>` changes

Add a "customize" icon button (palette/paintbrush icon) to the picker's UI. Clicking it:

1. Creates a `<pages-theme-designer>` if not already in the DOM
2. Sets `open = true`
3. If a theme is currently selected, passes it as `preset` for editing

The button appears in both full and compact modes.

## Server: `ThemeResource.java`

Quarkus REST resource at `/api/themes`.

### Configuration

```properties
casehub.pages.themes.directory=${user.home}/.casehub/themes
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/themes` | List theme names (string array) |
| `GET` | `/api/themes/{name}` | Load theme config JSON |
| `PUT` | `/api/themes/{name}` | Save/update theme config |
| `DELETE` | `/api/themes/{name}` | Remove theme |

Theme configs are stored as `{name}.json` files in the configured directory. The resource creates the directory on first write if it doesn't exist.

Request/response body is the `PresetConfig` JSON structure — the server treats it as opaque JSON (no Java model needed, just pass-through `JsonObject`).

## Showcase sample

`examples/samples/Theming/Theme Designer.dash.yaml`:

```yaml
title: Theme Designer
description: Create and customize themes with live preview
displayers:
  - type: html
    html: |
      <pages-theme-designer open></pages-theme-designer>
```

## Testing strategy

- **Unit tests** (`theme-storage.test.ts`): mock `localStorage`, test SPI contract
- **Unit tests** (`theme-designer.test.ts`): Lit component lifecycle, simple mode slider → CSS generation, save/load flow, event dispatch
- **Unit tests** (`theme-picker.test.ts`): customize button renders, opens designer
- **Integration test** (`ThemeResourceTest.java`): CRUD endpoints, file persistence
- **Visual verification**: run examples gallery, open designer, create a theme, verify it appears in picker

## References

- `packages/pages-ui-tokens/src/themes.ts` — existing `generateThemeCSS`, `ThemeConfig`, `injectTheme`
- `packages/pages-ui-tokens/src/pipeline.ts` — `runPipeline`, `buildInitialTokenMap`
- `packages/pages-ui-tokens/src/output.ts` — `generateCSS`, `generateDTCG`
- `packages/pages-ui-tokens/src/transforms/index.ts` — preset definitions, transform registration
- `packages/pages-ui-tokens/src/theme-picker.ts` — existing picker component
- `packages/pages-ui-tokens/src/runtime.ts` — `registerTheme`, `applyTheme`, `listThemes`
- `examples/server/src/main/java/io/casehub/pages/examples/DemoResource.java` — server pattern
- `docs/specs/2026-07-23-pages-pluggable-theme-system-design.md` — original theme system design
