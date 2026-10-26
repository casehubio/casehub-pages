# ARIA as Unified Interaction Model — Design Spec

**Issue:** casehubio/parent#417
**Branch:** issue-417-aria-interaction-model
**Date:** 2026-08-14
**Repos:** pages (primary), blocks-ui, blocks (Java command model), examples

## Principles

1. **One model** — ARIA is the interaction API for both accessibility and automation. No parallel automation attributes (data-testid, data-automation).
2. **Mandatory, not opt-in** — platform components enforce ARIA via contract types and CI validation. Apps built on them inherit it.
3. **Testable** — axe-core CI validates rendered output. If a scenario step can't find a component by role + name, the ARIA is wrong.
4. **Same fix** — if automation can't find a component, a screen reader can't either. One root cause, one fix.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Consumers                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Screen   │  │ Scenario     │  │ LLM via MCP        │  │
│  │ Readers  │  │ Tool (YAML)  │  │ (aria_* tools)     │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘  │
│       │               │                    │              │
│       ▼               ▼                    ▼              │
│  ┌────────────────────────────────────────────────────┐   │
│  │              ARIA Tree (DOM attributes)             │   │
│  │   role, aria-label, aria-busy, aria-disabled, ...   │   │
│  └────────────────────────────────────────────────────┘   │
│       ▲                                                   │
│  ┌────┴───────────────────────────────────────────────┐   │
│  │         pages-primitives: ARIA Contract Types       │   │
│  │         + existing a11y mixins (unchanged)          │   │
│  └────────────────────────────────────────────────────┘   │
│       ▲                       ▲                           │
│  ┌────┴──────────┐  ┌────────┴──────────┐                │
│  │ pages widgets │  │ blocks-ui widgets  │                │
│  └───────────────┘  └───────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

## 1. ARIA Contract (pages-primitives)

### Contract Types

Defined in `@casehubio/pages-primitives` as TypeScript interfaces. Every interactive component across pages and blocks-ui must satisfy these interfaces.

```typescript
type AriaRole = 'button' | 'textbox' | 'combobox' | 'listbox' | 'grid' | 'row' |
  'gridcell' | 'tree' | 'treeitem' | 'tablist' | 'tab' | 'tabpanel' | 'list' |
  'listitem' | 'option' | 'form' | 'group' | 'region' | 'article' | 'log' |
  'status' | 'meter' | 'img' | 'alertdialog' | 'alert' | 'separator' |
  'application' | 'toolbar' | 'heading' | 'checkbox';

interface AriaInteractive {
  role: AriaRole;
  ariaLabel: string;
  ariaBusy?: boolean;
  ariaDisabled?: boolean;
  ariaExpanded?: boolean;
}
```

`AriaInteractive` is the **minimal base** — every interactive component must satisfy it. Role-specific attributes (e.g. `aria-valuenow` for meters, `aria-rowcount` for grids, `aria-level` for tree items) are NOT enforced at compile time by this interface. They are enforced by axe-core CI, which validates rendered output against WAI-ARIA required properties for declared roles.

Components set these as Lit reactive properties reflected to attributes. The contract is enforced at two layers:

- **Compile time:** `AriaInteractive` base interface checked by the compiler. Ensures every interactive component has at minimum a role and accessible name. The `AriaRole` union type prevents typos in role assignment.
- **CI:** axe-core validates rendered component test fixtures against full WAI-ARIA requirements — including role-specific required properties not in the base interface. If a component renders without correct ARIA, CI fails.

**Dev-mode validation** (console warnings when components lack ARIA attributes) was considered but deferred. CI validation via axe-core provides the enforcement gate; dev-mode warnings can be added later as a developer experience improvement without changing the contract.

### Existing A11y Mixins

The four existing mixins in `pages-primitives/src/a11y/` are unchanged:

