# formScope — Composable Form Layout

**Issue:** #337 — design: make schema-form composable with standard layout primitives
**Branch:** issue-334-schema-form-dsl
**Date:** 2026-08-26

## Problem

Schema-form renders fields in a single-column vertical list internally. You can't wrap its children in `columns()` / `grid()` because the component generates them. The alternative — individual `textInput()` / `dropdown()` calls with `columns()` — loses schema-form's validation, create mode, and submit wiring.

Adding `columns` / `columnSpan` props to schema-form creates a parallel layout system. The platform has one layout system (`columns()`, `rows()`, `grid()`) — form fields should compose with it like everything else.

## Architecture

Separate form management from field generation. `formScope` is a container component type that provides validation context, value collection, and submit wiring to any children — including standard layout primitives.

### Three Usage Tiers

```typescript
// Tier 1: Simple — existing schemaForm(), unchanged
schemaForm({ schema, validateOnBlur: true })

// Tier 2: Auto-generated fields with custom layout
formScope({ schema, validateOnBlur: true },
  columns([6, 6],
    [schemaFields({ schema, fields: ["name", "grade", "value"] })],
    [schemaFields({ schema, fields: ["active", "startDate", "notes"] })],
  ),
  submitButton({ label: "Create" }),
)

// Tier 3: Individual inputs with custom layout
formScope({ schema, validateOnBlur: true },
  columns([4, 4, 4],
    [textInput({ field: "name" })],
    [numberInput({ field: "value" })],
    [dropdown({ field: "grade", options: {...} })],
  ),
  submitButton({ label: "Submit" }),
)
```

### formScope — Activation-Layer Container

formScope is NOT a web component. It is a container type (`"form-scope"`) whose children are rendered by `renderNode`'s standard slot path. Form management is wired by the activation callback (`onNode`) in `pages-runtime`.

The activation callback adds event listeners on the wrapper `el` (the `div[data-component-type="form-scope"]` created by `renderNode`). This `el` is the DOM ancestor of all children — events from inputs at any slot depth bubble through it.

A web component approach was rejected because `render.ts` places the viz element and slot containers as siblings inside the wrapper div. Events from children in slot containers never traverse the viz element — they share a parent, not an ancestor-descendant relationship. No existing `DATA_COMPONENT_TYPE` has runtime-rendered children.

This follows the precedent of `title`, `html`, and `markdown` types that are handled by the activation callback without creating viz elements.

The activation handler sets `role` on the wrapper `el` for accessibility — formScope is the semantic form boundary in Tiers 2 and 3, matching the `role="form"` that PagesSchemaForm sets on its inner container (PagesSchemaForm.ts:187):

```typescript
el.setAttribute("role", props.mode === "display" ? "group" : "form");
```

Unlike title/html/markdown, formScope dispatches `pages-record-create` — so its activation handler MUST register in the ComponentRegistry with `pagePath`. Without a registry entry, the `pages-record-create` handler in site.ts cannot resolve the dataScope or saveConfig. Registration:

```typescript
registry.set(componentId, {
  element: el, component, pagePath,
  hasExplicitId: component.id !== undefined,
});
```

### schemaFields — fieldsOnly Mode on PagesSchemaForm

`schemaFields()` is a DSL function that produces a `schema-form` component with `fieldsOnly: true`. No separate web component.

PagesSchemaForm gains a `fieldsOnly` prop. When true:
- Generates fields from the schema (existing behavior)
- Skips submit button generation
- Skips internal validation management
- Dispatches `pages-field-register` with `{bubbles: true, composed: true}` for each child element it creates

In `fieldsOnly` mode, PagesSchemaForm delegates validation and submit to its ancestor formScope while retaining its field generation capabilities (schema-to-component mapping, label derivation, schema derivation from dataset).

### schemaForm — Unchanged

`schemaForm(props)` continues to produce a single `schema-form` component — the complete standalone form with built-in validation, create mode, and submit. No indirection through formScope. This serves the simple case where single-column auto-generated forms are sufficient.

