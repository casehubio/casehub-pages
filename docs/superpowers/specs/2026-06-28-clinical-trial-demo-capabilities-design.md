# Clinical Trial Demo — Platform Capabilities

**Epic:** #50 — Clinical trial demo — casehub-pages capabilities
**Date:** 2026-06-28
**Covers:** #37, #38, #39, #40, #41, #42, #43, #46, #47, #48, #49, #54
**Deferred:** #55 (Casehub* → Pages* rename — blocked on clinical shipping), #52/#53 (WebSocket provider — separate branch, compatible with this design)

## Problem

casehub-pages is a static dashboard runtime — data sources, content, and visibility are all fixed at YAML parse time. The platform has no concept of:

- Components that show/hide based on runtime state
- Content that interpolates runtime values
- Dataset URLs that resolve from filter context
- Write operations (POST back to a server)

The clinical trial demo (casehubio/clinical) is the first consumer that needs all of these. But these are platform capabilities, not clinical-specific features. Every capability designed here is domain-agnostic and reusable by any casehub-pages consumer.

## Architectural Decisions

- **Unified context resolution model** — #47 (conditional visibility), #48 (content interpolation), and #49 (parameterised URLs) share a single runtime context and template mechanism rather than three independent implementations.
- **Rich context (Approach B)** — the context includes filter state, dataset snapshots, page state, and parameters. Filter-only context (Approach A) was rejected because alerts and visibility conditions need dataset-aware values (row counts, first-row fields). Two-layer static/reactive split (Approach C) was rejected as premature optimisation.
- **`#{}` syntax for runtime templates** — distinct from the existing parse-time `${}` property substitution. No ambiguity, no backward-compatibility risk.
- **Shared HTTP action infrastructure** — #46 (action button) and #54 (form submit) both delegate to a common `ActionExecutor`. Designing them separately would produce two parallel implementations of the same mechanism.
- **Minimal expression language** — visibility and row styling conditions use a deliberately constrained grammar (comparisons, logical operators, no function calls). Complex logic belongs in the data pipeline, not the UI layer.
- **WebSocket compatibility** — the context model's reactivity handles WebSocket dataset pushes naturally. No design changes needed when #52/#53 are implemented later.
- **Naming convention** — all new components use the current `Casehub*` prefix. The rename to `Pages*` (#55) is deferred until casehubio/clinical ships its initial UI.

---

## 1. Context Resolution Model (#47, #48, #49)

### 1.1 RuntimeContext

The runtime maintains a context object capturing the current dashboard state:

```typescript
interface RuntimeContext {
  readonly filter: Record<string, readonly string[]>;
  readonly datasets: Record<string, DataSetSnapshot>;
  readonly page: { name: string; path: string };
  readonly params: Record<string, string>;
}

interface DataSetSnapshot {
  readonly rowCount: number;
  readonly columns: readonly string[];
  readonly first?: Record<string, string | number | null>;
}
```

- `filter` — active filter values keyed by columnId, page-scoped. Derived from the current page's `FilterState` via `deriveActiveFilters()`. Values are always `string[]` — a single-select filter produces a one-element array, not a bare string.
- `datasets` — metadata snapshots published after each dataset resolution. `rowCount` is the total rows in the **resolved dataset** (post-fetch, pre-cross-filter, pre-pagination). This is a stable count independent of per-component view state. Dashboard authors who need a count reflecting active filters should use a parameterised URL that applies filters server-side.
- `page` — current page/navigation state
- `params` — URL hash parameters and page-level properties

### 1.2 Template syntax

`#{path.to.value}` resolves at runtime and re-evaluates when context changes.

| Template | Resolves to |
|----------|-------------|
| `#{filter.ward}` | Active filter value for column "ward" |
| `#{datasets.patients.rowCount}` | Number of rows in the "patients" dataset |
| `#{datasets.patients.first.name}` | First row's "name" cell value |
| `#{page.name}` | Current page name |
| `#{params.trialId}` | URL parameter or page property |

**Array-valued filters:** `#{filter.ward}` resolves from `readonly string[]`. In string interpolation contexts (URLs, content), the first element is used. An empty array resolves to empty string. For expression semantics, see §1.3.

**Context-aware escaping:** The template resolver escapes interpolated values based on output context:

| Context | Escaping |
|---------|----------|
| `html:` / `markdown:` content | HTML-entity escape (`<` → `&lt;`, `"` → `&quot;`, etc.) |
| Dataset URL templates | `encodeURIComponent()` |
| Expression evaluation (visibility, row styling) | None — values are compared, not rendered |
| Action body/headers | None — values are data, not markup |

Escaping happens at interpolation time in the template resolver — input values remain raw in the context.

### 1.3 Expression language for conditions

Used by `visibleWhen` (#47) and row styling (#40). Minimal grammar — no function calls, no ternary. `#{}` expressions cannot be nested inside each other.

**Operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`

**Operator precedence** (standard, highest to lowest):

| Precedence | Operators |
|------------|-----------|
| 1 (highest) | `!` (unary NOT) |
| 2 | `>`, `<`, `>=`, `<=` |
| 3 | `==`, `!=` |
| 4 | `&&` |
| 5 (lowest) | `\|\|` |

**Parentheses** `()` are supported for explicit grouping:
```
(#{row.status} == 'Critical' && #{filter.showHighlights}) || #{row.daysOverdue} > 0
```

**Literals:** `'single-quoted strings'`, numeric literals, `true`, `false`, `null`

**Type coercion:** When both operands of a comparison (`>`, `<`, `>=`, `<=`) can be parsed as finite numbers, the comparison is numeric. Otherwise, operands are compared as strings. Equality operators (`==`, `!=`) use strict string comparison — no numeric coercion.

**Array-valued filter semantics:**
- Truthy check: `#{filter.ward}` → true if the array is non-empty
- Equality: `#{filter.ward} == 'ICU'` → true if the array contains `'ICU'`
- Numeric comparison: `#{filter.grade} >= 4` → uses the first element, coerced to number

**Examples:**
- Truthy check: `#{filter.ward}` — true if value exists and is non-empty
- Comparison: `#{filter.grade} >= 4`
- Equality: `#{row.status} == 'Critical'`
- Negation: `!#{filter.ward}`
- Logical AND: `#{filter.ward} && #{filter.status}`
- Grouped: `(#{row.status} == 'Critical' && #{filter.showHighlights}) || #{row.daysOverdue} > 0`

### 1.4 Reactivity

**Change-detection model:** Object replacement. Each context change produces a new `RuntimeContext` reference. The runtime retains the previous reference for comparison.

**Consumer lifecycle:**

- **Registration:** Automatic during `connectedCallback`. The runtime scans the component's props for `#{}` patterns and registers matching components as context consumers. On registration, the runtime **immediately evaluates** all expressions against the current context and applies effects. This handles both first-ever activation and re-activation after a lazy container (tabs, pills, sidebar, carousel, stack) swaps the component back in.
- **Deregistration:** Automatic during `disconnectedCallback`. Components torn down by lazy container slot swaps are removed from the consumer set and do not receive context updates while inactive.
- **Re-activation:** When a user switches back to a tab containing context-dependent components, `connectedCallback` fires, the component re-registers, and all expressions are evaluated against the current (possibly changed) context. No stale state survives the DOM round-trip.

**Evaluation pass:** When context changes (filter applied, dataset resolved, page navigated):

1. Runtime creates a new `RuntimeContext` with the updated state
2. For each registered consumer, re-evaluates its `#{}` templates/conditions
3. Compares each resolved value against the consumer's previous resolved value
4. If changed, applies the effect:
   - **Dataset URL** (#49) → re-fetch the dataset (see §1.9)
   - **Visibility** (#47) → show/hide the component via CSS `display: none`
   - **Content** (#48) → re-render the text
   - **Row style** (#40) → re-render the table

**Cascade termination:** A dataset re-fetch (triggered by a URL template resolving to a new URL) updates the `datasets.*` portion of the context, which triggers another evaluation pass. Cascades terminate because:

- URL consumers whose templates resolve to the **same URL as before** do not re-fetch
- Visibility/content consumers that resolve to the **same value as before** do not re-render
- No consumer effect feeds back into `filter` or `page` state — these are updated only by user interaction or explicit navigation

Worst case for a single filter change: filter context update → URL re-evaluation → fetch → dataset snapshot update → visibility/content re-evaluation. Two evaluation passes, bounded fetches (one per parameterised dataset whose URL actually changed).

### 1.5 `visibleWhen` property

New property on the base `Component` type in `pages-component/model/types.ts`. Accepts a context expression string. When the expression evaluates to falsy, the component's DOM element receives `display: none`. When truthy, the display is restored.

Distinct from the existing `visible?: boolean` on `DataComponentCommon` and `IframePluginProps`, which is static visibility set at parse time. `visibleWhen` is runtime-evaluated. When both are present, `visibleWhen` takes precedence.

### 1.6 YAML integration

```yaml
# #49 — Parameterised dataset URL
datasets:
  - uuid: site_patients
    url: "/api/trials/#{filter.trialId}/sites/#{filter.siteId}/patients"

# #47 — Conditional visibility
- displayer:
    type: TABLE
    visibleWhen: "#{filter.patientId}"
    lookup:
        uuid: patient_vitals

# #48 — Content interpolation
- markdown:
    content: "## #{filter.ward} Ward\n\n#{datasets.patients.rowCount} patients"
```

### 1.7 Package placement

| What | Package |
|------|---------|
| `RuntimeContext`, `DataSetSnapshot` types | `@casehubio/pages-component/context/` |
| Template parser (string → resolved value) | `@casehubio/pages-component/context/` |
| Expression evaluator (string → boolean) | `@casehubio/pages-component/context/` |
| `visibleWhen` property on `Component` | `@casehubio/pages-component/model/types.ts` |
| Context wiring (state tracking, consumer registration, cascade) | `@casehubio/pages-runtime` |

Template parser and expression evaluator are pure functions with zero dependencies.

### 1.8 Row-scoped context

Row styling conditions (#40) receive an extended context with a `row.*` namespace providing cell values for the current row. Row conditions can reference both row data and global context:

```yaml
condition: "#{row.status} == 'Critical' && #{filter.showHighlights}"
```

### 1.9 Parameterised dataset URL resolution

Template resolution for dataset URLs happens in `@casehubio/pages-runtime`, not in `@casehubio/pages-data`. The runtime calls the template parser (pure function from `pages-component/context/`) with the URL template and current `RuntimeContext`, then passes the resolved concrete URL to the data pipeline. The data pipeline never sees `#{}` templates — it receives plain URLs. This preserves the correct dependency direction (`pages-runtime` → `pages-component`, `pages-runtime` → `pages-data`; `pages-data` never imports from `pages-component`).

**Deferred fetch:** If any `#{}` variable in a dataset URL is unresolved (references a filter or param that has no value), the fetch is suppressed. The dataset remains in a pending state with no `DataSetSnapshot` published. Components bound to that dataset render their empty/loading state. Once all variables resolve, the fetch proceeds normally.

**Request cancellation:** When a parameterised URL resolves to a new value while a fetch for the previous URL is in-flight, the runtime aborts the stale request via `AbortController` before dispatching the new fetch. The data pipeline's `pendingResolutions` map is updated to track the new request. This prevents out-of-order response races.

---

## 2. HTTP Action Infrastructure (#46, #54)

### 2.1 ActionExecutor

Shared execution logic consumed by both the action button component and form submit.

```typescript
interface ActionRequest {
  readonly url: string;
  readonly method: 'POST' | 'PUT' | 'DELETE';
  readonly headers?: Record<string, string>;
  readonly body?: Record<string, unknown> | string;
}

interface ActionCallbacks {
  readonly onSuccess?: {
    readonly refresh?: DataSetId[];
    readonly message?: string;
  };
  readonly onError?: {
    readonly message?: string;
  };
}
```

**Host fetch injection:** `ActionExecutor` is constructed with the host-provided `fetch` function and `baseUrl` from `SiteOptions` — the same values used by the data pipeline's `ResolverContext.providerFactory`. This ensures action requests carry authentication headers, CSRF tokens, and base URL resolution consistent with data fetches. `ActionExecutor` never uses `globalThis.fetch` directly.

Execution flow:

1. Resolve all `#{}` templates in URL, body values, and headers against the current `RuntimeContext`
2. Send HTTP request via the host-provided `fetch`
3. Classify response: success (2xx), client error (4xx), server error (5xx)
4. On success: dispatch `casehub-action-complete` event with `refresh` dataset IDs
5. On error: return error detail for the component to display
6. Runtime handles `casehub-action-complete` by re-fetching specified datasets and pushing to all subscribing components

Lives in `@casehubio/pages-runtime/action.ts`.

### 2.2 Action Button (`<casehub-action-button>`) — #46

A content component (no dataset lookup). Renders a `<button>` in shadow DOM.

```typescript
interface ActionButtonProps {
  readonly label: string;
  readonly url: string;
  readonly method?: 'POST' | 'PUT' | 'DELETE';
  readonly body?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
  readonly confirm?: string;
  readonly style?: 'primary' | 'danger' | 'secondary';
  readonly disabled?: string;
  readonly onSuccess?: { refresh?: DataSetId[]; message?: string };
  readonly onError?: { message?: string };
}
```

YAML:

```yaml
- action-button:
    label: "Submit Report"
    url: "/api/trials/#{filter.trialId}/deviations"
    method: POST
    body:
      type: "#{filter.deviationType}"
      severity: "#{filter.severity}"
    confirm: "Submit this deviation report?"
    style: primary
    onSuccess:
      refresh: [deviations, audit_trail]
      message: "Report submitted"
```

Lifecycle: idle → click → confirm dialog (if configured) → loading (disabled + spinner) → success/error → idle.

Extends `CasehubElement<ActionButtonProps>`. Registered as a content component alongside `html:`, `markdown:`, `alert:` — not under `displayer:`.

### 2.3 Form Submit — #54

New `submit` prop on form input components. When present, the input POSTs its value on Enter instead of binding to a dataScope.

```typescript
interface SubmitConfig {
  readonly url: string;
  readonly method?: 'POST' | 'PUT';
  readonly fieldName?: string;
  readonly clearOnSubmit?: boolean;
  readonly onSuccess?: { refresh?: DataSetId[]; message?: string };
  readonly onError?: { message?: string };
}
```

YAML:

```yaml
- text-input:
    field: message
    placeholder: "Type a message..."
    submit:
      url: "/api/channels/#{filter.channelId}/messages"
      method: POST
      clearOnSubmit: true
```

When `submit` is present, the form input operates independently of `dataScope`. On Enter: calls `executeAction()` with the field value in the body. On success: clears the field (if `clearOnSubmit`), triggers dataset refresh. On error: shows inline error, preserves field value.

### 2.4 New event

```typescript
interface CasehubActionCompleteDetail {
  readonly refresh: DataSetId[];
}
```

Dispatched by action button and form submit. The runtime listens and re-fetches the listed datasets.

### 2.5 Package placement

| What | Package |
|------|---------|
| `ActionButtonProps`, `SubmitConfig` types | `@casehubio/pages-component/model/` |
| `ActionExecutor` | `@casehubio/pages-runtime/action.ts` |
| `<casehub-action-button>` Web Component | `@casehubio/pages-viz/components/` |
| Form submit behavior | Extends `CasehubFormInput` in `@casehubio/pages-viz/form-inputs/` |
| `action-button:` desugar mapping | `@casehubio/pages-ui/parser/` |

---

## 3. New Visualization Components (#37, #38, #39, #41, #43)

### 3.1 Alert Banner (`<casehub-alert>`) — #38

Content component — no dataset lookup. Uses context interpolation for dynamic content and conditional visibility.

```typescript
interface AlertProps {
  readonly severity: 'info' | 'warning' | 'error' | 'success';
  readonly content: string;
  readonly dismissible?: boolean;
}
```

YAML:

```yaml
- alert:
    severity: warning
    content: "#{datasets.overdue_items.rowCount} items past deadline"
    visibleWhen: "#{datasets.overdue_items.rowCount} > 0"
    dismissible: true
```

Renders a styled banner in shadow DOM with severity-based colors using CSS custom properties. Dismissible alerts add a close button (resets on context-triggered re-render). Registered as a content component alongside `html:`, `markdown:`, `title:`.

### 3.2 Status Badge (`<casehub-badge>`) — #39

Data component — bound to a dataset via lookup. Renders styled label tags from column values.

```typescript
interface BadgeProps extends DataComponentCommon {
  readonly column?: ColumnId;
  readonly colorMap?: Record<string, string>;
}
```

YAML:

```yaml
displayer:
  type: BADGE
  lookup:
    uuid: deviations
    filter:
      - column: id
        function: EQUALS_TO
        args: ["#{filter.deviationId}"]
  badge:
    column: status
    colorMap:
      PENDING: "#fac858"
      APPROVED: "#91cc75"
      REJECTED: "#ee6666"
```

Extends `CasehubElement<BadgeProps>`. For each row in the dataset, renders a `<span class="casehub-badge">` with background color from `colorMap` (falls back to a palette derived from `--casehub-accent`). Single-row datasets show one badge; multi-row shows a row of badges.

### 3.3 Countdown (`<casehub-countdown>`) — #43

Data component with an internal render timer. Reads a deadline date from the dataset and continuously updates the time remaining.

```typescript
interface CountdownProps extends DataComponentCommon {
  readonly deadlineColumn?: ColumnId;
  readonly format?: 'full' | 'compact' | 'days-only';
  readonly warningThreshold?: string;
  readonly criticalThreshold?: string;
}
```

YAML:

```yaml
displayer:
  type: COUNTDOWN
  general:
    title: "SLA Deadline"
  lookup:
    uuid: active_items
  countdown:
    deadlineColumn: deadline
    warningThreshold: "24h"
    criticalThreshold: "4h"
```

Extends `CasehubElement<CountdownProps>` — not a MetricProps subtype. Reason: needs its own render timer (ticking per second for <1h, per minute for >1h) independent of the data refresh timer. On dataset arrival, reads the deadline from the first row. Starts a `setInterval` that recalculates and re-renders the time delta. Changes color at warning/critical thresholds. Shows "EXPIRED" with critical styling when past deadline. Timer cleared in `disconnectedCallback`.

### 3.4 Timeline (`<casehub-timeline>`) — #37

ECharts chart component using custom series to render horizontal duration bars on a time axis.

```typescript
interface TimelineProps extends DataComponentCommon, ChartSettings {
  readonly startColumn?: ColumnId;
  readonly endColumn?: ColumnId;
  readonly labelColumn?: ColumnId;
  readonly categoryColumn?: ColumnId;
}
```

YAML:

```yaml
displayer:
  type: TIMELINE
  general:
    title: "Event Timeline"
  lookup:
    uuid: events
  timeline:
    startColumn: startDate
    endColumn: endDate
    labelColumn: description
    categoryColumn: category
```

Extends `CasehubChartElement<TimelineProps>`. Uses ECharts `type: 'custom'` with `renderItem` to draw horizontal bars from start to end on a time x-axis. Category axis on y-axis groups items. Rows with null `endColumn` render as diamond milestone markers. Supports all standard ChartSettings (legend, margin, zoom, extra).

### 3.5 Graph (`<casehub-graph>`) — #41

ECharts chart component using the graph series for network/relationship visualization.

```typescript
interface GraphProps extends DataComponentCommon, ChartSettings {
  readonly layout?: 'force' | 'circular' | 'none';
  readonly sourceColumn?: ColumnId;
  readonly targetColumn?: ColumnId;
  readonly valueColumn?: ColumnId;
  readonly directed?: boolean;
}
```

YAML:

```yaml
displayer:
  type: GRAPH
  general:
    title: "Relationship Network"
  lookup:
    uuid: edges
  graph:
    layout: force
    sourceColumn: from
    targetColumn: to
    valueColumn: weight
    directed: true
```

Extends `CasehubChartElement<GraphProps>`. Dataset rows represent edges. Nodes are derived from distinct values across source and target columns. `buildOption()` constructs ECharts `{ nodes: [...], links: [...] }`. Supports all standard ChartSettings.

### 3.6 Registration

| Component | Tag | Extends | Category |
|-----------|-----|---------|----------|
| Alert | `<casehub-alert>` | `CasehubElement<AlertProps>` | Content (`alert:`) |
| Badge | `<casehub-badge>` | `CasehubElement<BadgeProps>` | Displayer (`type: BADGE`) |
| Countdown | `<casehub-countdown>` | `CasehubElement<CountdownProps>` | Displayer (`type: COUNTDOWN`) |
| Timeline | `<casehub-timeline>` | `CasehubChartElement<TimelineProps>` | Displayer (`type: TIMELINE`) |
| Graph | `<casehub-graph>` | `CasehubChartElement<GraphProps>` | Displayer (`type: GRAPH`) |

All registered in `custom-elements.ts`. Props types in `displayer-types.ts` (Badge, Countdown, Timeline, Graph) or `component-props.ts` (Alert). Desugar mappings in `displayer-desugar.ts`.

---

## 4. Table Enhancements (#40, #42)

### 4.1 Row-level conditional styling — #40

New `rowStyle` prop on `TableProps`:

```typescript
interface RowStyleRule {
  readonly condition: string;
  readonly className?: string;
  readonly style?: Record<string, string>;
}

// Added to TableProps:
readonly rowStyle?: readonly RowStyleRule[];
```

YAML:

```yaml
displayer:
  table:
    sortable: true
    rowStyle:
      - condition: "#{row.status} == 'Critical'"
        className: casehub-row-danger
      - condition: "#{row.daysOverdue} > 0"
        className: casehub-row-warning
      - condition: "#{row.resolved} == 'true'"
        className: casehub-row-muted
```

**Evaluation:** During `render()`, for each row, the table creates a row-scoped context (global `RuntimeContext` + `row.*` namespace) and evaluates each rule. First matching rule wins. The matching className or inline style is applied to the `<tr>`.

**Predefined CSS classes** in shadow DOM:

| Class | Effect |
|-------|--------|
| `casehub-row-danger` | Red-tinted background |
| `casehub-row-warning` | Yellow-tinted background |
| `casehub-row-success` | Green-tinted background |
| `casehub-row-muted` | Grey/dimmed text and background |

All use CSS custom properties (`--casehub-row-danger-bg`, etc.) for theme overrides. Dashboard authors can also use `style:` for arbitrary inline CSS.

### 4.2 Expandable rows (tree-table) — #42

New `expandable` prop on `TableProps`:

```typescript
interface ExpandableConfig {
  readonly idColumn: ColumnId;
  readonly parentColumn: ColumnId;
  readonly defaultExpanded?: boolean | number;
}

// Added to TableProps:
readonly expandable?: ExpandableConfig;
```

YAML:

```yaml
displayer:
  table:
    sortable: true
    expandable:
      idColumn: id
      parentColumn: parentId
      defaultExpanded: 1
```

**Data model:** Flat dataset with self-referencing parent/child structure. Each row has an `id` and a `parentId`. Rows with null/empty `parentId` are roots.

**Rendering:**

1. On dataset arrival, build tree index: `Map<id, childRows[]>`, identify root rows
2. Initially render root rows with expand/collapse toggle (`▶`/`▼`) if they have children
3. `defaultExpanded: 1` auto-expands roots to show first-level children
4. Child rows render with visual indentation (padding-left scales with depth)
5. Click toggle → show/hide children recursively

**Interaction with other table features:**

- **Sorting:** Sorts within each level (siblings sorted among siblings)
- **Pagination:** Applies to **root rows only**. Page boundaries are determined by root row count. Expanding a root row reveals its children within the current page without pushing other roots to the next page. This avoids disorienting row-push effects and orphaned children on subsequent pages.
- **Filtering:** If a child matches but its parent doesn't, the parent is shown as a non-matching context row (dimmed) to preserve hierarchy.

Expand/collapse state is local to the component, not persisted in view state.

---

## 5. Implementation Phasing

### Layer 1 — Foundation

| Step | What | Issue |
|------|------|-------|
| 1 | Context types, template parser, expression evaluator | #47, #48, #49 |
| 2 | Context wiring in runtime (state tracking, consumer registration, cascade) | #47, #48, #49 |
| 3 | `visibleWhen` property on Component model | #47 |
| 4 | Content interpolation in markdown/html/title | #48 |
| 5 | Parameterised dataset URLs | #49 |

### Layer 2 — New components (depends on Layer 1)

| Step | What | Issue |
|------|------|-------|
| 6 | ActionExecutor shared infrastructure | #46, #54 |
| 7 | Action button component | #46 |
| 8 | Form submit prop | #54 |
| 9 | Alert banner | #38 |
| 10 | Badge component | #39 |
| 11 | Countdown component | #43 |
| 12 | Timeline component | #37 |
| 13 | Graph component | #41 |

### Layer 3 — Table enhancements (depends on Layer 1 for row context, parallel with Layer 2)

| Step | What | Issue |
|------|------|-------|
| 14 | Row-level conditional styling | #40 |
| 15 | Expandable rows (tree-table) | #42 |

### Post-implementation

- Update `Clinical/Patient Tracker` example dashboard to exercise new capabilities with inline mock data
- Playwright tests for new components and features

### Deferred

| Issue | What | Blocked by |
|-------|------|------------|
| #55 | `Casehub*` → `Pages*` rename | Clinical shipping initial UI |
| #52 | WebSocket dataset provider | Separate branch (connectors concern) |
| #53 | WebSocket multiplexing | Depends on #52 |

---

## 6. WebSocket Compatibility (#52, #53)

The context model handles WebSocket dataset pushes with no changes:

1. WebSocket provider updates a dataset via `DataSetManager.accumulate()` or `.register()`
2. Runtime publishes a new `DataSetSnapshot` to `RuntimeContext`
3. All context consumers re-evaluate (visibility, content, parameterised URLs)
4. Components with `visibleWhen: "#{datasets.messages.rowCount} > 0"` react to live data
5. `casehub-action-complete` event's dataset refresh works with WebSocket datasets — the runtime triggers a re-subscribe or requests a fresh snapshot

No design modifications needed. The WebSocket provider is a new data source type in the pipeline, not a context model change.