| Mixin | Responsibility |
|-------|---------------|
| FocusTrapMixin | Tab/Shift-Tab containment within a container |
| RovingTabindexMixin | Arrow-key navigation across focusable children |
| LiveRegionMixin | Screen reader announcements via `aria-live` |
| KeyboardShortcutMixin | Global keyboard shortcut registry |

These handle behavioural a11y (focus management, keyboard navigation, announcements). They are orthogonal to the ARIA attribute contract — components use whichever mixins are appropriate for their interaction pattern.

### Charts

ECharts components enable `aria.enabled` for built-in screen-reader descriptions plus an `aria-label` summary on the wrapper element. Charts are non-interactive for ARIA purposes — they provide textual descriptions, not actionable roles. The 15+ chart components (PagesBarChart, PagesLineChart, PagesPieChart, etc.) all follow this pattern.

### Shadow DOM Considerations

Known gotchas documented in the garden:
- **GE-20260713-777d8a:** `document.activeElement` returns host element across shadow boundaries. Focus comparisons must use `getDeepActiveElement()`.
- **GE-20260617-cc0834:** Keyboard event `e.target` retargets to host in shadow DOM. Global shortcut guards need deep active element walk via `isEditable()`.
- **GE-20260721-f094e6:** TypeScript mixin rejects abstract class (`Constructor<T>` requires concrete `new()`). This is why we use contract-as-types rather than mandatory mixins — the abstract base class pattern in pages conflicts with mixin composition.

## 2. In-Browser ARIA Navigation API (`@casehubio/pages-aria`)

A new package in the pages monorepo with three sub-path exports:

### `@casehubio/pages-aria/walker`

ARIA tree walker. Traverses the composed DOM tree (shadow DOM aware). Builds on the shadow DOM traversal patterns in `FocusTrapMixin.collectFocusable()` but collects by ARIA role + accessible name.

```typescript
findByRole(role: string, name: string, scope?: Element): Element | null;
findAllByRole(role: string, name?: string, scope?: Element): Element[];
getAccessibleName(element: Element): string;
getAriaState(element: Element): AriaState;
```

The `scope` parameter enables `within` targeting for disambiguation (D3).

### `@casehubio/pages-aria/executor`

Command executor mapping ARIA-action commands to DOM operations:

```typescript
click(target: AriaTarget): void;
fill(target: AriaTarget, value: string): void;
select(target: AriaTarget, option: string): void;
expand(target: AriaTarget): void;
collapse(target: AriaTarget): void;
assertState(target: AriaTarget, state: Partial<AriaState>): void;
waitFor(target: AriaTarget, state: Partial<AriaState>, timeout: number): Promise<void>;
```

`AriaTarget` is `{ role: string, name: string, within?: AriaTarget }`. Target resolution always goes through the walker.

### `@casehubio/pages-aria/server`

Dev/scenario mode only. Subscribes to `scenario/*` topics on the pages-push channel. Receives commands, executes via the executor, sends results back via the new `CommandResult` PushRequest variant. Not bundled in production — separate entry point, never imported by app code.

### Package Structure

Sub-path exports in `package.json` ensure tree-shakeability:

```json
{
  "exports": {
    "./walker": "./src/walker/index.ts",
    "./executor": "./src/executor/index.ts",
    "./server": "./src/server/index.ts"
  }
}
```

All three entry points are dev/test/scenario dependencies — not bundled in production application code. The client-only runner imports `walker` and `executor` in its test/scenario context. The `server` entry point is additionally scoped to scenarios with a backend push connection.

## 3. Scenario YAML Format and Command Model

### YAML Format

Declarative steps referencing components by ARIA role + name:

```yaml
scenario: helpdesk-intake
steps:
  - navigate: /helpdesk/intake
  - fill:
      role: textbox
      name: "Customer Name"
      value: "Alice Chen"
  - fill:
      role: textbox
      name: "Description"
      value: "Cannot access dashboard"
  - select:
      role: combobox
      name: "Priority"
      value: "High"
  - click:
      role: button
      name: "Submit"
  - assert:
      role: alert
      state: { aria-hidden: false }
  - wait:
      role: button
      name: "Submit"
      state: { aria-busy: false }
      timeout: 5000
```