## Component Inventory

### New

| What | Package | File |
|------|---------|------|
| `FormScopeProps` type | `pages-component` | `model/form-scope-types.ts` |
| `SubmitButtonProps` type | `pages-component` | `model/submit-button-types.ts` |
| `STANDALONE_TYPES` (exported) | `pages-component` | `model/field-access.ts` |
| `PagesSubmitButton` web component | `pages-ui-components` | `submit-button/pages-submit-button.ts` |
| `"form-scope"` in `ComponentTypeRegistry` | `pages-component` | `model/type-guards.ts` |
| `"submit-button"` in `ComponentTypeRegistry` | `pages-component` | `model/type-guards.ts` |
| `isFormScope` type guard | `pages-component` | `model/type-guards.ts` |
| `isSubmitButton` type guard | `pages-component` | `model/type-guards.ts` |
| `readFieldValue()` + `setFieldError()` | `pages-component` | `model/field-access.ts` |
| `validateField()` (moved from pages-viz) | `pages-component` | `model/field-validation.ts` |
| `formScope()` DSL builder | `pages-ui` | `dsl/builders.ts` |
| `schemaFields()` DSL builder | `pages-ui` | `dsl/builders.ts` |
| `submitButton()` DSL builder | `pages-ui` | `dsl/builders.ts` |
| `FormScopeState` + `FormScopeRegistry` | `pages-runtime` | `form-scope.ts` (new file) |
| `form-scope` activation handler | `pages-runtime` | `activation.ts` |
| `form-scope:` YAML container | `pages-ui` | `component-desugar.ts` |
| `submit-button:` YAML shorthand | `pages-ui` | `component-desugar.ts` |

### Modified

| What | Package | Change |
|------|---------|--------|
| `SchemaFormProps` | `pages-component` | Add `fields?: string[]` — include-filter whitelist |
| `PagesSchemaForm` | `pages-viz` | Add `fieldsOnly` prop — when true, dispatches `pages-field-register` for each child, skips submit/validation. Use shared `readFieldValue()` / `setFieldError()` from pages-component. When `fields` prop is present, render only listed fields in specified order. Import `STANDALONE_TYPES` from pages-component instead of local const. |
| `PagesSchemaForm` (imports) | `pages-viz` | Import `validateField` and `STANDALONE_TYPES` from `pages-component` instead of local definitions |
| `activation.ts` | `pages-runtime` | New handler blocks for `"form-scope"` and `"submit-button"` types (submit-button follows action-button pattern, NOT STANDALONE_FORM_TYPES). Import `STANDALONE_TYPES` from pages-component (replaces local `STANDALONE_FORM_TYPES`). Standalone form input handler dispatches `pages-field-register` after appending input (only when `field` prop is present). |
| `RecordCreateDetail` | `pages-runtime` | Add optional `resolve?: (result: { success: boolean; error?: string }) => void` field |
| `site.ts` | `pages-runtime` | `pages-record-create` handler calls `detail.resolve?.()` on ALL exit paths: 5 early returns, success, failure, and catch (backwards compatible — field is optional) |

### Unchanged

| What | Why |
|------|-----|
| `schemaForm()` builder | Stays as-is — simple path |
| `PagesSchemaForm` (without `fieldsOnly`) | Standalone behavior unchanged |
| `ActionExecutor` | No changes needed |

## Event Flow

### Field Discovery — Dual Path

**Path 1: Standalone inputs (Tier 3).** The activation callback dispatches `pages-field-register` on the input's wrapper `el` after appending the input element. The event bubbles up to formScope's wrapper `el`. The event's `detail.element` is `formEl` (the actual input element), not `el` (the wrapper div) — formScope needs the input element reference for value reading and error setting. This event only dispatches when the input component has a `field` prop; inputs without `field` are decorative and do not participate in form management.

