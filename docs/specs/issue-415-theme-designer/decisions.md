# Decisions — Theme Designer (#415)

## D1: Component placement

**Choice:** Build `<pages-theme-designer>` in `pages-ui-tokens` alongside the existing `<pages-theme-picker>`
**Alternatives:**
- Build in examples app — would not be reusable by blocks-ui, claudony, or other consumers
- Build as a separate package — unnecessary isolation for a component tightly coupled to the theme pipeline
**Rationale:** The theme picker and designer share the same runtime (`registerTheme`, `applyTheme`, `listThemes`) and the same pipeline API. Any consumer of `<pages-theme-picker>` automatically gets the designer.
**Trade-offs:** Increases `pages-ui-tokens` bundle size for consumers who don't use the designer
**Sources:** `packages/pages-ui-tokens/src/theme-picker.ts`, `packages/pages-ui-tokens/src/index.ts`, `docs/specs/2026-07-23-pages-pluggable-theme-system-design.md`
**Exploration:** quick
**Status:** captured

## D2: UI modes — simple + advanced

**Choice:** Two-layer UI — simple mode (hue pickers + chroma/contrast sliders) as default, advanced mode (full pipeline editor) behind a toggle
**Alternatives:**
- Simple only — limits power users who need full pipeline control
- Advanced only — overwhelming for users who just want to pick brand colours
**Rationale:** Simple mode covers 90% of use cases (pick a few colours, get a theme). Advanced mode exposes the same underlying `PresetConfig` pipeline for users who need per-stage control. Same data model, two presentation layers.
**Trade-offs:** More UI code to build and maintain
**Sources:** `packages/pages-ui-tokens/src/transforms/index.ts` (pipeline stages), `packages/pages-ui-tokens/src/types.ts` (PresetConfig)
**Exploration:** quick
**Status:** captured

## D3: Storage architecture — SPI with pluggable backends

**Choice:** Define a `ThemeStorage` interface with async methods (`save`, `load`, `list`, `remove`). Ship `LocalStorageThemeStorage` as default. `ServerThemeStorage` hits Quarkus REST endpoints. Auto-detect server availability; allow explicit override via component property.
**Alternatives:**
- localStorage only — no server persistence, themes lost on browser data clear
- Server only — doesn't work without a running backend
- Direct localStorage without SPI — locks in the storage mechanism
**Rationale:** SPI allows the storage to evolve without changing the component. Async interface from day one so swapping to server/IndexedDB/REST doesn't break the contract. Auto-detection means zero config for simple deployments.
**Trade-offs:** Slightly more code than direct localStorage. Auto-detection adds a network probe on init.
**Sources:** `examples/server/src/main/java/io/casehub/pages/examples/DemoResource.java` (existing server pattern)
**Exploration:** quick
**Status:** captured

## D4: Integration with theme picker

**Choice:** Add a "customize" button to `<pages-theme-picker>` that opens `<pages-theme-designer>` as a modal overlay
**Alternatives:**
- Standalone component only, no picker integration — users must know to add `<pages-theme-designer>` separately
- Embed designer inline in the picker dropdown — too much UI for a dropdown
**Rationale:** The picker is already deployed in every consumer. A button there gives instant discoverability. Modal overlay gives the designer room for the preview panel and controls.
**Trade-offs:** Picker now has a dependency on the designer component
**Sources:** `packages/pages-ui-tokens/src/theme-picker.ts`
**Exploration:** quick
**Status:** captured

## D5: Server-side theme storage

**Choice:** New `ThemeResource.java` Quarkus endpoint with CRUD REST API, reading/writing JSON files from a `themes/` directory
**Alternatives:**
- Database-backed storage — overkill for theme configs, adds schema management
- Embed in existing `DemoResource` — conflates concerns
**Rationale:** File-based storage is simple, inspectable, and version-controllable. Separate resource follows the existing server pattern. Can migrate to DB later via the SPI.
**Trade-offs:** No concurrent write safety (acceptable for theme configs — low contention)
**Sources:** `examples/server/src/main/java/io/casehub/pages/examples/DemoResource.java`, `examples/server/src/main/resources/application.properties`
**Exploration:** quick
**Status:** captured