Scoped targeting for ambiguous elements:

```yaml
  - click:
      role: button
      name: "Delete"
      within:
        role: row
        name: "Case #42"
```

### Command Vocabulary

| Command | Purpose | Target Required | Value/State |
|---------|---------|-----------------|-------------|
| navigate | Go to URL | No (URL string) | — |
| click | Click element | Yes | — |
| fill | Set text value | Yes | value (string) |
| select | Choose option | Yes | value (string) |
| expand | Expand container | Yes | — |
| collapse | Collapse container | Yes | — |
| assert | Verify ARIA state | Yes | state (map) |
| wait | Wait for state | Yes | state (map) + timeout (ms) |

### Java POJO Command Model

The YAML loads into Java records on the server side:

```java
public record ScenarioStep(String action, @Nullable AriaTarget target,
                           @Nullable String value,
                           @Nullable Map<String, Object> state,
                           @Nullable Integer timeout) {}

public record AriaTarget(String role, String name,
                         @Nullable AriaTarget within) {}

public record Scenario(String scenario, List<ScenarioStep> steps) {}
```

### Deferred Interactions

Some interactions don't map cleanly to ARIA roles and are out of scope for the initial command vocabulary: drag-and-drop, hover tooltips, canvas interactions within ECharts, and multi-touch gestures. These can be addressed later via escape hatches or additional commands without changing the foundation.

### Cross-Language Schema Sharing

JSON Schema is the single source of truth for the command model. The schema defines the YAML structure, and both Java POJOs and TypeScript types are validated against it. Integration tests verify both language implementations parse the same YAML identically — preventing drift between the Java and TypeScript representations.

### Two Runners

- **Server-side (Java):** Loads YAML into POJOs, sends commands to the browser via the pages-push extension. Orchestrates both server actions (API calls, database setup) and UI actions (ARIA commands) in a single scenario flow.
- **Client-only (TypeScript):** Loads the same YAML, calls the `@casehubio/pages-aria/executor` API directly in-process. No push transport needed — the walker and executor run in the same browser context.

## 4. Pages-Push Protocol Extension

The server-side runner requires extending pages-push for bidirectional command/response:

### Extension 1: Command Events on Scenario Topics

Server sends scenario commands as push events on `scenario/*` topics using the existing `PushMessage.event()` builder:

```java
PushMessage.event("scenario/command")
    .data(Map.of("id", correlationId,
                 "action", "click",
                 "target", Map.of("role", "button", "name", "Submit")))
    .build();
```

No new PushMessage type — just topic convention.

### Extension 2: New PushRequest Variant — `CommandResult`

The sealed `PushRequest` interface gets a new permitted variant:

```java
public record CommandResult(String id, boolean ok,
                           @Nullable String error) implements PushRequest {}
```

The `parse()` switch adds `case "command-result" -> new CommandResult(...)`. One new sealed variant, one new parse case.

### Client→Server Send Path (Already Exists)

`EventConnection` in `@casehubio/pages-data` already implements `send(message: object): void` — it serialises to JSON and writes to the WebSocket. No new TypeScript infrastructure needed for the client→server direction. The scenario handler in `@casehubio/pages-aria/server` uses this existing send path to return `CommandResult` responses.

Note: `EventConnection` lives in `pages-data` (`packages/pages-data/src/dataset/external/sources/event-connection.ts`), not in a push-specific package. The protocol extension touches both the Java push backend (new `CommandResult` variant) and the pages-data TypeScript package (new message type handling).

### Scope of Change

One new sealed variant in Java (`CommandResult`), one new parse case. The TypeScript send path already exists. The extension gives pages-push bidirectional command/response semantics reusable beyond scenario tooling.