**Path 2: Schema-generated fields (Tier 2).** PagesSchemaForm in `fieldsOnly` mode dispatches `pages-field-register` with `{bubbles: true, composed: true}` for each child element it creates. Events cross the shadow DOM boundary and bubble up to the formScope wrapper.

Both paths result in formScope tracking the field in `FormScopeState`.

### Field Cleanup

Before value collection (submit) and validation (blur), formScope checks `element.isConnected` for each entry in `FormScopeState.fields`. Disconnected entries (from removed fields due to schema changes or conditional visibility) are pruned before processing. This eliminates stale field references, phantom validation errors, and element retention without requiring an explicit unregister event.

### Validation (validateOnBlur)

formScope's `pages-field-change` listener on `el` catches committed field changes. It validates the field value against the schema using `validateField()` (imported from `pages-component`) and sets the error on the source element using `setFieldError()` (imported from `pages-component`).

`validateField()` is a pure function (no DOM or Lit dependencies) that currently lives in `pages-viz/src/form-inputs/schema-types.ts`. It moves to `pages-component/src/model/field-validation.ts` alongside `FieldSchema`. This avoids creating a runtime dependency from `pages-runtime` → `pages-viz` (activation.ts currently only has type-level imports from pages-viz, which are stripped at compile time).

Neither formScope nor `site.ts` uses `stopPropagation`. Both receive the same events at different DOM levels for different purposes — formScope handles schema-driven validation, site.ts handles editState tracking and auto-save.

### Shared Field Access Utilities

Value reading and error setting across heterogeneous field types require type-switching between standalone components (`.value`, `.checked`, `.error`) and PagesFormInput subclasses (`.currentValue`, `.errorMessage`). Two shared utilities in `pages-component/src/model/field-access.ts` eliminate duplication between PagesSchemaForm and formScope:

```typescript
function readFieldValue(element: HTMLElement, componentType: string): unknown {
  if (componentType === "checkbox") return (element as any).checked;
  if (STANDALONE_TYPES.has(componentType)) return (element as any).value;
  return "currentValue" in element ? (element as any).currentValue : (element as any).value;
}

function setFieldError(element: HTMLElement, componentType: string, error: string | undefined): void {
  if (STANDALONE_TYPES.has(componentType)) {
    (element as any).error = error;
  } else if ("errorMessage" in element) {
    (element as any).errorMessage = error;
  } else {
    (element as any).error = error;
  }
}
```

`STANDALONE_TYPES = new Set(["input", "select", "textarea", "checkbox"])` is exported from `pages-component/src/model/field-access.ts` as the canonical definition. This consolidates the triple definition: `STANDALONE_TYPES` in PagesSchemaForm.ts:21 and `STANDALONE_FORM_TYPES` in activation.ts:48 are both replaced by imports from `pages-component`. A single source of truth ensures new standalone types are added once.

Duck-typing (`"currentValue" in element`) provides forward compatibility — new component types implementing `currentValue` work without changes to these utilities.

### Submit

A child element dispatches `pages-form-submit` (bubbles, composed). The primary trigger is `submitButton()` in the DSL tree — a new builder that produces a `TypedComponent<"submit-button">`. The activation handler creates a `PagesSubmitButton` web component (from `pages-ui-components`) and appends it to the wrapper. Any element that dispatches `pages-form-submit` also works.

`actionButton()` is NOT a submit trigger — it dispatches `pages-action-request` for HTTP calls (url, method, body). The two are architecturally distinct: `submitButton` triggers form validation and record creation; `actionButton` triggers external HTTP actions.

```typescript
interface SubmitButtonProps {
  readonly label: string;
  readonly style?: "primary" | "danger" | "secondary" | "ghost" | "outline";
  readonly disabled?: boolean;
}
```

`submit-button` is a Lit web component (`PagesSubmitButton`) in `pages-ui-components`, following the same pattern as `PagesInput`, `PagesSelect`, etc. A plain `<button>` was rejected because submit-button is interactive (loading states, disabled states, style variants with pseudo-classes) — the correct analogy is with form inputs, not with content types like title/html. Shadow DOM provides scoped styling with CSS custom properties matching the design system, and the style variants (`primary`, `danger`, etc.) share the same token vocabulary as `PagesActionButton`.

