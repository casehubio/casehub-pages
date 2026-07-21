# Schema Form Runtime Integration — Design Spec

**Issue:** #159
**Date:** 2026-07-21
**Follow-up:** #222 (nested object/array schema support)

## Problem

`pages-schema-form` exists as a standalone Lit component in the `pages-form` package. It renders form fields from a JSON Schema but is completely disconnected from the runtime pipeline — different event names, no data binding, not registered in the component type system, and a parallel rendering stack that duplicates what the existing form input components already do.

The DSL form inputs (`text-input`, `dropdown`, etc.) work end-to-end through the pipeline. The schema form does not.

## Design Decisions

1. **PagesSchemaForm extends PagesElement** — first-class data-bound component, same as charts and tables
2. **Delegates rendering to existing PagesFormInput subclasses** — no parallel rendering stack; one set of form input components serves both DSL and schema-driven paths
3. **Schema sourcing: auto-derive + explicit override** — auto-derives schema from TypedDataSet columns by default; explicit JSON Schema in YAML props overrides
4. **Submit mode: context-dependent** — edit mode when a record is selected (auto-save via editState/flushSave); create mode when no record is selected (submit emits pages-record-create)
5. **Package consolidation** — pages-form package removed; PagesSchemaForm moves into pages-viz alongside the other form input components
6. **Flat fields only** — nested object/array schemas deferred to #222; TypedDataSet is flat, so pipeline-bound forms are flat

## Component Architecture

`PagesSchemaForm` extends `PagesElement<SchemaFormProps>` and lives in `pages-viz/src/form-inputs/PagesSchemaForm.ts`.

```
PagesElement<SchemaFormProps>
  └── PagesSchemaForm
        ├── creates pages-text-input, pages-number-input, pages-dropdown,
        │   pages-checkbox, pages-date-picker, pages-textarea as children
        ├── maps JSON Schema fields → component types
        ├── sets props + dataSet + editable on each child
        └── children emit pages-field-change (bubble to runtime)
```

### Props

```typescript
interface SchemaFormProps {
  schema?: FieldSchema;            // explicit JSON Schema (optional — auto-derived if absent)
  mode?: 'display' | 'edit';       // rendering mode (default: derived from editable)
  forceCreate?: boolean;           // forces create mode regardless of dataset row count (default: false)
  validateOnBlur?: boolean;        // validate field on blur (default: false)
  excludeFields?: string[];        // fields to hide (e.g., id column)
  fieldOrder?: string[];           // explicit ordering (default: schema/column order)
  labels?: Record<string, string>; // override auto-generated labels
}
```

`mode` and `forceCreate` are orthogonal:
- `mode` controls rendering: `'display'` (read-only) vs `'edit'` (interactive). Default: derived from `editable` flag.
- `forceCreate` controls submit behavior: when `true`, the form enters create mode (empty fields, explicit submit) regardless of dataset row count. Default: auto-detected — `true` when dataset has 0 rows, `false` otherwise.

### Data Flow