## 5. MCP Integration

MCP tools let the LLM drive the UI through the ARIA tree.

### MCP Tools

| Tool | Description |
|------|-------------|
| `aria_find` | Find elements by role + name (with optional `within` scoping). Returns matching elements with ARIA state. |
| `aria_click` | Click an element by role + name |
| `aria_fill` | Fill a textbox/combobox by role + name |
| `aria_select` | Select an option in a combobox/listbox |
| `aria_expand` / `aria_collapse` | Toggle expandable elements |
| `aria_assert` | Verify ARIA state matches expectation |
| `aria_wait` | Wait for an ARIA state transition |
| `aria_snapshot` | Return the full ARIA tree as a structured summary |

`aria_snapshot` is the key LLM tool — compact semantic view of the entire page (role, name, state for every interactive element) without parsing DOM.

### MCP Server Location

Server-side, not in-browser. The MCP server is a separate process (or embedded in the Quarkus app) that proxies commands to the browser via the pages-push extension. MCP infrastructure belongs alongside platform server code, not in a `pages-*` TypeScript package.

### Relationship to Playwright MCP

Complementary, not replacing. The existing Playwright MCP gives full DOM access. The ARIA MCP tools provide a higher-level semantic interface. The LLM uses whichever is appropriate — ARIA tools for standard interactions, Playwright for edge cases ARIA doesn't cover.

## 6. Pages Widget Audit

ARIA audit of all interactive pages components, grouped by interaction pattern.

### Form/Input Pattern

| Component | Tag | Package | Current ARIA | Required Changes |
|-----------|-----|---------|-------------|-----------------|
| PagesInput | `pages-input` | pages-ui-components | aria-required, aria-invalid, role="alert" on error | Add aria-label on input element |
| PagesSelect | `pages-select` | pages-ui-components | aria-required, aria-invalid, role="alert" on error | Add aria-label |
| PagesTextarea | `pages-textarea` | pages-ui-components | aria-required, aria-invalid, role="alert" on error | Add aria-label |
| PagesCheckbox | `pages-checkbox` | pages-ui-components | aria-required, aria-invalid, role="alert" on error | Add aria-label |
| PagesDatePicker | `pages-date-picker` | pages-viz | aria-required, aria-invalid, aria-describedby | Add aria-label |
| PagesNumberInput | `pages-number-input` | pages-viz | aria-required, aria-invalid, aria-describedby | Add aria-label |
| PagesSchemaForm | `pages-schema-form` | pages-viz | aria-live region, role="form"/"group" | Add aria-label on form element |

### Button/Action Pattern

| Component | Tag | Package | Current ARIA | Required Changes |
|-----------|-----|---------|-------------|-----------------|
| PagesButton | `pages-button` | pages-ui-components | **None** | Add aria-label, aria-disabled, aria-busy |
| PagesActionButton | `pages-action-button` | pages-viz | aria-busy, aria-hidden on spinner | Add aria-label, aria-disabled |

### Grid/Table Pattern

| Component | Tag | Package | Current ARIA | Required Changes |
|-----------|-----|---------|-------------|-----------------|
| PagesDataTable | `pages-data-table` | pages-table | Full grid ARIA | **None — gold standard** |
| PagesGridTable | `pages-grid-table` | pages-viz | **None** | Add role="grid", aria-label, role="row", role="gridcell", role="columnheader" |
| PagesGroupedView | `pages-grouped-view` | pages-viz | Partial: aria-sort, aria-expanded | Add role="grid", aria-rowcount, aria-label |

### Dialog Pattern

| Component | Tag | Package | Current ARIA | Required Changes |
|-----------|-----|---------|-------------|-----------------|
| PagesConfirmDialog | `pages-confirm-dialog` | pages-ui-components | Full: role="alertdialog", aria-modal, aria-labelledby, FocusTrapMixin | **None** |

