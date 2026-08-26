## D1: Architecture — formScope wrapper separating form management from field generation

**Choice:** formScope wrapper (Approach A)
**Alternatives:**
- Schema-form with layout callback — cosmetic composability only: the callback executes within PagesSchemaForm's Lit rendering context, not the runtime's standard component rendering pipeline. The standard layout primitives (columns, rows, grid) return Component objects rendered by pages-runtime. PagesSchemaForm lives in pages-viz (no pages-runtime dependency). For the callback to use real layout primitives, PagesSchemaForm would need to either import the runtime's renderer (prohibited dependency direction) or duplicate layout rendering (parallel layout system). Both violate the "one layout system" principle from issue #337.
- Form context via DOM ancestry — conflates page-level and form-level concerns, can't have two forms on one page
**Rationale:** Form management (validation, value collection, submit) is orthogonal to layout and field generation. Separating them gives one layout system for the whole platform — form fields compose with columns(), rows(), grid() like everything else. formScope children are standard runtime components rendered by the standard pipeline, achieving structural composability rather than cosmetic composability.
**Boundary with runtime:** The activation callback adds event listeners to the wrapper `el` (the `div[data-component-type="form-scope"]` created by renderNode). The wrapper `el` IS an ancestor of all formScope children — events from inputs in any slot depth bubble through `el`. Runtime (site.ts) continues to handle `pages-field-change` for editState tracking and auto-save via its own top-level listener (site.ts:512). formScope's listeners on `el` are scoped to the form boundary and handle: field discovery (pages-field-register), schema-driven validation (pages-field-change with validateOnBlur), value collection (reading registered fields), create-mode submission (pages-record-create dispatch). Neither layer uses stopPropagation — both receive the same events at different DOM levels for different purposes.
**Trade-offs:** Two new concepts (form-scope container, fieldsOnly mode on schema-form) instead of extending one. More concepts for simple forms — mitigated by keeping schemaForm() as the simple-case builder.
**Sources:** PagesSchemaForm.ts (form management internals, line 187 validation handler), activation.ts (runtime wiring, lines 204-225 event translation pattern), render.ts (DOM structure — wrapper el is ancestor of all children, lines 90-135), builders.ts (DSL patterns), issue #337 body (design direction — "one layout system"), pages-ui-components spec #233 (pipeline-external component principle)
**Exploration:** quick
**Status:** revised — added explicit boundary definition (R1-03), layout callback rejection (R1-04), corrected event catching mechanism to use wrapper el (R2-01)

## D2: Field discovery — DOM event registration via activation layer, dual-path

**Choice:** DOM event registration — two paths, both using `pages-field-register` events that bubble to the formScope wrapper `el`:
1. **Standalone form inputs** created by the activation layer: activation dispatches `pages-field-register` on the input's wrapper `el` after appending the input element.
2. **Schema-generated fields** created by PagesSchemaForm in `fieldsOnly` mode: PagesSchemaForm dispatches `pages-field-register` with `{bubbles: true, composed: true}` for each child it creates. Events cross the shadow DOM boundary and bubble up to the formScope wrapper.

The formScope activation callback adds a `pages-field-register` listener on the formScope wrapper `el`. Since `el` is the DOM ancestor of all children (slot containers are children of `el`, per render.ts:120), events from both paths reach it.
**Depends on:** D1 (formScope wrapper), D7 (container-style formScope)
**Alternatives:**
- Components self-dispatch pages-field-register — violates the pipeline-external principle from #233 for standalone components. PagesSchemaForm dispatching is acceptable because it IS a pipeline component (extends PagesElement), not a standalone component.
- Schema-driven DOM query — couples discovery to DOM structure and timing
- Explicit field list prop — duplicates information already in the schema
- Listener on viz element — impossible. render.ts places the viz element and slot containers as siblings inside the wrapper div (activation.ts:285 `el.appendChild(vizEl)`, then render.ts:120 `el.appendChild(slotContainer)`). Events from children in slot containers never traverse the viz element.
**Rationale:** Event bubbling through the wrapper `el` works regardless of DOM depth or layout wrappers. The dual-path design handles both activation-created fields (standalone inputs) and component-created fields (PagesSchemaForm in fieldsOnly mode) through the same discovery protocol.
**Trade-offs:** PagesSchemaForm in fieldsOnly mode must know about the `pages-field-register` protocol. This is acceptable — PagesSchemaForm already knows about pipeline events (pages-field-change via children, pages-record-create, pages-data-request). Adding pages-field-register is natural for a pipeline component cooperating with formScope.
**Sources:** activation.ts lines 204-225 (event dispatch on behalf of standalone inputs), activation.ts:285 (vizEl appended as child of wrapper el — sibling of slots), render.ts:90-120 (wrapper el is ancestor, slot containers appended to el), PagesSchemaForm.ts lines 118-166 (child element creation in renderContent)
**Exploration:** quick
**Status:** revised — moved dispatch to activation layer (R1-02), added dual-path for schema-generated fields (R2-02), corrected event bubbling target from viz element to wrapper el (R2-01)

