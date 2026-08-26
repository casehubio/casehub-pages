# Decisions — pages-property-palette (#373)

## D1: Package home

**Choice:** New `@casehubio/pages-property-palette` package in `packages/`
**Alternatives:**
- Inside `pages-ui-components` — simpler build graph but mixes low-level primitives with a high-level composed component; rich editors bloat the primitives package
- Split: editors in ui-components, palette separate — most flexible but more packages to manage, unclear editor ownership boundary
**Rationale:** Clean dependency: palette depends on `pages-ui-components` for form primitives (PagesInput, PagesSelect, PagesCheckbox, PagesTextarea). Rich editors (color picker, slider, tag editor) belong in the palette package since they're palette-specific. Keeps ui-components as low-level, general-purpose form controls.
**Trade-offs:** One more package in the monorepo build graph. Consumers importing just the palette get transitively larger dependency tree.
**Sources:** `packages/pages-ui-components/package.json`, issue #373 requirements
**Exploration:** quick
**Status:** captured

## D2: Component model

**Choice:** Single `<pages-property-palette>` Lit element with internal render methods for groups and fields. No intermediate custom elements.
**Alternatives:**
- Composed web components (`palette → group → field → editor`) — independently testable layers but 4 nested shadow roots for a single text input, duplicates label/error rendering already in `pages-ui-components` elements
- Flat field registry only (no palette component) — maximum flexibility but consumers must handle layout, grouping, and state themselves
**Rationale:** One shadow boundary total. Groups render as `<details>` elements. Fields delegate directly to `pages-ui-components` editor elements (PagesInput, PagesSelect, etc.) which already handle their own label, error, and ARIA. Code stays modular via private render methods (`renderGroup()`, `renderField()`), not element boundaries. Avoids the 4-level shadow DOM nesting problem identified in decision review R1-04.
**Trade-offs:** Internal render methods aren't independently importable as components. But `<pages-property-group>` in isolation has no real use case — it only exists inside the palette.
**Sources:** blocks-ui `diagram-properties.ts`, `property-form.ts`, `nested-group.ts`; pages protocol `web-component-strategy.md`; decision review R1-04
**Exploration:** quick
**Status:** revised (from composed elements, after decision review R1-04)

## D3: Source wiring

**Choice:** Lit `@property({ attribute: false }) source: PropertyPaletteSource | undefined`
**Alternatives:**
- Event-based connect/disconnect — more decoupled but adds ceremony; better if palette is far from selection source in DOM
- Controller pattern (Lit reactive controller) — most flexible but heaviest API
**Rationale:** Simplest API. Lit handles reactivity automatically — when source changes (new selection), palette re-renders. Consumer sets it directly: `palette.source = mySource`. No event wiring, no controller lifecycle.
**Trade-offs:** Palette and source must be in the same JS scope (consumer holds references to both). Not suitable if palette is in an iframe separate from the selection source — but that's not a current requirement.
**Sources:** Issue #373 `PropertyPaletteSource` SPI definition
**Exploration:** quick
**Status:** captured

## D4: Editor scope (initial implementation)

**Choice:** All blocks-ui editors (text, number, checkbox, select, textarea, string-array, nested object, JSON display) PLUS color picker (swatch + hex input), number slider (`x-display-hint: "slider"`), tag/chip editor (array of string with add/remove UI)
**Alternatives:**
- Full set from issue (date, datetime, duration, URI) — larger scope, date picker needs calendar popup which is significant work
- Minimal migration only — doesn't add value beyond code relocation
**Rationale:** Core editors cover the blocks-ui migration. Color picker, slider, and tag editor are the highest-value additions with reasonable implementation cost. Date/datetime/duration/URI are follow-up issues — they're complex (calendar popup, ISO 8601 parsing) and no current consumer needs them immediately.
**Trade-offs:** Deferred editors mean the issue spec isn't 100% implemented. But shipping a working, tested subset is better than a sprawling PR.
**Sources:** Issue #373 editor table, blocks-ui `field-renderer.ts` FieldType enum
**Exploration:** quick
**Status:** captured

## D5: Editor registry