### Display/Status Pattern

| Component | Tag | Package | Current ARIA | Required Changes |
|-----------|-----|---------|-------------|-----------------|
| PagesBadge | `pages-badge` | pages-ui-components | role="status" | Add aria-label |
| PagesStatusDot | `pages-status-dot` | pages-ui-components | **None** | Add role="status", aria-label |
| PagesAlert | `pages-alert` | pages-viz | Partial: role on container | Add role="alert", aria-live="assertive", aria-label |
| PagesMetric | `pages-metric` | pages-viz | **None** | Add role="status", aria-label |
| PagesMeter | `pages-meter` | pages-viz | **None** | Add role="meter", aria-valuenow, aria-valuemin, aria-valuemax, aria-label |
| PagesCountdown | `pages-countdown` | pages-viz | aria-live="polite" | Add aria-label |
| PagesSelector | `pages-selector` | pages-viz | **None** | Add role="listbox", aria-label, aria-selected on options |

### Visualization Pattern (Charts)

All ECharts-based chart components have zero ARIA today. Each gets `aria.enabled` + `aria-label` summary on the wrapper:

PagesBarChart, PagesLineChart, PagesPieChart, PagesAreaChart, PagesScatterChart, PagesTimeseries, PagesTimeline, PagesBubbleChart, PagesGraph, PagesMap, PagesHeatmapChart, PagesTreemapChart (all `pages-viz`).

Non-ECharts: PagesDensityHeatmap gets `aria-label` only (custom canvas). PagesLegend is decorative (`aria-hidden` already set) — no changes needed.

### Utility Functions

| Function | Package | Recommendation |
|----------|---------|---------------|
| renderSparkline | pages-ui-components | Decorative SVG — add aria-hidden="true" |
| renderPropertyTree | pages-ui-components | Add role="list" for read-only display |

## 7. Blocks-UI Component Audit

Full ARIA pattern assignment for all ~40 blocks-ui components, grouped by interaction pattern.

### List/Grid Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| work-item-inbox | grid | grid, row, gridcell | aria-label, aria-rowcount, aria-selected, aria-sort |
| work-item-row | row | row, gridcell | aria-selected, aria-label (case summary) |
| work-item-workbench | application | application, toolbar, grid | aria-label, aria-busy |
| notification-inbox | list | list, listitem | aria-label, aria-live="polite" |
| session-list | list | list, listitem | aria-label, aria-selected |
| grouped-data-view | grid | grid, rowgroup, row, gridcell | aria-label, aria-rowcount |

### Tree Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| case-explorer | tree | tree, treeitem | aria-expanded, aria-level, aria-label |
| blocks-plan-item-tree | tree | tree, treeitem | aria-expanded, aria-level, aria-selected |
| blocks-decomposition-tree | tree | tree, treeitem | aria-expanded, aria-level, aria-label |

### Tabbed/Split Layout Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| split-workbench | region | region (x2), separator | aria-label per pane, aria-orientation |
| detail-pane | tablist | tablist, tab, tabpanel | aria-selected, aria-controls, aria-labelledby |
| session-workbench | region (via split-workbench) | region (x2), separator | inherits split-workbench ARIA |
| orchestration-workbench | region (via split-workbench) | region (x2), separator | inherits split-workbench ARIA |
| document-workbench | (sub-component collection) | — | no single workbench shell; ARIA per sub-component |
| contributor-workbench | region (via split-workbench) | region (x2), separator | inherits split-workbench ARIA |
| trust-workbench | region (via split-workbench) | region (x2), separator | inherits split-workbench ARIA |