The activation handler follows the `action-button` pattern (activation.ts:362-367) — a dedicated handler block with bulk `props` assignment:

```typescript
if (component.type === "submit-button" && component.props) {
  const btn = document.createElement("pages-submit-button");
  (btn as any).props = component.props;
  el.appendChild(btn);
  return;
}
```

Submit-button is NOT routed through `STANDALONE_FORM_TYPES`. That path is purpose-built for form inputs — it creates field proxies, injects dataScope, and wires `pages-field-change` events, none of which apply to a submit button. Submit-button has no `.value`, no `.field`, no data pipeline needs. The action-button pattern is the correct match: both are interactive web components with no form-field semantics.

`PagesSubmitButton` dispatches `pages-form-submit` on click with a `resolve` callback in the event detail:

```typescript
this.dispatchEvent(new CustomEvent("pages-form-submit", {
  bubbles: true, composed: true,
  detail: { resolve: (result) => this._handleResult(result) },
}));
```

On dispatch, the button enters a loading state (`_isLoading = true`, spinner, `aria-busy="true"`, click disabled). The `resolve` callback exits loading and optionally shows a brief success/error message — mirroring `PagesActionButton`'s result handling pattern.

`PagesSubmitButton` sets a safety timeout (5000ms) when entering loading state. If no `resolve` call arrives within the timeout, the button auto-resolves with `{ success: false, error: "Form submit timed out" }`. This handles two scenarios: `submitButton()` placed outside any `formScope()` (the `pages-form-submit` event bubbles to the site target with no handler), and edge cases where the event chain breaks mid-flight. The timeout is cleared on successful resolve. `PagesActionButton` has no equivalent timeout because `pages-action-request` is always handled by `actionExecutor.execute()` which guarantees a Promise resolution.

formScope catches `pages-form-submit` on `el`, prunes disconnected fields (§Field Cleanup), validates all registered fields against the schema using `readFieldValue()` and `validateField()`, collects values. If validation fails, formScope calls `detail.resolve({ success: false, error: "Validation failed" })`. If validation passes, formScope dispatches `pages-record-create` with `{record, resolve}`, chaining the submit button's resolve through to the site.ts handler:

```typescript
el.dispatchEvent(new CustomEvent("pages-record-create", {
  bubbles: true, composed: true,
  detail: { record: values, resolve: submitResolve },
}));
```

The runtime's `pages-record-create` handler (site.ts:771) must call `detail.resolve?.()` on EVERY exit path — not just adapter success/failure. The handler has five early returns before reaching `adapter.create()` (missing componentId, missing registry entry, missing dataScope, missing saveConfig, missing adapter). Each must call `detail.resolve?.({ success: false, error: "..." })` before returning. Without this, the submit button enters loading state and never exits.

The complete resolve coverage:
- Early return (no componentId): `detail.resolve?.({ success: false, error: "No component context" })`
- Early return (no registry entry): `detail.resolve?.({ success: false, error: "Component not registered" })`
- Early return (no dataScope): `detail.resolve?.({ success: false, error: "No data scope" })`
- Early return (no saveConfig): `detail.resolve?.({ success: false, error: "No save configuration" })`
- Early return (no adapter.create): `detail.resolve?.({ success: false, error: "No create adapter" })`
- Success: `detail.resolve?.({ success: true })`
- Failure (result.success === false): `detail.resolve?.({ success: false, error: result.error ?? "Create failed" })`
- Catch: `detail.resolve?.({ success: false, error: msg })`

The `?.` operator keeps backwards compatibility — existing callers (standalone PagesSchemaForm) without `resolve` are unaffected. This pattern contrasts with `pages-action-request` (site.ts:844), which has no early returns because `actionExecutor.execute()` always returns a Promise. The `pages-record-create` handler's guard-clause structure requires explicit resolve at each exit point.