1. Runtime activates `pages-schema-form` like any data component — creates element, injects lookup from `dataScope`, sets `editable` from save config
2. Pipeline delivers `TypedDataSet` to the component
3. Component derives schema from dataset columns (or uses explicit schema from props)
4. For each field, creates the appropriate `pages-<type>` child element
5. Sets child `props = {field, label, ...}` (no lookup), `dataSet` (parent's dataset), `editable`
6. Children render and emit `pages-field-change` on user input — events bubble to runtime

Children do not fire `pages-data-request` because they have no lookup. The parent is the sole pipeline participant; children are renderers only.

### Schema-to-Component Mapping

Two type systems map to components through two distinct paths:

**Auto-derive path** — input is TypedDataSet columns, column type determines component:

| ColumnType | Component | Notes |
|---|---|---|
| `TEXT` | `pages-text-input` | Default for text columns |
| `NUMBER` | `pages-number-input` | |
| `LABEL` | `pages-dropdown` | Options from distinct column values (see below) |
| `DATE` | `pages-date-picker` | |

**Explicit schema path** — input is JSON Schema, type+format determines component:

| JSON Schema type + format | Component | Notes |
|---|---|---|
| `string` (no format) | `pages-text-input` | Default for strings |
| `string` with `enum` | `pages-dropdown` | Options from enum values |
| `string` with `format: date` | `pages-date-picker` | |
| `string` with `format: datetime-local` | `pages-date-picker` | With datetime mode |
| `string` with `format: textarea` | `pages-textarea` | |
| `number` | `pages-number-input` | `min`/`max` from `minimum`/`maximum` |
| `integer` | `pages-number-input` | With `step: 1` constraint |
| `boolean` | `pages-checkbox` | |

**Fallback:** unmapped types render as `pages-text-input` (treating the value as text). This is safe because text-input handles any stringifiable value.

**LABEL column dropdown options:** when the auto-derive path maps a LABEL column to `pages-dropdown`, distinct values are extracted from the **current dataset delivery** and passed as `options` to the child dropdown. Values are cached per column to avoid recomputation on re-render.

**Limitation:** the component receives the pipeline-filtered dataset. When record selection is active, the delivered dataset has 1 row — the dropdown shows only the current record's value. This is functional for editing (the selected value is present) but doesn't show all valid options. For full enum options with record selection, use an explicit schema with `enum` values instead of auto-derive. A future enhancement (#159 follow-up) could pass distinct values from the activation layer, which has access to the DataSetManager's unfiltered data.

## Runtime Integration

### Registration

Add `"schema-form"` directly to `DATA_COMPONENT_TYPES` in `activation.ts` — **not** to `FORM_INPUT_TYPES`. Schema-form is a container that manages child form inputs, not a leaf input itself. The `FORM_INPUT_TYPES` activation path injects implicit lookup from `dataScope` and overwrites any explicit lookup from YAML props — schema-form needs to support both explicit lookup (standalone use) and implicit lookup (within a data-scoped page).

Two changes are required:

**1. Dedicated activation branch** — add after the `isFormInput` block to compute lookup and set editable:

```typescript
if (component.type === "schema-form" && options) {
  const pageDataScope = options.dataScopeRegistry.get(pagePath);
  if (pageDataScope && !lookup) {
    lookup = { dataSetId: pageDataScope.dataset, operations: [] };
  }
  const hasSave = pageDataScope
    ? options.saveConfigRegistry.has(pagePath)
    : false;
  (vizEl as unknown as { editable: boolean }).editable = hasSave;
}
```

This branch only computes the `lookup` variable and sets `editable`. It does NOT set `vizEl.props` — that is handled by the generic code below.

**2. Modify the generic props-setting code** (existing lines 156-161) to include schema-form alongside form inputs:

```typescript
if ((isFormInput || component.type === "schema-form") && lookup) {
  vizEl.props = { ...component.props, lookup };
} else if (component.props) {
  vizEl.props = component.props;
}
```

This eliminates the double-write that occurred in the previous revision: the schema-form branch was setting `vizEl.props` with the merged lookup, but the generic code ran afterward and overwrote it with `component.props` (without lookup). By extending the generic condition to include schema-form, the lookup merge happens at the single correct location — after all activation branches have computed their `lookup` values.

This preserves explicit `lookup:` from YAML props while falling back to dataScope's implicit lookup when no explicit lookup is provided. The `editable` flag is set from save config when within a data-scoped page.

Also add `"schema-form"` to `DATA_COMPONENT_TYPES` and the shorthand handler in `component-desugar.ts` (pages-ui parser), following the same pattern as the existing form input shorthands.

### Event Conformance

No new events. No changes to `site.ts`.

| Event | Who emits | Runtime handler | Already exists? |
|---|---|---|---|
| `pages-field-change` | Child form inputs | `site.ts` → `updateEditState` → auto-save | Yes |
| `pages-record-create` | `PagesSchemaForm` (create mode submit) | `site.ts` → `adapter.create()` → refresh | Yes |
| `pages-data-request` | `PagesElement` connectedCallback | `site.ts` → pipeline | Yes |

### Save Pipeline

**Edit mode** (dataset has 1+ rows): each child's `pages-field-change` → `updateEditState()` per field → auto-save via `flushSave()` on timer. Identical to DSL inputs. No changes.

When the dataset has multiple rows (no record selection filter active), the form displays `dataset.rows[0]` — the first row. The expected usage pattern is: table shows all rows → user clicks a row → `pages-filter` applies record selection → filtered dataset has exactly 1 row → form shows that row. Schema-form without record selection is valid but shows only the first row; the spec recommends always using `dataScope` with `idColumn` for schema-form pages.

**Create mode** (dataset has 0 total rows): `PagesSchemaForm` detects create mode when `this.dataSet` is undefined or has zero rows. It renders empty fields from the schema. A submit button is rendered automatically in create mode (slotted or default).

On submit, `PagesSchemaForm` reads each child's current value via `child.currentValue` (see below), collects them into a record, and emits `pages-record-create` with `{record: {...}}`. The existing handler in `site.ts` calls `adapter.create()` and refreshes the dataset. After refresh, the dataset has 1+ rows, and the form switches to edit mode.

**Explicit create override:** `PagesSchemaForm` accepts `forceCreate?: boolean` (from SchemaFormProps). When `true`, the form enters create mode regardless of dataset row count — empty fields, explicit submit. This supports the "New record" workflow: a host panel or action button sets `forceCreate: true` to clear the form and enable submission, even when the dataset has existing rows. Setting `forceCreate: false` (or omitting it) restores auto-detection.

### currentValue getter on PagesFormInput

Add an abstract `get currentValue(): unknown` getter to `PagesFormInput`. Each subclass implements it to return the current input value from its shadow DOM:

- `PagesTextInput`: `this.shadowRoot?.querySelector('input')?.value ?? ''`
- `PagesNumberInput`: `Number(this.shadowRoot?.querySelector('input')?.value)`
- `PagesCheckbox`: `this.shadowRoot?.querySelector('input')?.checked ?? false`
- `PagesDropdown`: selected option value from the `<select>` element
- `PagesDatePicker`: `this.shadowRoot?.querySelector('input')?.value ?? ''`
- `PagesTextarea`: `this.shadowRoot?.querySelector('textarea')?.value ?? ''`

This is a clean API extension on the base class that avoids DOM traversal from the parent. It benefits both the schema-form create mode and any future feature that needs to read a form input's current value without a populated dataset.

### YAML DSL

```yaml
# Minimal — auto-derive schema from dataset columns
- schema-form:
    lookup:
      uuid: devs

# Explicit schema with constraints
- schema-form:
    schema:
      properties:
        name: { type: string, minLength: 1 }
        language: { type: string, enum: [Java, TypeScript, Python] }
      required: [name]
    lookup:
      uuid: devs

# With field customization
- schema-form:
    excludeFields: [id]
    fieldOrder: [name, language, workingYears]
    labels:
      workingYears: Years of Experience
    lookup:
      uuid: devs
```

## Package Changes

### pages-form removal

The `pages-form` package is deleted. All contents absorbed or replaced:

| File | Disposition |
|---|---|
| `pages-schema-form.ts` | Rewritten in `pages-viz/src/form-inputs/PagesSchemaForm.ts` |
| `field-renderers.ts` | Deleted — delegation replaces rendering |
| `validation.ts` | Logic moves into `PagesSchemaForm` — schema-form owns all validation (see §Validation below) |
| `field-registry.ts` | Deleted — custom renderers deferred to #222 |
| `types.ts` | `FieldSchema` type moves to `pages-viz/src/form-inputs/schema-types.ts` |
| `index.ts` | Deleted |
| Test suite | Rewritten for new architecture |
| `package.json`, configs | Deleted |

### Monorepo cleanup

- Remove `@casehubio/pages-form` from root workspaces
- Remove cross-package references
- Remove from build script ordering
- Update `tsconfig.json` project references
- Add `@casehubio/pages-primitives` to `pages-viz` dependencies (`package.json`) — required for `LiveRegionMixin` import
- Update **ARC42STORIES.MD §5**: remove `<pages-schema-form>` from the `@casehubio/pages-primitives` "Future" list. Schema-form lives in `pages-viz/src/form-inputs/` alongside the other form input components, not in pages-primitives.

### New files

**pages-viz:**
- `src/form-inputs/PagesSchemaForm.ts` — the rewritten component
- `src/form-inputs/schema-types.ts` — `FieldSchema` type and schema-to-component mapping
- `src/form-inputs/schema-form.test.ts` — unit tests
- Export `PagesSchemaForm` and `FieldSchema` from public API

**pages-runtime:**
- `src/form-schema-integration.test.ts` — end-to-end pipeline tests

## Testing

### Unit tests (pages-viz)

- Schema-to-component mapping for all column types
- Auto-derive schema from TypedDataSet columns
- Explicit schema overrides auto-derived schema
- `excludeFields` hides specified fields
- `fieldOrder` controls rendering order
- `labels` override auto-generated labels
- Display mode renders children as read-only
- Edit mode sets `editable` on children
- Create mode detection: zero rows → empty fields, submit emits `pages-record-create`
- Edit mode detection: one row → fields populated, changes emit `pages-field-change`
- Form-level required validation — submit blocked when required fields empty
- `LiveRegionMixin` announces validation errors

### Integration tests (pages-runtime)

- YAML with `schema-form:` + `dataScope` + `save` → component activated, data flows, fields render
- Auto-derived schema from dataset: correct field types created
- Explicit schema in YAML props: constraints applied
- Field change → `editState` updated → auto-save triggered
- Record selection (filter event) → form updates to selected record
- Record navigation → form updates
- Create mode: submit → `adapter.create()` → dataset refreshed
- Schema-form and DSL form inputs on same page don't interfere
- Schema-form works inside tabs, split panels

### Example validation

- Schema Form example: all three tabs render, schema tab uses real `pages-schema-form`
- Developer Registration example: revised to showcase schema-form capabilities

## Validation

`PagesSchemaForm` owns all validation — children are pure renderers with no validation logic. The `validateField()` logic from the deleted `pages-form/validation.ts` moves into `PagesSchemaForm`:

- **Required:** empty/null/undefined on required fields → error
- **Pattern:** regex constraint on string fields
- **minLength/maxLength:** string length bounds
- **minimum/maximum:** numeric range bounds

Validation runs:
1. **On blur** (when `validateOnBlur` is true): validates the changed field, sets error state on the child
2. **On submit** (create mode): validates all fields, blocks submission if any fail

`PagesSchemaForm` sets ARIA and error state on children via new properties on `PagesFormInput`:
- `errorMessage: string | undefined` — renders inline error text and sets `aria-invalid="true"` on the input
- `required: boolean` — sets `aria-required="true"` on the input
- `describedBy: string | undefined` — sets `aria-describedby` linking the input to error/description elements

These properties are set by the parent (`PagesSchemaForm`) on each child after validation runs. When used as standalone DSL inputs (without schema-form), these properties default to values from the component's own `props` (e.g., `props.required`).

## A11y

`PagesSchemaForm` adds `LiveRegionMixin` (from `@casehubio/pages-primitives`) for form-level announcements:
- Validation error summary when create-mode submit fails
- Success/failure announcements for submit results

## Examples

### Schema Form.dash.yaml

Replace the `<schema-form-demo>` placeholder (currently a `type: html` block with `content: <schema-form-demo></schema-form-demo>`) in the Schema tab with a real `schema-form:` DSL component:

```yaml
Schema:
  components:
    - schema-form:
        schema:
          properties:
            transactionId: { type: string, minLength: 1 }
            amount: { type: number, minimum: 0 }
            currency: { type: string, enum: [USD, EUR, GBP] }
            flagged: { type: boolean }
            reportDate: { type: string, format: date }
            notes: { type: string, format: textarea }
          required: [transactionId, amount]
        excludeFields: [id]
```

### Schema Form.ts

Rewrite entirely. The existing file imports `PagesSchemaForm` from `@casehubio/pages-form` and uses `registerFieldRenderer` — both are deleted. The new file:
1. Imports `PagesSchemaForm` from `@casehubio/pages-viz` (new location)
2. Removes `registerFieldRenderer` usage (custom renderers deferred to #222)
3. Demonstrates the new API: creating a schema-form element, setting props, listening for `pages-field-change` and `pages-record-create` events

### Other examples

- **Developer Registration.dash.yaml** — add schema-form variant alongside DSL inputs; demonstrate record selection → schema-form edit → auto-save → chart updates
- **Contact Manager.dash.yaml** — update to include schema-form usage if applicable

## Protocol Compliance

- **pages-event-contract:** eliminates `pages-form-change` (wrong name); uses `pages-field-change` (correct reserved event) via child components; create-mode submit uses `pages-record-create` (correct reserved event)
- **web-component-strategy:** extends PagesElement (correct base class for data-bound components); Lit conventions followed
- **dataset-contract:** schema-form consumes datasets via standard lookup binding
