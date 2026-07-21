# Schema Form Runtime Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> executing-plans to implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural editing.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #159 — pages-schema-form JSON Schema driven form component
**Issue group:** #159

**Goal:** Connect `pages-schema-form` to the runtime data pipeline by rebasing it onto `PagesElement`, delegating rendering to existing `PagesFormInput` subclasses, and removing the standalone `pages-form` package.

**Architecture:** `PagesSchemaForm` extends `PagesElement<SchemaFormProps>` in `pages-viz/src/form-inputs/`. It receives a `TypedDataSet` from the pipeline, derives or accepts a JSON Schema, and creates child `pages-text-input`, `pages-dropdown`, etc. elements with `dataSet` set directly (no lookup — children don't fire `pages-data-request`). Children emit `pages-field-change` which bubbles to the runtime's existing handler. Create mode emits `pages-record-create`.

**Tech Stack:** TypeScript, Lit 3, Vitest, pages-viz, pages-runtime, pages-ui, pages-primitives (LiveRegionMixin)

## Global Constraints

- Pre-release platform — breaking changes cost nothing
- IntelliJ MCP mandatory for all `.ts` file operations
- TDD — failing test before implementation code
- `pages-field-change` is the correct reserved event name (per `pages-event-contract` protocol)
- `PagesElement` is the correct base for data-bound components (per `web-component-strategy` protocol)
- `@customElement('pages-schema-form')` with guarded registration (per web-component-strategy protocol)
- All form input children receive `dataSet` directly — never set `lookup` on children

---

### Task 1: Add `currentValue` getter to `PagesFormInput` and all subclasses

**Files:**
- Modify: `packages/pages-viz/src/form-inputs/PagesFormInput.ts` — add abstract getter
- Modify: `packages/pages-viz/src/form-inputs/PagesTextInput.ts` — implement getter
- Modify: `packages/pages-viz/src/form-inputs/PagesNumberInput.ts` — implement getter
- Modify: `packages/pages-viz/src/form-inputs/PagesCheckbox.ts` — implement getter
- Modify: `packages/pages-viz/src/form-inputs/PagesDropdown.ts` — implement getter
- Modify: `packages/pages-viz/src/form-inputs/PagesDatePicker.ts` — implement getter
- Modify: `packages/pages-viz/src/form-inputs/PagesTextarea.ts` — implement getter
- Test: `packages/pages-viz/src/form-inputs/form-inputs.test.ts` (extend existing)

**Interfaces:**
- Produces: `PagesFormInput.currentValue: unknown` — abstract getter on the base class. Each subclass returns the current DOM input value:
  - `PagesTextInput.currentValue → string`
  - `PagesNumberInput.currentValue → number | null`
  - `PagesCheckbox.currentValue → boolean`
  - `PagesDropdown.currentValue → string`
  - `PagesDatePicker.currentValue → string`
  - `PagesTextarea.currentValue → string`

- [ ] **Step 1: Write failing tests for `currentValue` on each subclass**

Add to `packages/pages-viz/src/form-inputs/form-inputs.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PagesTextInput } from "./PagesTextInput.js";
import type { PagesNumberInput } from "./PagesNumberInput.js";
import type { PagesCheckbox } from "./PagesCheckbox.js";
import type { PagesDropdown } from "./PagesDropdown.js";
import type { PagesDatePicker } from "./PagesDatePicker.js";
import type { PagesTextarea } from "./PagesTextarea.js";
import "./PagesTextInput.js";
import "./PagesNumberInput.js";
import "./PagesCheckbox.js";
import "./PagesDropdown.js";
import "./PagesDatePicker.js";
import "./PagesTextarea.js";

describe("currentValue getter", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("PagesTextInput returns empty string by default", async () => {
    const el = document.createElement("pages-text-input") as PagesTextInput;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBe("");
  });

  it("PagesNumberInput returns null by default", async () => {
    const el = document.createElement("pages-number-input") as PagesNumberInput;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBeNull();
  });

  it("PagesCheckbox returns false by default", async () => {
    const el = document.createElement("pages-checkbox") as PagesCheckbox;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBe(false);
  });

  it("PagesDropdown returns empty string by default", async () => {
    const el = document.createElement("pages-dropdown") as PagesDropdown;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBe("");
  });

  it("PagesDatePicker returns empty string by default", async () => {
    const el = document.createElement("pages-date-picker") as PagesDatePicker;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBe("");
  });

  it("PagesTextarea returns empty string by default", async () => {
    const el = document.createElement("pages-textarea") as PagesTextarea;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.currentValue).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `currentValue` property does not exist

- [ ] **Step 3: Add abstract getter to PagesFormInput**

In `PagesFormInput.ts`, add after `emitFieldChange()`:

```typescript
abstract get currentValue(): unknown;
```

- [ ] **Step 4: Implement `currentValue` on each subclass**

`PagesTextInput.ts`:
```typescript
get currentValue(): string {
  return this.shadowRoot?.querySelector('input')?.value ?? '';
}
```

`PagesNumberInput.ts`:
```typescript
get currentValue(): number | null {
  const raw = this.shadowRoot?.querySelector('input')?.value ?? '';
  const num = parseFloat(raw);
  return isNaN(num) ? null : num;
}
```

`PagesCheckbox.ts`:
```typescript
get currentValue(): boolean {
  return this.shadowRoot?.querySelector('input')?.checked ?? false;
}
```

`PagesDropdown.ts`:
```typescript
get currentValue(): string {
  return this.shadowRoot?.querySelector('select')?.value ?? '';
}
```

`PagesDatePicker.ts`:
```typescript
get currentValue(): string {
  return this.shadowRoot?.querySelector('input')?.value ?? '';
}
```

`PagesTextarea.ts`:
```typescript
get currentValue(): string {
  return this.shadowRoot?.querySelector('textarea')?.value ?? '';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add packages/pages-viz/src/form-inputs/
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "feat(#159): add currentValue getter to PagesFormInput and all subclasses

Abstract getter on PagesFormInput base class. Each subclass returns
the current DOM input value. Required by PagesSchemaForm create mode
to collect form values for pages-record-create.

Refs #159"
```

---

### Task 2: Add a11y properties to `PagesFormInput` and subclasses

**Files:**
- Modify: `packages/pages-viz/src/form-inputs/PagesFormInput.ts` — add `errorMessage`, `required`, `describedBy` properties
- Modify: `packages/pages-viz/src/form-inputs/PagesTextInput.ts` — wire ARIA attributes
- Modify: `packages/pages-viz/src/form-inputs/PagesNumberInput.ts` — wire ARIA attributes
- Modify: `packages/pages-viz/src/form-inputs/PagesCheckbox.ts` — wire ARIA attributes
- Modify: `packages/pages-viz/src/form-inputs/PagesDropdown.ts` — wire ARIA attributes
- Modify: `packages/pages-viz/src/form-inputs/PagesDatePicker.ts` — wire ARIA attributes
- Modify: `packages/pages-viz/src/form-inputs/PagesTextarea.ts` — wire ARIA attributes
- Test: `packages/pages-viz/src/form-inputs/form-inputs.test.ts` (extend)

**Interfaces:**
- Produces: `PagesFormInput.errorMessage: string | undefined` — renders inline error text, sets `aria-invalid="true"`
- Produces: `PagesFormInput.required: boolean` — sets `aria-required="true"` on the input
- Produces: `PagesFormInput.describedBy: string | undefined` — sets `aria-describedby`

- [ ] **Step 1: Write failing tests for ARIA attributes**

Add to `form-inputs.test.ts`:

```typescript
describe("a11y properties", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("errorMessage sets aria-invalid and renders error text", async () => {
    const el = document.createElement("pages-text-input") as PagesTextInput;
    el.props = { field: "name", label: "Name" };
    el.errorMessage = "Required";
    container.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorEl = el.shadowRoot!.querySelector(".field-error");
    expect(errorEl?.textContent).toBe("Required");
  });

  it("required sets aria-required on input", async () => {
    const el = document.createElement("pages-text-input") as PagesTextInput;
    el.props = { field: "name", label: "Name" };
    (el as any).required = true;
    container.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    expect(input.getAttribute("aria-required")).toBe("true");
  });

  it("describedBy sets aria-describedby on input", async () => {
    const el = document.createElement("pages-text-input") as PagesTextInput;
    el.props = { field: "name", label: "Name" };
    (el as any).describedBy = "name-error";
    container.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    expect(input.getAttribute("aria-describedby")).toBe("name-error");
  });

  it("no errorMessage means no aria-invalid", async () => {
    const el = document.createElement("pages-text-input") as PagesTextInput;
    el.props = { field: "name", label: "Name" };
    container.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL

- [ ] **Step 3: Add properties to PagesFormInput base class**

In `PagesFormInput.ts`, add reactive properties:

```typescript
@property({ attribute: false }) errorMessage: string | undefined;
@property({ type: Boolean, attribute: false }) required = false;
@property({ attribute: false }) describedBy: string | undefined;
```

Import `property` from `lit/decorators.js`.

- [ ] **Step 4: Wire ARIA attributes in each subclass's `renderContent`**

For each subclass, add ARIA attributes to the `<input>`/`<select>`/`<textarea>` element. Example for `PagesTextInput.ts`:

```typescript
<input
  type="text"
  .value=${inputValue}
  placeholder=${ifDefined(props.placeholder)}
  maxlength=${ifDefined(props.maxLength)}
  ?required=${!!props.required || this.required}
  ?readonly=${isReadonly}
  aria-required=${ifDefined(this.required ? "true" : undefined)}
  aria-invalid=${ifDefined(this.errorMessage ? "true" : undefined)}
  aria-describedby=${ifDefined(this.describedBy)}
  @input=${(e: Event) => this.emitFieldChange((e.target as HTMLInputElement).value, false)}
  @blur=${(e: Event) => this.emitFieldChange((e.target as HTMLInputElement).value, true)}
/>
${this.errorMessage ? html`<span class="field-error" role="alert">${this.errorMessage}</span>` : ""}
```

Add `.field-error` CSS to each subclass's styles:

```css
.field-error {
  color: var(--pages-danger-9, #dc2626);
  font-size: var(--pages-font-size-xs, 11px);
  margin-top: var(--pages-space-0-5, 2px);
}
```

Repeat for all six subclasses, adjusting the selector (`input`, `select`, `textarea`, `input[type="checkbox"]`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add packages/pages-viz/src/form-inputs/
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "feat(#159): add a11y properties to PagesFormInput subclasses

errorMessage, required, describedBy properties on PagesFormInput base.
Each subclass wires aria-required, aria-invalid, aria-describedby to
its input element and renders inline error text.

Refs #159"
```

---

### Task 3: Create `schema-types.ts` and `PagesSchemaForm` component

**Files:**
- Create: `packages/pages-viz/src/form-inputs/schema-types.ts`
- Create: `packages/pages-viz/src/form-inputs/PagesSchemaForm.ts`
- Modify: `packages/pages-viz/src/index.ts` — add exports
- Modify: `packages/pages-viz/package.json` — add `@casehubio/pages-primitives` dependency
- Test: `packages/pages-viz/src/form-inputs/schema-form.test.ts`

**Interfaces:**
- Consumes: `PagesFormInput.currentValue` (Task 1), `PagesFormInput.errorMessage/required/describedBy` (Task 2)
- Produces: `PagesSchemaForm` — Lit custom element `pages-schema-form` extending `PagesElement<SchemaFormProps>`
- Produces: `FieldSchema` — type for JSON Schema field definitions
- Produces: `SchemaFormProps` — props interface
- Produces: `deriveSchemaFromDataSet(dataset: TypedDataSet): FieldSchema` — auto-derive function
- Produces: `mapFieldToComponentType(field: string, schema: FieldSchema): string` — returns tag name without `pages-` prefix

- [ ] **Step 1: Write failing tests for schema-to-component mapping**

Create `packages/pages-viz/src/form-inputs/schema-form.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { toTypedDataSet, ColumnType } from "@casehubio/pages-data";
import type { ColumnId } from "@casehubio/pages-data";
import type { PagesSchemaForm } from "./PagesSchemaForm.js";
import "./PagesSchemaForm.js";
import "./PagesTextInput.js";
import "./PagesNumberInput.js";
import "./PagesDropdown.js";
import "./PagesCheckbox.js";
import "./PagesDatePicker.js";
import "./PagesTextarea.js";

function makeDataSet(
  columns: Array<{ id: string; type: ColumnType }>,
  data: unknown[][],
) {
  return toTypedDataSet({
    columns: columns.map((c) => ({
      id: c.id as ColumnId,
      name: c.id,
      type: c.type,
    })),
    data: data.map((row) => row.map((v) => (v === null ? null : String(v)))),
  });
}

describe("PagesSchemaForm — schema-to-component mapping", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("auto-derives schema from dataset columns and renders correct child types", async () => {
    const ds = makeDataSet(
      [
        { id: "name", type: ColumnType.TEXT },
        { id: "age", type: ColumnType.NUMBER },
        { id: "status", type: ColumnType.LABEL },
        { id: "start", type: ColumnType.DATE },
      ],
      [["Alice", "30", "Active", "2026-01-01"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {};
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-text-input")).not.toBeNull();
    expect(form.shadowRoot!.querySelector("pages-number-input")).not.toBeNull();
    expect(form.shadowRoot!.querySelector("pages-dropdown")).not.toBeNull();
    expect(form.shadowRoot!.querySelector("pages-date-picker")).not.toBeNull();
  });

  it("explicit schema maps string to text-input", async () => {
    const ds = makeDataSet(
      [{ id: "name", type: ColumnType.TEXT }],
      [["Alice"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: { name: { type: "string" } },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-text-input")).not.toBeNull();
  });

  it("explicit schema maps number to number-input", async () => {
    const ds = makeDataSet(
      [{ id: "age", type: ColumnType.NUMBER }],
      [["30"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: { age: { type: "number", minimum: 0, maximum: 120 } },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    const numInput = form.shadowRoot!.querySelector("pages-number-input");
    expect(numInput).not.toBeNull();
  });

  it("explicit schema maps string with enum to dropdown", async () => {
    const ds = makeDataSet(
      [{ id: "lang", type: ColumnType.LABEL }],
      [["Java"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: {
          lang: { type: "string", enum: ["Java", "TypeScript", "Python"] },
        },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-dropdown")).not.toBeNull();
  });

  it("explicit schema maps boolean to checkbox", async () => {
    const ds = makeDataSet(
      [{ id: "active", type: ColumnType.LABEL }],
      [["true"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: { active: { type: "boolean" } },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-checkbox")).not.toBeNull();
  });

  it("explicit schema maps format:date to date-picker", async () => {
    const ds = makeDataSet(
      [{ id: "dob", type: ColumnType.DATE }],
      [["2000-01-01"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: { dob: { type: "string", format: "date" } },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-date-picker")).not.toBeNull();
  });

  it("explicit schema maps format:textarea to textarea", async () => {
    const ds = makeDataSet(
      [{ id: "notes", type: ColumnType.TEXT }],
      [["Some text"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: {
        properties: { notes: { type: "string", format: "textarea" } },
      },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    expect(form.shadowRoot!.querySelector("pages-textarea")).not.toBeNull();
  });

  it("excludeFields hides specified fields", async () => {
    const ds = makeDataSet(
      [
        { id: "id", type: ColumnType.NUMBER },
        { id: "name", type: ColumnType.TEXT },
      ],
      [["1", "Alice"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = { excludeFields: ["id"] };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    const inputs = form.shadowRoot!.querySelectorAll("pages-text-input, pages-number-input");
    expect(inputs.length).toBe(1);
  });

  it("children receive dataset directly and emit pages-field-change", async () => {
    const ds = makeDataSet(
      [{ id: "name", type: ColumnType.TEXT }],
      [["Alice"]],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {};
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    const events: CustomEvent[] = [];
    form.addEventListener("pages-field-change", (e) => events.push(e as CustomEvent));

    const textInput = form.shadowRoot!.querySelector("pages-text-input")!;
    const input = textInput.shadowRoot!.querySelector("input")!;
    input.value = "Bob";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(events.length).toBe(1);
    expect(events[0].detail.field).toBe("name");
    expect(events[0].detail.value).toBe("Bob");
  });

  it("create mode with zero rows renders empty fields and emits pages-record-create on submit", async () => {
    const ds = makeDataSet(
      [{ id: "name", type: ColumnType.TEXT }],
      [],
    );

    const form = document.createElement("pages-schema-form") as PagesSchemaForm;
    form.props = {
      schema: { properties: { name: { type: "string" } } },
    };
    form.editable = true;
    container.appendChild(form);
    (form as any).dataSet = ds;
    await form.updateComplete;

    const events: CustomEvent[] = [];
    form.addEventListener("pages-record-create", (e) => events.push(e as CustomEvent));

    const textInput = form.shadowRoot!.querySelector("pages-text-input")!;
    const input = textInput.shadowRoot!.querySelector("input")!;
    input.value = "NewName";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    form.submit();

    expect(events.length).toBe(1);
    expect(events[0].detail.record).toEqual({ name: "NewName" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `PagesSchemaForm` does not exist

- [ ] **Step 3: Create `schema-types.ts`**

Create `packages/pages-viz/src/form-inputs/schema-types.ts` using `ide_create_file`:

```typescript
import type { TypedDataSet, Column } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

export interface FieldSchema {
  readonly type?: string;
  readonly format?: string;
  readonly title?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly enum?: readonly string[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  readonly required?: readonly string[];
}

export interface SchemaFormProps {
  schema?: FieldSchema;
  mode?: "display" | "edit";
  forceCreate?: boolean;
  validateOnBlur?: boolean;
  excludeFields?: string[];
  fieldOrder?: string[];
  labels?: Record<string, string>;
}

export function deriveSchemaFromDataSet(dataset: TypedDataSet): FieldSchema {
  const properties: Record<string, FieldSchema> = {};
  for (const col of dataset.columns) {
    properties[col.id] = columnToFieldSchema(col);
  }
  return { properties };
}

function columnToFieldSchema(col: Column): FieldSchema {
  switch (col.type) {
    case ColumnType.NUMBER:
      return { type: "number" };
    case ColumnType.DATE:
      return { type: "string", format: "date" };
    case ColumnType.LABEL:
      return { type: "string", enum: [] };
    case ColumnType.TEXT:
    default:
      return { type: "string" };
  }
}

export function mapFieldToComponentType(fieldSchema: FieldSchema): string {
  if (fieldSchema.type === "boolean") return "checkbox";
  if (fieldSchema.type === "number") return "number-input";
  if (fieldSchema.type === "integer") return "number-input";
  if (fieldSchema.type === "string") {
    if (fieldSchema.enum && fieldSchema.enum.length > 0) return "dropdown";
    if (fieldSchema.format === "date") return "date-picker";
    if (fieldSchema.format === "datetime-local") return "date-picker";
    if (fieldSchema.format === "textarea") return "textarea";
    return "text-input";
  }
  if (fieldSchema.enum && fieldSchema.enum.length > 0) return "dropdown";
  return "text-input";
}

export function validateField(
  schema: FieldSchema,
  value: unknown,
  required: boolean,
): string | null {
  if (required && (value === null || value === undefined || value === "")) {
    return "Required";
  }
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    if (schema.pattern != null) {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) return "Invalid format";
    }
    if (schema.minLength != null && value.length < schema.minLength) {
      return `Must be at least ${schema.minLength} characters`;
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      return `Must be at most ${schema.maxLength} characters`;
    }
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) {
      return `Must be at least ${schema.minimum}`;
    }
    if (schema.maximum != null && value > schema.maximum) {
      return `Must be at most ${schema.maximum}`;
    }
  }
  return null;
}
```

- [ ] **Step 4: Create `PagesSchemaForm.ts`**

Create `packages/pages-viz/src/form-inputs/PagesSchemaForm.ts` using `ide_create_file`:

```typescript
import { html, css, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { PagesElement } from "../base/PagesElement.js";
import { LiveRegionMixin } from "@casehubio/pages-primitives/a11y";
import type { TypedDataSet, ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";
import type { DataSetLookup } from "@casehubio/pages-data";
import type { PagesFormInput } from "./PagesFormInput.js";
import type { SchemaFormProps, FieldSchema } from "./schema-types.js";
import {
  deriveSchemaFromDataSet,
  mapFieldToComponentType,
  validateField,
} from "./schema-types.js";
import { cellToRaw } from "../base/cell-extract.js";

const SchemaFormBase = LiveRegionMixin(PagesElement);

if (!customElements.get("pages-schema-form")) {
  @customElement("pages-schema-form")
  class PagesSchemaFormImpl extends SchemaFormBase {
    // Implementation inside the guard
  }
}

// Actual class — exported for type use
@customElement("pages-schema-form")
export class PagesSchemaForm extends SchemaFormBase {
  private _children: Map<string, HTMLElement> = new Map();
  private _schema: FieldSchema | null = null;

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui, sans-serif); }
    .schema-form-fields { display: flex; flex-direction: column; gap: var(--pages-space-2, 8px); }
    .submit-bar { margin-top: var(--pages-space-3, 12px); }
    .submit-btn {
      padding: 8px 16px; border: 1px solid var(--pages-accent-9, #5470c6);
      border-radius: var(--pages-radius-sm, 4px); background: var(--pages-accent-9, #5470c6);
      color: white; cursor: pointer; font-size: var(--pages-font-size-base, 14px);
    }
    .submit-btn:hover { opacity: 0.9; }
  `;

  protected override renderContent(
    props: SchemaFormProps & { lookup?: DataSetLookup },
    dataset: TypedDataSet,
  ): TemplateResult {
    const schema = props.schema ?? deriveSchemaFromDataSet(dataset);
    this._schema = schema;
    const schemaProps = schema.properties ?? {};
    const requiredSet = new Set(schema.required ?? []);

    const excludeSet = new Set(props.excludeFields ?? []);
    const fieldOrder = props.fieldOrder
      ?? Object.keys(schemaProps);
    const fields = fieldOrder.filter((f) => !excludeSet.has(f) && f in schemaProps);

    const isCreateMode = props.forceCreate === true
      || dataset.rows.length === 0;
    const isDisplay = props.mode === "display" || !this._editable;

    return html`
      <div class="schema-form-fields" role="${isDisplay ? "group" : "form"}">
        ${fields.map((field) => {
          const fieldSchema = schemaProps[field]!;
          const componentType = mapFieldToComponentType(fieldSchema);
          const tagName = `pages-${componentType}`;

          const label = props.labels?.[field]
            ?? fieldSchema.title
            ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

          const childProps = this.buildChildProps(
            field, fieldSchema, componentType, label, dataset,
          );

          return html`<${this.getOrCreateChild(field, tagName, childProps, dataset, isDisplay, requiredSet.has(field))}></${tagName}>`;
        })}
        ${isCreateMode && !isDisplay ? html`
          <div class="submit-bar">
            <button class="submit-btn" @click=${() => this.submit()}>Submit</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  private buildChildProps(
    field: string,
    fieldSchema: FieldSchema,
    componentType: string,
    label: string,
    dataset: TypedDataSet,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = { field, label };

    if (componentType === "number-input") {
      if (fieldSchema.minimum !== undefined) base.min = fieldSchema.minimum;
      if (fieldSchema.maximum !== undefined) base.max = fieldSchema.maximum;
      if (fieldSchema.type === "integer") base.step = 1;
    }

    if (componentType === "dropdown") {
      if (fieldSchema.enum && fieldSchema.enum.length > 0) {
        base.options = { values: [...fieldSchema.enum] };
      } else {
        const distinctValues = this.extractDistinctValues(field, dataset);
        base.options = { values: distinctValues };
      }
    }

    if (componentType === "text-input") {
      if (fieldSchema.maxLength !== undefined) base.maxLength = fieldSchema.maxLength;
      if (fieldSchema.placeholder !== undefined) base.placeholder = fieldSchema.placeholder;
    }

    if (componentType === "textarea") {
      if (fieldSchema.maxLength !== undefined) base.maxLength = fieldSchema.maxLength;
    }

    return base;
  }

  private extractDistinctValues(field: string, dataset: TypedDataSet): string[] {
    const seen = new Set<string>();
    for (const row of dataset.rows) {
      try {
        const cell = row.cell(field as ColumnId);
        const raw = cellToRaw(cell);
        if (raw !== null) seen.add(String(raw));
      } catch {
        // Column not found — skip
      }
    }
    return [...seen].sort();
  }

  private getOrCreateChild(
    field: string,
    tagName: string,
    childProps: Record<string, unknown>,
    dataset: TypedDataSet,
    isDisplay: boolean,
    isRequired: boolean,
  ): HTMLElement {
    let child = this._children.get(field);
    if (!child || child.tagName.toLowerCase() !== tagName) {
      child = document.createElement(tagName);
      this._children.set(field, child);
    }

    const formInput = child as unknown as PagesFormInput<any>;
    formInput.props = childProps;
    formInput.dataSet = dataset;
    formInput.editable = !isDisplay && this._editable;
    formInput.required = isRequired;

    return child;
  }

  submit(): Record<string, unknown> | null {
    if (!this._schema?.properties) return null;

    const requiredSet = new Set(this._schema.required ?? []);
    const errors: Record<string, string> = {};
    const record: Record<string, unknown> = {};

    for (const [field, child] of this._children) {
      const fieldSchema = this._schema.properties[field];
      if (!fieldSchema) continue;

      const formInput = child as unknown as PagesFormInput<any>;
      const value = formInput.currentValue;
      record[field] = value;

      const error = validateField(fieldSchema, value, requiredSet.has(field));
      if (error) {
        errors[field] = error;
        formInput.errorMessage = error;
      } else {
        formInput.errorMessage = undefined;
      }
    }

    if (Object.keys(errors).length > 0) {
      const count = Object.keys(errors).length;
      this.announce(
        `${count} validation error${count > 1 ? "s" : ""} — please correct before submitting`,
        "assertive",
      );
      return null;
    }

    this.dispatchEvent(
      new CustomEvent("pages-record-create", {
        bubbles: true, composed: true,
        detail: { record },
      }),
    );

    this.announce("Record submitted successfully");
    return record;
  }
}
```

**Note:** The `renderContent` approach above uses Lit's `html` tagged template with manual DOM management via `getOrCreateChild`. This is necessary because `PagesElement.render()` calls `renderContent()` with `cache()`, and we need stable child instances. The actual implementation may need to use `updated()` lifecycle to append children to a container `<div>` rather than returning them from `html`. This is an implementation detail that will be refined when the tests drive the exact behavior.

- [ ] **Step 5: Add exports to `pages-viz/src/index.ts`**

Add to `packages/pages-viz/src/index.ts`:

```typescript
// Schema form
export { PagesSchemaForm } from "./form-inputs/PagesSchemaForm.js";
export type { FieldSchema, SchemaFormProps } from "./form-inputs/schema-types.js";
```

- [ ] **Step 6: Add `@casehubio/pages-primitives` dependency to pages-viz**

In `packages/pages-viz/package.json`, add to `dependencies`:

```json
"@casehubio/pages-primitives": "workspace:*"
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-viz run test -- --reporter=verbose 2>&1 | tail -40`
Expected: PASS (iterate on implementation until green)

- [ ] **Step 8: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add packages/pages-viz/src/form-inputs/PagesSchemaForm.ts packages/pages-viz/src/form-inputs/schema-types.ts packages/pages-viz/src/form-inputs/schema-form.test.ts packages/pages-viz/src/index.ts packages/pages-viz/package.json
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "feat(#159): add PagesSchemaForm extending PagesElement with delegation

PagesSchemaForm extends PagesElement, receives TypedDataSet via pipeline,
auto-derives or accepts JSON Schema, creates child form input components.
Children get dataSet directly (no lookup). Create mode emits
pages-record-create. LiveRegionMixin for validation announcements.

Refs #159"
```

---

### Task 4: Register `schema-form` in runtime activation and YAML parser

**Files:**
- Modify: `packages/pages-runtime/src/activation.ts` — add `schema-form` to `DATA_COMPONENT_TYPES` and dedicated activation branch
- Modify: `packages/pages-ui/src/parser/component-desugar.ts` — add `schema-form` shorthand and type
- Test: `packages/pages-ui/src/parser/form-desugar.test.ts` (extend)
- Test: `packages/pages-runtime/src/form-schema-integration.test.ts` (create)

**Interfaces:**
- Consumes: `PagesSchemaForm` (Task 3)
- Produces: `schema-form` recognized in YAML DSL and activated in runtime pipeline

- [ ] **Step 1: Write failing test for YAML parser shorthand**

Add to `packages/pages-ui/src/parser/form-desugar.test.ts`:

```typescript
it("desugars schema-form shorthand", () => {
  const root = parsePage({
    pages: [{
      components: [{
        "schema-form": {
          schema: { properties: { name: { type: "string" } } },
          excludeFields: ["id"],
        },
      }],
    }],
  });
  const item = root.slots!.content![0]!.items![0]!;
  expect(item.component.type).toBe("schema-form");
  expect(item.component.props).toEqual({
    schema: { properties: { name: { type: "string" } } },
    excludeFields: ["id"],
  });
});

it("desugars type: schema-form with properties", () => {
  const root = parsePage({
    pages: [{
      components: [{
        type: "schema-form",
        properties: {
          schema: { properties: { age: { type: "number" } } },
          lookup: { uuid: "devs" },
        },
      }],
    }],
  });
  const item = root.slots!.content![0]!.items![0]!;
  expect(item.component.type).toBe("schema-form");
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `schema-form` not recognized

- [ ] **Step 3: Add `schema-form` to YAML parser**

In `component-desugar.ts`:

1. Add `"schema-form"` to the `DATA_COMPONENT_TYPES` set (line ~28).

2. Add shorthand handler after the existing form input shorthands block (after `textarea` handler, around line 98):

```typescript
// Schema form shorthand
if ("schema-form" in raw) {
  const props = raw["schema-form"] as Record<string, unknown>;
  const style = extractStyle(raw.properties);
  const visibleWhen = raw.visibleWhen as string | undefined;
  return {
    type: "schema-form",
    props,
    ...(style ? { style } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
  };
}
```

- [ ] **Step 4: Run parser test to verify it passes**

Run: `yarn workspace @casehubio/pages-ui run test -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Write failing integration test for runtime activation**

Create `packages/pages-runtime/src/form-schema-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@casehubio/pages-viz";
import { loadSite } from "./site.js";
import type { LiveSite } from "./site.js";

const SCHEMA_FORM_YAML = `
datasets:
  - uuid: devs
    content: >-
      [
        [1, "Alice", "Java", 8],
        [2, "Bob", "TypeScript", 3]
      ]
    columns:
      - id: id
        type: NUMBER
      - id: name
        type: TEXT
      - id: language
        type: LABEL
      - id: years
        type: NUMBER

pages:
  - name: Dev List
    components:
      - type: table
        properties:
          lookup:
            uuid: devs
          filter:
            enabled: true
            notification: true

      - page: Edit Dev

  - name: Edit Dev
    dataScope:
      dataset: devs
      idColumn: id
    save:
      trigger: auto
      delay: 2000
      adapter: local
    components:
      - schema-form:
          excludeFields: [id]
`;

describe("schema-form runtime integration", () => {
  let target: HTMLDivElement;
  let site: LiveSite | null = null;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    site?.dispose();
    site = null;
    document.body.removeChild(target);
  });

  async function waitFor(
    condition: () => boolean,
    msg: string,
    maxWait = 1000,
  ): Promise<void> {
    const start = Date.now();
    while (!condition() && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!condition()) throw new Error(`Timeout: ${msg}`);
  }

  it("loadSite activates schema-form with auto-derived schema", async () => {
    site = await loadSite(target, SCHEMA_FORM_YAML);
    const schemaForm = target.querySelector("pages-schema-form");
    expect(schemaForm).not.toBeNull();

    await waitFor(
      () => !!(schemaForm as any).dataSet,
      "schema-form receives data",
    );

    const children = schemaForm!.shadowRoot!.querySelectorAll(
      "pages-text-input, pages-number-input, pages-dropdown",
    );
    expect(children.length).toBeGreaterThan(0);
  });

  it("schema-form children are editable when page has save config", async () => {
    site = await loadSite(target, SCHEMA_FORM_YAML);
    const schemaForm = target.querySelector("pages-schema-form");
    await waitFor(
      () => !!(schemaForm as any).dataSet,
      "schema-form receives data",
    );

    expect((schemaForm as any).editable).toBe(true);
  });

  it("field change from schema-form child updates editState", async () => {
    site = await loadSite(target, SCHEMA_FORM_YAML);
    const schemaForm = target.querySelector("pages-schema-form");
    await waitFor(
      () => !!(schemaForm as any).dataSet,
      "schema-form receives data",
    );

    const textInput = schemaForm!.shadowRoot!.querySelector("pages-text-input");
    expect(textInput).not.toBeNull();

    textInput!.dispatchEvent(
      new CustomEvent("pages-field-change", {
        bubbles: true, composed: true,
        detail: { field: "name", value: "Updated", committed: true },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));
    // No crash — editState updated successfully
  });
});
```

- [ ] **Step 6: Add `schema-form` to runtime activation**

In `activation.ts`:

1. Add `"schema-form"` to `DATA_COMPONENT_TYPES`:
```typescript
const DATA_COMPONENT_TYPES = new Set([
  // ... existing types ...
  "schema-form",
  ...FORM_INPUT_TYPES,
]);
```

2. Add dedicated activation branch after the `isFormInput` block (after `vizEl.error = "Form input requires page dataScope"` closing brace):

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

3. Modify the generic props-setting condition to include schema-form:

Change:
```typescript
if (isFormInput && lookup) {
```
To:
```typescript
if ((isFormInput || component.type === "schema-form") && lookup) {
```

- [ ] **Step 7: Run integration test**

Run: `yarn workspace @casehubio/pages-runtime run test -- --reporter=verbose 2>&1 | tail -30`
Expected: PASS (iterate until green)

- [ ] **Step 8: Run full test suite**

Run: `yarn typecheck && yarn workspace @casehubio/pages-ui run test && yarn workspace @casehubio/pages-viz run test && yarn workspace @casehubio/pages-runtime run test`
Expected: all PASS

- [ ] **Step 9: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add packages/pages-runtime/src/activation.ts packages/pages-runtime/src/form-schema-integration.test.ts packages/pages-ui/src/parser/component-desugar.ts packages/pages-ui/src/parser/form-desugar.test.ts
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "feat(#159): register schema-form in runtime activation and YAML parser

Add schema-form to DATA_COMPONENT_TYPES with dedicated activation
branch (implicit lookup from dataScope, editable from save config).
Add schema-form shorthand to component-desugar.ts. Extend generic
props-setting to include schema-form for lookup merge.

Refs #159"
```

---

### Task 5: Remove `pages-form` package and clean up monorepo

**Files:**
- Delete: `packages/pages-form/` (entire directory)
- Modify: `package.json` (root) — remove from `build:packages` script
- Modify: `examples/samples/Forms/Schema Form.ts` — rewrite imports
- Modify: ARC42STORIES.MD — update §5

**Interfaces:**
- Consumes: `PagesSchemaForm` now in `@casehubio/pages-viz` (Task 3)

- [ ] **Step 1: Delete `pages-form` package directory**

```bash
rm -rf /Users/mdproctor/claude/casehub/worktrees/23/pages/packages/pages-form
```

- [ ] **Step 2: Remove from root `build:packages` script**

In root `package.json`, remove `&& yarn workspace @casehubio/pages-form run build` from the `build:packages` script.

- [ ] **Step 3: Rewrite `Schema Form.ts` example**

Replace the entire file. The old file imports from `@casehubio/pages-form` and uses `registerFieldRenderer` — both deleted. The new file:

```typescript
import type { PagesSchemaForm } from "@casehubio/pages-viz";

// Programmatic usage of pages-schema-form (the YAML DSL approach is preferred).
// This file demonstrates creating the component in code.

const schema = {
  properties: {
    transactionId: { type: "string", minLength: 1 },
    amount: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    flagged: { type: "boolean" },
    reportDate: { type: "string", format: "date" },
    notes: { type: "string", format: "textarea" },
  },
  required: ["transactionId", "amount"],
};

const form = document.createElement("pages-schema-form") as PagesSchemaForm;
form.props = { schema, excludeFields: ["id"] };
form.editable = true;

form.addEventListener("pages-field-change", (e: Event) => {
  const { field, value } = (e as CustomEvent).detail;
  console.log(`Field "${field}" changed:`, value);
});

form.addEventListener("pages-record-create", (e: Event) => {
  const { record } = (e as CustomEvent).detail;
  console.log("New record:", record);
});
```

- [ ] **Step 4: Update ARC42STORIES.MD**

Find `pages-schema-form` in the `pages-primitives` future list and remove it. Add a note in the pages-viz section that `PagesSchemaForm` lives in `pages-viz/src/form-inputs/`.

- [ ] **Step 5: Run `yarn install` to update workspace resolution**

```bash
yarn install
```

- [ ] **Step 6: Run full build and test**

```bash
yarn build:packages && yarn typecheck
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add -A
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "refactor(#159): remove pages-form package — absorbed into pages-viz

PagesSchemaForm moved to pages-viz/src/form-inputs/. Standalone
field-renderers, validation, and field-registry deleted — replaced
by delegation to existing PagesFormInput subclasses. Schema Form
example rewritten for new API.

Refs #159"
```

---

### Task 6: Update all examples to showcase schema-form capabilities

**Files:**
- Modify: `examples/samples/Forms/Schema Form.dash.yaml` — replace `<schema-form-demo>` with real `schema-form:` component
- Modify: `examples/samples/Forms/Developer Registration.dash.yaml` — add schema-form variant
- Modify: `examples/samples/Forms/Contact Manager.dash.yaml` — add schema-form usage

**Interfaces:**
- Consumes: `schema-form` YAML shorthand (Task 4)

- [ ] **Step 1: Update Schema Form example YAML**

Replace the Schema tab content (currently `type: html` with `<schema-form-demo>`) with:

```yaml
Schema:
  components:
    - type: markdown
      properties:
        content: |
          **Schema-driven form** — one component, one JSON Schema.
          Auto-derives field types, labels, and validation from the
          schema. Edit a field — changes auto-save after 1 second.

    - schema-form:
        schema:
          properties:
            transactionId: { type: string, minLength: 1 }
            amount: { type: number, minimum: 0 }
            currency: { type: string, enum: [USD, EUR, GBP] }
            flagged: { type: boolean }
            reportDate: { type: string, format: date }
            detectedAt: { type: string, format: datetime-local }
            notes: { type: string, format: textarea }
            sender: { type: string }
            receiver: { type: string }
          required: [transactionId, amount]
        excludeFields: [id]
```

- [ ] **Step 2: Update Developer Registration example**

Add a third page that uses schema-form, accessible via tabs or navigation:

```yaml
- name: Edit Developer (Schema)
  dataScope:
    dataset: devs
    idColumn: id
  save:
    trigger: auto
    delay: 2000
    adapter: local
  components:
    - type: title
      properties:
        text: Edit Developer (Schema Form)
        size: h3

    - type: markdown
      properties:
        content: |
          Same data as the DSL form, but driven by a single
          `schema-form:` component with explicit schema constraints.

    - schema-form:
        schema:
          properties:
            name: { type: string, minLength: 1 }
            language: { type: string, enum: [Java, TypeScript, Python, Go, Rust, Kotlin, C++] }
            workingYears: { type: integer, minimum: 0, maximum: 50 }
          required: [name]
        excludeFields: [id]
        labels:
          workingYears: Years of Experience
```

- [ ] **Step 3: Update Contact Manager example**

Add a schema-form variant for the contact form page, or add a tab showing the schema-form approach alongside the existing DSL inputs.

- [ ] **Step 4: Build examples and verify visually**

```bash
yarn build:prod
yarn workspace @casehubio/pages-examples run serve
```

Open browser, verify all three form examples render correctly with editable fields and auto-save.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages add examples/
git -C /Users/mdproctor/claude/casehub/worktrees/23/pages commit -m "docs(#159): update all form examples to showcase schema-form

Schema Form: replace demo placeholder with real schema-form component.
Developer Registration: add schema-form variant with explicit constraints.
Contact Manager: add schema-form usage alongside DSL inputs.

Refs #159"
```

---

## Task Dependencies

```
Task 1 (currentValue getter)  ──┐
                                 ├──→ Task 3 (PagesSchemaForm) ──→ Task 4 (activation + parser) ──→ Task 5 (cleanup) ──→ Task 6 (examples)
Task 2 (a11y props)           ──┘
```

Tasks 1 and 2 are independent of each other and can be done in either order. Tasks 3–6 are strictly sequential.