**Choice:** Static resolver function `resolveEditor(schema: FieldSchema): EditorDescriptor` where `EditorDescriptor` can specify either a tag name OR a render function
**Alternatives:**
- Global mutable registry with `register()` — the pattern `pages-form` used before absorption into `pages-viz`. Dynamic but global mutable state, import-order dependencies, harder to test
- Slot-based composition — most flexible for one-off overrides but doesn't scale for systematic type-based customisation
**Rationale:** A pure function maps schema `type` + `format` + `x-display-hint` to an `EditorDescriptor`. Default resolver covers all built-in editors. Consumers provide a custom resolver for domain-specific editors (e.g., blocks-ui's trigger editor). The descriptor can be `{ tag: 'pages-input', config }` for standard editors or `{ render: (field, schema, value, onChange) => TemplateResult }` for inline custom editors. Composable: `(schema) => customResolver(schema) ?? defaultResolver(schema)`.
**Trade-offs:** Adding a new editor type requires a code change to the resolver (not just an import). But for a platform library, explicit > implicit. The dual tag/render descriptor accommodates both component-based and function-based editors without forcing one model.
**Sources:** blocks-ui `fieldTypeFor()` function, `pages-form` `registerFieldRenderer()` (now removed), issue #373 extensibility requirements; decision review R1-03
**Exploration:** quick
**Status:** revised (acknowledged existing registry pattern, added render-function support after R1-03)

## D6: Validation ownership

**Choice:** Shared `validateField()` function extracted into `pages-ui-components`; palette uses it on blur; display-only (not a gate on onChange)
**Alternatives:**
- Palette-owned fourth validator — adds a fourth copy of validation logic alongside pages-viz, blocks-ui, and the old pages-form
- Source-driven validation — more flexible (business rules) but couples palette rendering to async validation responses
**Rationale:** Extract `validateField()` from `pages-viz/schema-types.ts` into `@casehubio/pages-ui-components` as a shared pure utility (new sub-path export `@casehubio/pages-ui-components/validation`). The palette imports it. PagesSchemaForm migrates to import from the same source. Consolidates three duplicate validators into one. JSON Schema constraints (required, min/max, pattern, enum, minLength/maxLength, minItems/maxItems, exclusiveMin/Max) are validated synchronously on blur. Error state is set on the field component. Source's `onChange` fires regardless.
**Trade-offs:** Requires a small refactor of PagesSchemaForm to import from pages-ui-components instead of its local copy. But this is the right dependency direction — pages-viz already depends on pages-ui-components.
**Sources:** blocks-ui `validation.ts`, pages-viz `schema-types.ts validateField()`, issue #373 validation requirements; decision review R1-02
**Exploration:** quick
**Status:** revised (consolidated validation after decision review R1-02)

## D7: Group collapse state persistence

**Choice:** Explicit `paletteId` property on `<pages-property-palette>`; localStorage key: `pages-palette-${paletteId}-${groupName}`
**Alternatives:**
- Derived from schema `title` — fragile; changing the schema title resets all persisted state
- No persistence — simpler but loses user preference across navigations
**Rationale:** Consumer controls the namespace. If `paletteId` is not set, groups default to open and state isn't persisted. Predictable and safe.
**Trade-offs:** Consumer must remember to set the ID. But forgetting just means groups reset on navigation — no data loss.
**Sources:** Issue #373 grouping requirements
**Exploration:** quick
**Status:** captured

## D8: Migration scope

**Choice:** Include blocks-ui migration in this issue — make `diagram-properties.ts` a thin wrapper over `<pages-property-palette>`
**Alternatives:**
- Defer to blocks-ui#136 — cleaner separation but delays real-world API validation
**Rationale:** Migrating blocks-ui's property form validates the API against a real consumer. Ensures the SPI and resolver are actually sufficient before the design solidifies. The trigger editor (`renderTriggerEditor`) is blocks-ui domain-specific and uses a custom resolver.
**Trade-offs:** Cross-repo change, larger PR scope. But blocks-ui's property form is simple (155 lines including all form types) — the migration is mechanical.
**Sources:** blocks-ui `diagram-properties.ts`, `property-form.ts`, issue #373 migration path section
**Exploration:** quick
**Status:** captured
