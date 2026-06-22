# ESLint/TSC Type Resolution Alignment

**Issue:** #9  
**Scale:** M | **Complexity:** Med  
**Date:** 2026-06-22

## Problem

`no-unnecessary-type-assertion` is disabled for all test files because ESLint and TSC disagree on whether `as HTMLElement` (and `as DataElement`) assertions on `querySelector()` are necessary. Removing the assertion satisfies ESLint but breaks TSC; keeping it satisfies TSC but breaks ESLint. The rule is off as a workaround, silencing legitimate violations across 96 test files.

## Root Cause

`packages/pages-viz/src/custom-elements.d.ts` augments `HTMLElementTagNameMap` with 19 custom element tag names (`"casehub-table"` → `CasehubTable`, `"casehub-text-input"` → `CasehubTextInput`, etc.). This augmentation makes `querySelector("casehub-table")` return `CasehubTable | null` instead of `Element | null` — TypeScript uses the tag-name overload.

The disagreement is about **augmentation visibility**:

- **ESLint `projectService`** loads all source files in scope, including `custom-elements.d.ts`. It sees `querySelector("casehub-table")` returning `CasehubTable | null`. Since `CasehubTable` is structurally assignable to `DataElement`, the `as DataElement | null` assertion is a widening that ESLint flags as unnecessary.
- **TSC `--build`** uses declaration output from referenced projects (`.typecheck/` directory). `custom-elements.d.ts` is a `.d.ts` source file — TypeScript consumes it but does not re-emit it. Verified: `packages/pages-viz/.typecheck/` has no `custom-elements.d.ts` and no `HTMLElementTagNameMap` references. TSC falls through to the generic overload → `Element | null`, making the assertion necessary.

Both tools apply the same overload resolution logic. They disagree because they see different type declarations — one has the augmentation, the other doesn't.

## Design

### Step 1: Convert `custom-elements.d.ts` → `custom-elements.ts`

Rename the file from `.d.ts` to `.ts`. Add `export {};` — required because `isolatedModules: true` is set in the base tsconfig, and that setting requires every file to have at least one export statement. The existing `import type` statements are erased (type-only under `verbatimModuleSyntax: true`), so TypeScript needs an explicit export to confirm this is a valid isolated module.

After this change, TypeScript compiles the file and emits it to `.typecheck/custom-elements.d.ts`.

### Step 2: Wire the Augmentation into the Module Graph

Emission alone is not enough. In `--build` mode, consuming packages follow the module graph starting from the entry point — they don't load all `.d.ts` files from the referenced project's output.

`pages-viz/src/index.ts` does not import `custom-elements.d.ts`. After emission, the augmentation would sit in `.typecheck/custom-elements.d.ts` unused.

**Fix:** Add `import "./custom-elements.js";` to `pages-viz/src/index.ts`. This side-effect import creates a module graph path from `index.ts` → `custom-elements.ts`, ensuring the augmentation is loaded when any package does `import "@casehub/pages-viz"`.

### Step 3: Narrow `shadowRoot` on `CasehubElement`

`CasehubElement` calls `this.attachShadow({ mode: "open" })` in its constructor — `shadowRoot` is guaranteed non-null at runtime. But `Element.shadowRoot` is typed `readonly shadowRoot: ShadowRoot | null`.

The local `DataElement` interfaces in test files declare `shadowRoot: ShadowRoot` (non-null), masking this nullability. Removing `DataElement` and using concrete types like `CasehubTable` exposes the `ShadowRoot | null` inherited type, breaking every `tableEl.shadowRoot.querySelectorAll(...)` call (4 sites in `pages-runtime` tests).

**Fix:** Add `declare readonly shadowRoot: ShadowRoot;` to `CasehubElement`. This narrows the inherited type to match the runtime guarantee while preserving the `readonly` modifier from `Element.shadowRoot`. The narrowing is correct — `attachShadow` is called unconditionally in the constructor.

**Secondary effect:** 106 `shadowRoot!` assertions across 7 `pages-viz` test files become redundant (the `!` is no longer needed since `shadowRoot` is non-null). These are harmless now (`no-non-null-assertion` is off for test files), but if that rule is re-enabled in a future sweep, those sites would need cleanup. Not in scope for this issue.

### Step 4: Remove Local `DataElement` Interfaces

Four test files define their own `DataElement extends HTMLElement { dataSet?: TypedDataSet; editable?: boolean; shadowRoot: ShadowRoot }`:

- `form-edit.test.ts`
- `form-interaction.test.ts`
- `form-integration.test.ts`
- `form-equivalence.test.ts`

(`form-activation.test.ts` does NOT define `DataElement` — it uses inline intersection types like `HTMLElement & { dataSet?: unknown }`.)

This duplicates the interface of the concrete element classes. With augmentation visible and `shadowRoot` narrowed:

- `querySelector("casehub-table")` returns `CasehubTable | null` — has `dataSet` (via `CasehubElement`), `shadowRoot: ShadowRoot` (via step 3)
- `querySelector("casehub-text-input")` returns `CasehubTextInput | null` — has `dataSet` (via `CasehubElement`), `editable` (via `CasehubFormInput`), `shadowRoot: ShadowRoot` (via step 3)

`editable` lives on `CasehubFormInput`, not `CasehubElement`. Verified: test code only accesses `.editable` on form input elements (`CasehubTextInput`), never on tables (`CasehubTable`). The concrete type split is correct — if someone later writes `querySelector("casehub-table")` and tries `.editable`, the type system will correctly prevent it.

Remove the `DataElement` interfaces. Use concrete types directly. Function parameter types that reference `DataElement` must also be updated (e.g., `getTableRows(tableEl: DataElement)` → `getTableRows(tableEl: CasehubTable)`).