When `mode` is `"display"`, formScope does not wire the `pages-form-submit` listener — submit is disabled for read-only forms.

### Nesting Guard

On activation, the handler checks `el.parentElement?.closest('[data-component-type="form-scope"]')`. If found, logs a console error and **returns early** — no event listeners are wired, no ComponentRegistry entry is created. Without the early return, both inner and outer formScopes would catch `pages-field-register` and `pages-form-submit` events, causing double-registration of fields and double-submit. `parentElement?.closest()` avoids self-match since `el` itself has `data-component-type="form-scope"`.

**Unsupported: `schemaForm()` inside `formScope()`.** Only `schemaFields()` (with `fieldsOnly: true`) is valid inside formScope. Standalone `schemaForm()` manages its own validation, submit button, and `pages-record-create` dispatch — overlapping with formScope's responsibilities. Its fields are not registered with formScope (no `pages-field-register` dispatch), creating phantom validation and double-submit. Use `schemaFields()` for formScope composition; `schemaForm()` for standalone forms outside formScope.

## FormScopeProps

```typescript
interface FormScopeProps {
  readonly schema?: FieldSchema;
  readonly validateOnBlur?: boolean;
  readonly mode?: "display" | "edit";
}
```

- `schema` — optional. When absent, formScope provides value collection and submit wiring without validation. This supports Tier 3 usage where the consumer manages their own validation.
- `validateOnBlur` — enables per-field validation on committed changes.
- `mode` — `"display"` produces a read-only form: submit listener is not wired, and formScope does not process `pages-form-submit` events. Defaults to `"edit"`.

`forceCreate` is intentionally absent from FormScopeProps. FormScope always dispatches `pages-record-create` on submit — it has no edit/update path (edits auto-save per-field via `pages-field-change`). Create mode for field rendering is controlled by `forceCreate` on child `schemaFields()` props, not on formScope.

## FormScopeState

```typescript
interface RegisteredField {
  readonly element: HTMLElement;
  readonly field: string;
  readonly componentType: string;
}

interface FormScopeState {
  readonly fields: Map<string, RegisteredField>;
  readonly schema: FieldSchema | undefined;
  readonly validateOnBlur: boolean;
}
```

Stored in a `WeakMap<HTMLElement, FormScopeState>` keyed by the formScope wrapper `el`. WeakMap ensures cleanup when the element is removed from the DOM.

## DSL Builders

```typescript
function formScope(
  props: FormScopeProps,
  ...children: Component[]
): TypedComponent<"form-scope"> {
  return freeze({
    type: "form-scope" as const,
    props: { ...props },
    slots: freeze({ default: Object.freeze(children) }),
  });
}

function schemaFields(
  props: SchemaFieldsProps
): TypedComponent<"schema-form"> {
  return freeze({
    type: "schema-form" as const,
    props: { ...props, fieldsOnly: true },
  });
}

function submitButton(
  props: SubmitButtonProps
): TypedComponent<"submit-button"> {
  return freeze({
    type: "submit-button" as const,
    props: freeze({ ...props }),
  });
}
```

`formScope` converts children to `slots: { default: children }` — the same pattern used by `rows()`, `panel()`, and `stack()`. `renderNode` renders children from `component.slots`, not a top-level children array.

`SchemaFieldsProps` is `Omit<SchemaFormProps, 'validateOnBlur'>` — only excludes validation, which formScope handles. `forceCreate` and `mode` remain available on schemaFields for PagesSchemaForm rendering decisions (empty fields in create mode, disabled fields in display mode). These are rendering concerns of PagesSchemaForm, not behavioral concerns of formScope.

`SchemaFormProps` gains a `fields?: string[]` prop — an include-filter whitelist. When present, only the listed fields are rendered, in the specified order. This replaces the `fieldOrder` + `excludeFields` combination for the common case of "render only these fields." In PagesSchemaForm, when `fields` is present:

