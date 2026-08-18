## D1: Template resolution mechanism for hostPanel panelProps

**Choice:** ContextManager consumer registration (reactive)
**Alternatives:**
- Point-in-time resolution at activation — resolves once at mount, no updates on context change; breaks master-detail because selection changes after mount
- Defer to panel (pass raw template strings) — panels shouldn't know about the template system; breaks encapsulation
**Rationale:** Consistent with how title/html/markdown/alert components resolve templates. The ConfigurablePanel contract explicitly supports re-entry ("configure() may be called again after initial render"). ContextManager handles all relevant namespaces: filter, params, datasets, page, selection.
**Trade-offs:** Adds a consumer per host panel with template props; minor overhead on every context change evaluation cycle.
**Sources:** activation.ts:388-440 (title/html/markdown pattern), context-wiring.ts:38-174 (ContextManager), ConfigurablePanel spec (2026-07-06)
**Exploration:** quick
**Status:** captured

## D2: `#{row.xxx}` scope

**Choice:** Out of scope — not resolvable through ContextManager
**Alternatives:**
- Add `updateRow()` to ContextManager — architecturally wrong because row is per-instance (two expanded row-details have different rows), ContextManager is a shared singleton
- Convenience alias from `#{row.xxx}` to `#{selection.xxx}` — ambiguous (which dataset?), error-prone
**Rationale:** `row` on RuntimeContext is optional, set locally via `createRowContext()`. ContextManager tracks selection (global, reactive), not row (local, per-instance). The master-detail use case from scaffold #48 should use `#{selection.datasetId.field}`. If row-detail host panels need per-row props, the table component should resolve locally — a separate issue.
**Trade-offs:** Users must use `#{selection.datasetId.field}` instead of the more intuitive `#{row.field}` for master-detail.
**Sources:** types.ts:1-8 (RuntimeContext.row is optional), expression-evaluator.ts:8-16 (createRowContext), context-wiring.ts:71-78 (updateSelection)
**Exploration:** deep-analysis
**Status:** captured

## D3: Prop resolution depth

**Choice:** Recursive resolution of nested objects and array elements
**Alternatives:**
- Top-level strings only — misses nested config like `{ headers: { Authorization: "Bearer #{params.token}" } }`
- Nested objects only, arrays pass through — misses array-nested templates like endpoint lists or parameterized column names
**Rationale:** Extends `action.ts`'s `resolveBodyTemplates` recursion pattern to also walk array elements. panelProps can contain arrays of parameterized values (endpoint lists, filter values). Array elements are walked the same as object values: strings are resolved, objects are recursed, primitives pass through.
**Trade-offs:** None significant — recursion depth bounded by panelProps structure which is small.
**Sources:** action.ts:86-108 (resolveBodyTemplates — pattern to extend)
**Exploration:** quick
**Status:** revised — extended to include array element resolution per R1-08

## D4: Escape mode

**Choice:** `"none"` for all panelProps values
**Alternatives:**
- Per-prop escape mode metadata — overengineered; the panel is responsible for any escaping it needs in its own rendering
**Rationale:** panelProps are programmatic configuration values consumed by the panel's TypeScript code, not rendered directly as HTML/URL. The panel decides how to use them.
**Trade-offs:** None — consistent with how action body templates use "none".
**Sources:** action.ts:94 (resolveTemplate with "none")
**Exploration:** quick
**Status:** captured

## D5: Initial mount with unresolved template vars

**Choice:** Defer configure() until all template vars in panelProps resolve to non-empty values
**Alternatives:**
- Always call configure() with empty strings for unresolved vars — harmless for visual components (title/html text) but panelProps can contain URLs, endpoints, WebSocket addresses where empty or partial values trigger harmful side effects (invalid network requests, error states that flash before real data arrives)
- Per-prop deferral — overengineered; panel can't function with a partial set of resolved props anyway
**Rationale:** panelProps values are programmatic configuration consumed by panel TypeScript code. Unlike title/html/markdown (where empty text is a valid visual state), panelProps can drive network connections, API calls, and WebSocket subscriptions. Calling configure() with empty or partial template values causes wasted work and potential errors. Panels render a default empty state from constructor/connectedCallback; the first configure() arrives when all template vars are available. Uses `allTemplateVarsResolved()` from template-parser.ts — same gate as data-pipeline.ts URL deferral.
**Trade-offs:** Changes the ConfigurablePanel timing guarantee. The current hosting.ts JSDoc says "configure(props) is called before the element is appended to the DOM — before connectedCallback() fires." With deferral, when panelProps contain template variables: (1) configure() is NOT called before attachment, (2) el.appendChild(panel) executes — connectedCallback fires, (3) later, when all vars resolve, postEvaluate() calls configure(). The hosting.ts JSDoc must be updated to reflect conditional timing: configure() is called before attachment when all prop values are immediately available; when panelProps contain template variables, configure() is deferred until all variables resolve — connectedCallback fires first. Panels must handle both orderings and have a valid default state. This is compatible with the existing "Re-configuration" clause — panels already handle re-entry — the change is that the first call may also come after connection.
**Sources:** data-pipeline.ts:575-590 (allTemplateVarsResolved pattern), template-parser.ts:96-114 (allTemplateVarsResolved), ConfigurablePanel hosting.ts:1-18 (contract — timing guarantee must be updated for template props)
**Exploration:** quick
**Status:** revised — changed from always-call to deferred per R1-12; contract timing updated per R2-02