### Step 5: Update Assertion Sites in `pages-runtime` Tests

**Scope by action:**

| Action | Count | Why |
|--------|-------|-----|
| Remove assertion entirely (augmentation provides correct type) | 4 | Tag-name literal selectors: form-edit:84, form-edit:93, form-edit:384, form-interaction:98 |
| Convert to explicit generic (augmentation can't produce a usable type) | 3 | Template literal (form-activation:30, site:331) + variable selector (site:327) |
| Remove (genuinely unnecessary) | 1 | Return assertion after null check (form-activation:36) |
| Remove assertion + update to concrete type (DataElement gone) | ~12 | Unflagged tag-name selectors that also remove `| null`, plus form-equivalence:248, 249, 269 |
| Remove `DataElement` interface | 4 | Duplicate of concrete types |

**Transformation patterns:**

| Before | After | Notes |
|--------|-------|-------|
| `target.querySelector("casehub-table") as DataElement \| null` | `target.querySelector("casehub-table")` | Returns `CasehubTable \| null` via augmentation. Null handled by existing `!` or guards. |
| `Array.from(target.querySelectorAll("casehub-text-input")) as DataElement[]` | `Array.from(target.querySelectorAll("casehub-text-input"))` | Returns `CasehubTextInput[]`. |
| `(yamlTable as DataElement \| null)?.dataSet` | `yamlTable?.dataSet` | `yamlTable` is `CasehubTable \| null`, which has `dataSet`. |
| `(input as HTMLElement & { editable?: boolean }).editable` | `input.editable` | `input` is `CasehubTextInput` from `querySelectorAll("casehub-text-input")`, which has `editable` via `CasehubFormInput`. |
| `` el.querySelector(`casehub-${tag}`) as (HTMLElement & { dataSet?: unknown }) \| null `` | `` el.querySelector<HTMLElement & { dataSet?: unknown }>(`casehub-${tag}`) `` | Template literal: augmentation resolves to 19-member union (unwieldy). Explicit generic is cleaner. |
| `target.querySelector(selector) as HTMLElement \| null` | `target.querySelector<HTMLElement>(selector)` | Variable selector: augmentation can't help (unknown at compile time). |
| `return vizEl as HTMLElement & { dataSet?: unknown }` | `return vizEl` | Genuinely unnecessary — `vizEl` is already narrowed after null check. |
| `getTableRows(tableEl: DataElement)` | `getTableRows(tableEl: CasehubTable)` | Function parameter types must be updated alongside the interface removal. |
| `(bar.querySelectorAll("button")[1] as HTMLElement).click()` | `bar.querySelectorAll<HTMLButtonElement>("button")[1]!.click()` | Index-then-cast (optional consistency sweep, not correctness). |

### Step 6: Re-enable `no-unnecessary-type-assertion` in ESLint Config

Remove `"@typescript-eslint/no-unnecessary-type-assertion": "off"` from the test file override in `eslint.config.mjs`.

### Template Literal Selectors

`` querySelector(`casehub-${vizTag}`) `` where `vizTag` is `string` produces type `` `casehub-${string}` ``. TypeScript 5 CAN match this against `HTMLElementTagNameMap` keys — `K` is inferred as the union of all 19 casehub-* keys. After the augmentation fix, both ESLint and TSC resolve this to a union of all 19 custom element types (`CasehubTable | CasehubMetric | ... | null`).

The assertion would become genuinely unnecessary in both tools — `.dataSet` is available on all 19 members (they all extend `CasehubElement`), so accessing it doesn't require narrowing. But explicit generics remain the right choice because the 19-member union is unwieldy in error messages and IDE tooltips, and if the test ever needs a property not shared across all 19 types (like `.editable`), it would require narrowing. Use `querySelector<HTMLElement & { dataSet?: unknown }>()` for template literal selectors.

### Variable Selectors

`querySelector(selector)` where `selector` is a `string` variable falls through to the generic overload in both tools (returns `Element | null`). The augmentation doesn't help because the selector value is unknown at compile time. Use explicit generics: `querySelector<HTMLElement>(selector)`.

### Unaffected Patterns

- **`firstElementChild as HTMLElement`** (36 sites) — no tag-name overload involved, both tools agree the narrowing is real. Leave as-is.
- **`as CustomEvent`, `as EventListener`** — event typing, not DOM query. Different concern. Leave as-is.
- **`as DataSetId`** and other branded type casts — unrelated. Leave as-is.
- **`pages-component` test assertions** (22 sites in `interactive.test.ts`, `render.test.ts`) — `pages-component` doesn't reference `pages-viz`, so no augmentation is visible regardless. Both tools see `Element | null`. These are genuine narrowings, not affected by the fix. Optional consistency sweep (convert to generic form) but not a correctness requirement.
- **`pages-viz` test assertions** (9 sites across `CasehubChartElement.test.ts`, `CasehubSelector.test.ts`, `CasehubMetric.test.ts`) — these remove `| null` (e.g., `querySelector("div") as HTMLDivElement`), making them non-unnecessary even with augmentation. Not affected.
- **`pages-viz` `shadowRoot!` assertions** (106 sites across 7 test files) — after step 3, `shadowRoot` is non-null on `CasehubElement`, so the `!` is redundant. Harmless now (`no-non-null-assertion` is off for tests). If that rule is re-enabled in a future sweep, these would need cleanup. Not in scope.

### Verification

1. `yarn typecheck` — zero errors (TSC `--build` sees augmentation via emitted `.d.ts` + module graph import)
2. `yarn lint` — zero errors with rule re-enabled
3. `yarn test` — all tests pass

## Garden Reference

GE-20260622-549a11 — root cause diagnosis to be updated after implementation confirms the augmentation emission fix.