## D3: schemaFields — DSL function producing PagesSchemaForm in fieldsOnly mode

**Choice:** A `schemaFields()` DSL function that produces a `schema-form` component with `fieldsOnly: true`. PagesSchemaForm gains a `fieldsOnly` prop: when true, it generates fields from the schema but delegates validation, value collection, and submit to its ancestor formScope. In `fieldsOnly` mode, PagesSchemaForm dispatches `pages-field-register` (with `composed: true`) for each child element it creates, enabling formScope field discovery across the shadow DOM boundary. No separate `pages-schema-fields` web component.
**Depends on:** D1 (formScope wrapper), D2 (DOM event registration — dual-path)
**Alternatives:**
- Separate `pages-schema-fields` web component — duplicates PagesSchemaForm's field generation logic. The difference (managed vs unmanaged) is a mode, not a distinct component.
- DSL expansion only — can't derive schema from data at runtime, doesn't work in YAML
- Per-field `schemaField()` function — marginal value over individual DSL builders. Dropped.
**Rationale:** PagesSchemaForm already generates fields from schemas. In fieldsOnly mode, it skips its own form management (validation, submit, create mode) since formScope provides those. This is a clean extension — analogous to the existing `mode: 'display'` which disables editing. The `pages-field-register` dispatch in fieldsOnly mode closes the composition gap: PagesSchemaForm creates children outside the activation pipeline (via `document.createElement()` in its shadow DOM), so activation can't dispatch registration events for them. PagesSchemaForm itself dispatches them instead — natural for a pipeline component.
**Trade-offs:** PagesSchemaForm gains awareness of formScope's registration protocol in fieldsOnly mode. Explicitly gated by the `fieldsOnly` prop — standalone PagesSchemaForm (without fieldsOnly) is unchanged.
**Sources:** PagesSchemaForm.ts (field generation in renderContent, lines 100-192), PagesSchemaForm.ts mode prop (line 112 — existing modal behavior precedent)
**Exploration:** quick
**Status:** revised — dropped separate web component (R1-05), added pages-field-register dispatch in fieldsOnly mode (R2-02)

## D4: schemaForm() remains the existing standalone builder

**Choice:** schemaForm(props) continues to produce a single `schema-form` component — the complete standalone form with built-in validation, create mode, and submit. No sugar over formScope + schemaFields needed.
**Depends on:** D1 (formScope wrapper), D3 (schemaFields)
**Alternatives:**
- schemaForm() internally expands to formScope + schema-form(fieldsOnly) — adds activation complexity for no user-visible benefit. Callers of schemaForm() want the simple self-contained form; callers who want composability use formScope directly.
- Remove schemaForm() entirely — forces migration of all existing callers
**Rationale:** schemaForm() serves the simple case: auto-generated single-column form from schema. formScope + schemaFields() serves the complex case: custom layout with mixed fields. Two paths for two complexity levels, no unnecessary indirection in the simple path.
**Trade-offs:** Two ways to get schema-driven forms. Clear use-case separation (simple vs composed) prevents confusion.
**Sources:** builders.ts line 501 (existing schemaForm builder), issue #334 (schemaForm DSL builder), issue #337 (composable layout)
**Exploration:** quick
**Status:** revised — simplified from "sugar over formScope + schemaFields" to "keep existing builder unchanged" (R1-06)

## D5: Form nesting — not supported, checked error

**Choice:** Nested formScopes are not supported. The activation callback checks for an ancestor `[data-component-type="form-scope"]` via `el.parentElement?.closest('[data-component-type="form-scope"]')` and logs a console error if found. Note: `parentElement?.closest()` is used instead of `el.closest()` because `el` itself has `data-component-type="form-scope"` — `closest()` matches the element it's called on, so without `parentElement` the check would always match self.
**Surfaced by:** R1-07
**Depends on:** D1 (formScope wrapper), D7 (container-style — no web component)
**Alternatives:**
- Support nesting with event scoping — each formScope stopPropagation on pages-field-register. However, pages-field-change must NOT be stopped (site.ts needs it). Asymmetry between registration (scoped) and change tracking (unscoped) would be confusing.
- Support nesting with explicit field assignment — overcomplicated for a use case with no demonstrated need.
**Rationale:** No current use case requires nested forms. A nested form within a form is an anti-pattern in standard HTML. The check-and-warn approach prevents silent misuse. `el.parentElement?.closest()` is the check mechanism since formScope is a container type (no web component / connectedCallback).
**Trade-offs:** Forms cannot be composed inside other forms. Workaround: separate pages for nested data entry (master-detail via hierarchical filter propagation).
**Sources:** native-forms spec §Nested Forms (master-detail via hierarchical filter propagation, not nested forms)
**Exploration:** new (surfaced by reviewer)
**Status:** revised — nesting check uses DOM query instead of connectedCallback (R2-01 removed web component)