### Detail/Display Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| work-item-detail | article | article, heading, list | aria-label, aria-labelledby |
| session-detail | article | article, heading | aria-label |
| routing-rationale | article | article | aria-label |
| trust-score-panel | img | img | aria-label (complex SVG gauge — role="img" is semantically correct) |
| trust-feedback-display | list | list, listitem | aria-label |
| sla-indicator | timer | timer | aria-label (countdown — role="timer" is semantically correct) |
| kpi-metric-row | group | group, meter | aria-label per metric |
| compliance-summary | status | status, list | aria-label, aria-live="polite" |
| similarity-panel | list | list, listitem | aria-label |

### Interactive Control Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| approval-gate | alertdialog | alertdialog, button | aria-label, aria-describedby |
| preferences-editor | form | form, group, textbox, checkbox | aria-label, aria-required, aria-invalid |
| gdpr-erasure-action | alertdialog | alertdialog, button | aria-label, aria-describedby |
| sla-breach-policy | form | form, group | aria-label |
| list-pane | listbox | listbox, option | aria-label, aria-selected, aria-activedescendant |

### Visualization Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| casehub-diagram | img | img | aria-label |
| swf-diagram | img | img | aria-label, aria-describedby |
| blocks-dag-viewer | img | img | aria-label |
| blocks-plan-model-dashboard | region | region, group, meter | aria-label per section |
| blocks-timeline | img | img | aria-label |
| execution-monitor | log + status | log, status | aria-live="polite", aria-label, aria-busy |
| commitment-viz | img | img | aria-label |
| channel-activity | log | log | aria-live="polite", aria-label |

### Conversation/Audit Pattern

| Component | ARIA Pattern | Roles | Key Attributes |
|-----------|-------------|-------|----------------|
| conversation-viewer | log | log, article | aria-live="polite", aria-label |
| audit-trail-viewer | log | log, article | aria-live="polite", aria-label, aria-busy |

## 8. CI Validation

axe-core runs in CI against rendered component test fixtures:

- **Integration:** `@axe-core/playwright` in the existing Playwright test infrastructure. Each component's test suite includes an accessibility audit step.
- **Scope:** All interactive components in pages and blocks-ui must pass axe-core with zero violations.
- **What it catches:** Missing roles, missing accessible names, invalid ARIA attribute values, missing required ARIA properties for declared roles, colour contrast violations.
- **What it doesn't catch:** Whether a component uses the correct ARIA pattern (e.g., a tree using list roles instead of tree roles). Pattern correctness is a code review concern, not automatable.

## Decisions

See [decisions.md](decisions.md) for the full decision log:

- **D1:** In-browser ARIA navigation API
- **D2:** Contract-as-types + axe-core CI (revised: dropped AriaController)
- **D3:** ARIA-action YAML command vocabulary with `within` scoping (revised: added scoping)
- **D4:** `@casehubio/pages-aria` package in pages monorepo
- **D5:** Pages-push protocol extension (revised: acknowledged protocol extension scope)

## 9. Follow-On Artifacts

Issue #417 scope includes two additional artifacts produced during implementation:

- **ADR:** "ARIA as the unified interaction model for accessibility and scenario automation" — formal architectural decision record, committed to `docs/adr/` in pages.
- **Platform protocol:** ARIA requirements for pages and blocks-ui components — standing convention committed to `docs/protocols/` in pages.

These are written during implementation, not during design — they codify the decisions and contract established in this spec.

**Relationship to pages#15:** The pages repo has an open issue #15 ("Accessibility: ARIA attributes, keyboard navigation, screen reader support"). Implementing parent#417 addresses the ARIA attribute and keyboard navigation aspects of pages#15. Whether pages#15 is fully closed depends on screen reader testing scope — this spec focuses on ARIA correctness, not end-to-end screen reader validation.

## Garden Provenance

Entries that informed this design:
- **GE-20260713-777d8a** — Shadow DOM `document.activeElement` returns host element
- **GE-20260617-cc0834** — Shadow DOM keyboard event retargeting
- **GE-20260721-f094e6** — TypeScript mixin rejects abstract class
- **GE-20260716-424a17** — ARIA combobox reference implementation (native `<select>` replacement)