```typescript
const visibleFields = props.fields
  ? props.fields.filter(f => f in schemaProps)
  : fieldOrder.filter(f => !excludeSet.has(f) && f in schemaProps);
```

## YAML Representation

```yaml
- form-scope:
    schema:
      properties:
        name: { type: string, minLength: 1 }
        grade: { type: string, enum: [GRADE_1, GRADE_2] }
        value: { type: number }
        active: { type: boolean }
      required: [name, grade]
    validateOnBlur: true
    components:
      - columns:
          widths: [6, 6]
          components:
            - schema-form:
                fieldsOnly: true
                schema:
                  properties:
                    name: { type: string, minLength: 1 }
                    grade: { type: string, enum: [GRADE_1, GRADE_2] }
                  required: [name, grade]
                fields: [name, grade]
            - schema-form:
                fieldsOnly: true
                schema:
                  properties:
                    value: { type: number }
                    active: { type: boolean }
                fields: [value, active]
      - submit-button:
          label: Create
```

## New Events

| Event | Dispatched by | Caught by | Detail |
|-------|--------------|-----------|--------|
| `pages-field-register` | Activation (standalone inputs, when `field` prop present), PagesSchemaForm (fieldsOnly mode) | formScope wrapper `el` | `{ field: string, element: HTMLElement, componentType: string }` |
| `pages-form-submit` | `PagesSubmitButton`, or any child element | formScope wrapper `el` | `{ resolve?: (result: { success: boolean; error?: string }) => void }` |

### Modified Events

| Event | Change |
|-------|--------|
| `pages-record-create` | `RecordCreateDetail` gains optional `resolve?: (result: { success: boolean; error?: string }) => void`. site.ts calls `resolve` on ALL exit paths (5 early returns, success, failure, catch). Backwards compatible — existing callers without `resolve` are unaffected. Follows the `PagesActionRequestDetail.resolve` pattern (action-types.ts:48-51). |

Deliverable: create `docs/protocols/casehub/pages-event-contract.md` documenting all custom DOM events in the pages platform (not just these two). Tracked as GitHub issue #338.

## References

- `PagesSchemaForm.ts` — form management internals (validation, field generation, submit)
- `schema-types.ts` — `validateField()` (moves to `pages-component/src/model/field-validation.ts`)
- `activation.ts` lines 160-232 — standalone form input activation, DATA_COMPONENT_TYPE activation
- `activation.ts` lines 308-395 — title/html/markdown handlers (precedent for activation-only types)
- `activation.ts` lines 362-367 — action-button handler (precedent for submit-button activation: bulk props assignment, no field proxy)
- `render.ts` lines 90-135 — wrapper `el` is ancestor of all children, slot containers appended to `el`
- `site.ts` lines 771-805 — `pages-record-create` handler (gains optional `resolve` callback — requires ComponentRegistry entry with `pagePath`)
- `site.ts` line 283 — `findComponentId()` walks DOM for `[data-component-id]`
- `registry.ts` — `ComponentEntry` requires `pagePath` for dataScope/saveConfig resolution
- `action-types.ts` — ActionButtonProps, ActionRequest, ActionCallbacks (actionButton is HTTP-only, not form submit)
- `PagesFormInput.ts` — `.currentValue` getter, `.errorMessage` property (PagesFormInput subclass API)
- `PagesActionButton.ts` — dispatches `pages-action-request`, NOT `pages-form-submit`. Lit web component with shadow DOM styling, loading spinner, success/error feedback, aria-busy — the styling/interaction pattern `PagesSubmitButton` follows.
- `pages-input.ts` (`pages-ui-components`) — Lit web component precedent: shadow DOM, CSS custom properties, property-based API. `PagesSubmitButton` follows this pattern.
- `action-types.ts` lines 48-51 — `PagesActionRequestDetail.resolve` callback pattern, adopted by `pages-form-submit` and `RecordCreateDetail`
- Issue #337 — design direction ("one layout system")
- Issue #233 — pipeline-external component principle
- Issue #338 — pages-event-contract.md creation (deliverable)