## D6: YAML representation — form-scope container type

**Choice:** formScope is represented in YAML as a `form-scope:` container type with child `components:`, following the same container pattern as pages and tabs.
**Surfaced by:** R1-08
**Depends on:** D1 (formScope wrapper)
**Alternatives:**
- No YAML support (DSL-only) — inconsistent with the "YAML and TS parity" principle from the native-forms spec.
- Implicit form-scope (any page with dataScope becomes a formScope) — conflates page-level and form-level concerns.
**Rationale:** YAML is a first-class authoring surface. The container pattern is established. formScope follows the same structure.
**YAML syntax:**
```yaml
- form-scope:
    schema:
      properties: { ... }
      required: [ ... ]
    validateOnBlur: true
    components:
      - columns:
          widths: [4, 4, 4]
          components:
            - input: { field: testName }
            - input: { field: value }
            - input: { field: unit }
```
**Trade-offs:** Parser and component-desugar.ts need updates for the new container type. Follows established patterns — bounded work.
**Sources:** native-forms spec §Design Principles ("YAML and TS parity"), component-desugar.ts (existing shorthand patterns)
**Exploration:** new (surfaced by reviewer)
**Status:** captured

## D7: formScope is a container type managed by the activation layer — no web component

**Choice:** formScope is NOT a web component, NOT a DATA_COMPONENT_TYPE, NOT a PagesElement. It is a container type (`"form-scope"`) whose children are rendered by renderNode's standard slot path. Form management is wired by the activation callback (onNode) in pages-runtime.
**Surfaced by:** R1-09, revised from R2-01
**Depends on:** D1 (formScope wrapper)
**Alternatives:**
- PagesElement web component in pages-viz (original D7) — impossible. render.ts places the viz element and slot containers as siblings inside the wrapper div (activation.ts:285, render.ts:120). The viz element cannot catch events from children in slot containers because they share a parent, not an ancestor-descendant relationship. No existing DATA_COMPONENT_TYPE has runtime-rendered children — all are leaf components.
- pages-component container with wireFormScope (like wireInteractivity) — form management logic (validation, field tracking, submit) is runtime behavior, not rendering behavior. wireInteractivity handles DOM interactivity (tab switching, sidebar toggling). wireFormScope would handle data-aware logic — wrong package.
- DOM restructuring (move children inside viz element) — fragile, breaks rendering model assumptions.
**Rationale:** The rendering pipeline (render.ts) already handles formScope correctly without changes: renderNode creates a wrapper `el`, fires onNode, then renders children into slot containers inside `el`. The wrapper `el` is the DOM ancestor of all children. The activation callback adds event listeners on `el` for field discovery and validation. No viz element needed — schema comes from component props (YAML/DSL), not from the pipeline. This follows the precedent of other activation-handled types (title, html, markdown) that don't create viz elements.
**Activation callback behavior for `form-scope`:**
1. Check for nesting: `el.parentElement?.closest('[data-component-type="form-scope"]')` → error if found (D5)
2. Extract schema from `component.props.schema`
3. Add `pages-field-register` listener on `el` → track registered fields in a `FormScopeState` (stored in a `FormScopeRegistry` WeakMap keyed by `el`)
4. Add `pages-field-change` listener on `el` → validate against schema if `validateOnBlur`
5. Add `pages-form-submit` listener on `el` → validate all fields, collect values, dispatch `pages-record-create` if valid (create-mode submit trigger — see below)
6. Return (no viz element created) — renderNode continues to render children into slot containers
**Create-mode submit trigger:** A button inside formScope dispatches `pages-form-submit` (bubbles, composed). The formScope listener on `el` catches it, validates all registered fields against the schema, collects values, and dispatches `pages-record-create` with `{record: {...}}` if validation passes. The button can be an `actionButton()` in the DSL tree or any element that dispatches `pages-form-submit`. This is analogous to PagesSchemaForm's internal submit button (PagesSchemaForm.ts:295) but externalized — the button is a regular child component, not generated by formScope.
**Event contract:** `pages-field-register` and `pages-form-submit` must be added to the reserved events table in `docs/protocols/casehub/pages-event-contract.md` during implementation.
**Package placement:** All form management logic lives in pages-runtime (activation callback + FormScopeState + FormScopeRegistry). No pages-viz involvement. No pages-component changes. Validation logic (validateField) is importable from pages-viz where it already exists.
**Sources:** render.ts:90-135 (wrapper el is ancestor, onNode fires before children, slot containers appended to el), activation.ts:285 (viz element is sibling of slot containers — not ancestor), activation.ts title/html/markdown handlers (precedent for activation-only types without viz elements)
**Exploration:** new (surfaced by reviewer), revised from R2-01
**Status:** revised — changed from PagesElement web component to activation-layer container type (R2-01)