## D6: Multi-template consumer batching

**Choice:** Add optional `postEvaluate()` hook to ContextConsumer — called once after all templates in the consumer have been evaluated in a single cycle
**Alternatives:**
- Accept multiple configure() calls per context change — wasteful when panels do expensive work (network calls, WebSocket connections) in configure(); intermediate-state calls cause flickering and invalid requests
- Single aggregate template string — impractical for arbitrary nested prop structures with multiple template vars
- queueMicrotask batching — introduces async gap between template resolution and configure(), complicating ordering guarantees with selectionSource events
**Rationale:** Title/html/markdown consumers have a single template entry and don't need batching. Host panel consumers may have multiple template props, each registered as a separate entry in the consumer's templates Map. Without batching, `#evaluateConsumer()` calls each entry's `apply` individually — intermediate states reach the panel. The postEvaluate hook fires once per consumer per evaluation cycle, after all template entries are processed. The host panel's `apply` callbacks store resolved values in a local props object; `postEvaluate` calls `configure()` once with the complete set.
**Trade-offs:** Adds one optional field to ContextConsumer interface. Existing consumers (title, html, markdown) don't set it — no impact on current behavior.
**Sources:** context-wiring.ts:126-141 (#evaluateConsumer template loop)
**Exploration:** surfaced by review (R1-02)
**Status:** captured

## D7: Consumer element reference for host panel lifecycle

**Choice:** Use the wrapper `el` (not the panel DOM element) as `consumer.element`
**Alternatives:**
- Use the panel DOM element — detaches lifecycle from the layout engine's DOM management; panel may be re-created on configure() while wrapper persists
**Rationale:** ContextManager prunes stale consumers by checking `consumer.element.isConnected` (context-wiring.ts:112-118). The wrapper `el` is managed by the layout engine — removed from DOM when the component is torn down or page navigates away. Using the wrapper ensures the consumer is pruned when the host panel's layout slot is removed. For lazily-rendered tabs, the wrapper stays connected while the tab exists, keeping the consumer active for background updates — correct behavior since the consumer should have current values when the tab becomes visible.
**Trade-offs:** None — consistent with all existing consumers which use the wrapper `el` as element reference.
**Sources:** context-wiring.ts:112-118 (consumer pruning), activation.ts:841-882 (registerContentConsumer pattern using el)
**Exploration:** surfaced by review (R1-14)
**Status:** captured

## D8: selectionSource and template props composition

**Choice:** Complementary mechanisms — selectionSource delivers raw row objects via DOM events, template props deliver resolved string values via configure()
**Alternatives:**
- Mutual exclusion (one or the other) — limits flexibility; panels needing both raw data and resolved string config would require workarounds
- Template props subsume selectionSource — template resolution produces strings, not objects; can't replace the raw row object needed for complex panel logic
- selectionSource subsumes template props — event listeners for individual field values would be boilerplate-heavy; configure() is the established contract for panel configuration
**Rationale:** The two mechanisms serve different purposes and fire on the same trigger (selection change) with deterministic ordering. In site.ts:685-693, when a selection-change fires: (1) `contextManager.updateSelection()` runs first, triggering `evaluateAll()` — template consumers fire configure() with resolved string values; (2) `dispatchSelectionToHostPanels()` runs second, dispatching `pages-selection-changed` events with the raw row object. Ordering is deterministic and synchronous. Developer guidance: use template props for simple string configuration values (IDs, URLs, labels); use selectionSource for full row objects when the panel needs rich data.
**Trade-offs:** Panels using both receive two calls per selection change (configure + event). Acceptable — the calls serve different purposes and panels needing only one mechanism only use one.
**Sources:** site.ts:685-693 (both calls in sequence), selection-forwarding.ts:6-27 (dispatchSelectionToHostPanels), context-wiring.ts:96-105 (evaluateAll triggered by updateSelection)
**Exploration:** surfaced by review (R1-03, R1-15)
**Status:** captured
