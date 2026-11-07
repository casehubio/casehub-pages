# TypeScript/Java YAML Runtime Parity Audit

**Issue:** casehubio/casehub-pages#608
**Date:** 2026-11-07
**Scope:** yaml-core (TS) vs yaml-core + yaml-step-runtime + yaml-plugin-api + yaml-test-core (Java)
**In-progress platform issues:** #735 (combined-key invoke shorthand), #742 (capture:/name: step-level keys)

---

## Executive Summary

The Java YAML runtime has undergone extensive development through epic platform#702 (YAML Playbook Polish). The TypeScript yaml-core in pages has maintained parity on structural foundations — step types, module system, orchestration primitives, and simulation runtime — but has fallen behind on the type system, annotations, error handling, test infrastructure, and several Walker-level features.

**27 gaps identified**, categorized by severity:

| Severity | Count | Headline |
|----------|-------|----------|
| Critical | 4 | Scalar subject naming, capture keyword, absorbSiblings, annotations field on steps |
| High | 8 | Annotation system, type-aware expressions, typed errors, test infrastructure, agent sessions, missing keywords, dual-registration, Result.detail |
| Medium | 9 | Combined-key prefixes, concurrent keyword, pools/orchestration, ControlStep, FusedPipelineStep, SimulateBlockParser, decorator ordering, vars/params naming, AgentBinding fields |
| Low | 4 | OnCompleteExpander drift, decorator badge rendering, action icon coverage, step-viewer gaps |
| Tracking | 2 | #735 combined-key invoke shorthand, #742 name: key (neither started) |

---

## Part 1 — Keyword-Level Parity

### DECORATOR_KEYS

**23 shared:** `if`, `on-success`, `on-failure`, `forEach`, `loop`, `retry`, `timeout`, `delay`, `on-error`, `trigger`, `transform`, `signal`, `publish`, `transition`, `semaphore`, `barrier`, `quorum`, `when`, `mutex`, `wait`, `from`, `cancel`, `background`

| Key | Java | TS | Gap |
|-----|------|----|-----|
| `at` | YES | NO | **MISSING** — temporal trigger. TS DecoratorChain has AtDecorator but Walker rejects the key |
| `on-complete` | YES | NO | **MISSING** — completion callback. OnCompleteExpander exists but key not in RESERVED_KEYS |
| `resource` | YES | NO | **MISSING** — resource binding. DecoratorChain has PrioritySemaphoreDecorator but Walker rejects |
| `priority` | YES | NO | **MISSING** — execution priority. DecoratorChain reads it but Walker rejects |
| `capture` | YES | NO | **MISSING** — output capture (#742). Not in DECORATOR_KEYS or RESERVED_KEYS |
| `label` | NO | YES | TS-only — visualization/swim-lane |
| `target` | NO | YES | TS-only — swim-lane target |
| `actor` | NO | YES | TS-only — swim-lane actor |
| `speed` | NO | YES | TS-only — simulation speed |
| `content` | NO | YES | TS-only — content decorator |
| `await` | NO | YES | TS-only — await decorator |
| `mode` | NO | YES | TS-only — mode decorator |
| `simulation` | NO | YES | TS-only — simulation decorator |

### COMBINED_KEY_PREFIXES

**13 shared:** `forEach`, `retry`, `timeout`, `when`, `mutex`, `loop`, `block`, `parallel`, `try`, `select`, `race`, `if`, `match`

| Prefix | Java | TS | Gap |
|--------|------|----|-----|
| `barrier` | YES | NO | **MISSING** — `barrier myBarrier:` won't parse |
| `quorum` | YES | NO | **MISSING** — `quorum 3-of-5:` won't parse |

### PROMOTABLE_DECORATORS — Full parity

Both: `forEach`, `retry`, `timeout`, `when`, `mutex`, `loop`

### STRUCTURAL_KEYS

Both handle: `step`, `invoke`, `then`, `else`, `match`, `cases`, `block`, `try`, `catch`, `finally`, `select`, `parallel`, `race`

| Key | Java | TS | Gap |
|-----|------|----|-----|
| `pause` | YES (→ ControlStep) | NO — not in RESERVED_KEYS, would throw | **MISSING** |
| `resume` | YES (→ ControlStep) | NO — same | **MISSING** |
| `emit-event` | via plugin | YES (→ EmitEventStep) | TS-only design choice |
| `emit-to` | N/A | YES | TS-only |

---

## Part 2 — Step Type Parity

### ResolvedStep Variants

| Step Type | Java | TS | Gap |
|-----------|------|----|-----|
| PluginStep | YES | YES | **DRIFT** — Java: `(name, actionName, params, decorators, annotations)`. TS: `(name, entry: CatalogEntry, params, decorators)` — no `actionName`, no `annotations`, has `entry` |
| InvokeStep | YES | YES | **DRIFT** — TS missing `annotations` field |
| BlockStep | YES | YES | **DRIFT** — TS missing `annotations` field |
| IfElseStep | YES | YES | OK (except annotations) |
| MatchStep | YES | YES | OK (except annotations) |
| ParallelStep | YES | YES | OK — TS has extra `branches?: NamedBranch[]` for named form |
| TryCatchFinallyStep | YES | YES | OK (except annotations) |
| SelectStep | YES | YES | OK (except annotations) |
| BarrierStep | YES | YES | OK (except annotations) |
| QuorumStep | YES | YES | OK (except annotations) |
| RaceStep | YES | YES | OK (except annotations) |
| ControlStep | YES | **MISSING** | `pause`/`resume` lifecycle control |
| FusedPipelineStep | YES | **MISSING** | Streaming pipeline optimization |
| DelayStep | via decorator | YES | TS-only — intentional design |
| EmitEventStep | via plugin | YES | TS-only — intentional design |

**annotations field:** Java added `annotations: List<Annotation>` to ALL ResolvedStep variants. TS has NO `annotations` field on any step type. This is a structural drift across the entire step hierarchy.

---

## Part 3 — Critical Gaps

### C1: Scalar Subject Naming Mismatch

**Java (Walker.java):** Non-Map plugin step values wrapped as `{_subject: value}`
**TS (walker.ts:543-545):** Non-Map plugin step values wrapped as `{value: actionValue}`

This is a cross-platform compatibility bug. Any plugin that reads params by key gets different behavior depending on runtime. The TS key name must change to `_subject` to match Java.

### C2: `capture:` Keyword Missing from TS

Java has `capture` in `DECORATOR_KEYS` and `RESERVED_KEYS`. TS has it in neither. The Walker will reject `capture:` as an unknown key. This blocks #742 and is needed for all `.test.yaml` parity.

**Fix:** Add `capture` to both `DECORATOR_KEYS` and `RESERVED_KEYS` in walker.ts.

### C3: `absorbSiblings` Missing from TS

Java `Definition` has `absorbSiblings: boolean`. When true, unknown sibling keys on a step are absorbed into the action's params map instead of throwing. This powers `assertThat:` with matcher siblings (`contains:`, `equals:`, `not-null:`, etc.) and `emit-event:` with `data:` siblings.

TS `Definition` has no `absorbSiblings` field. Unknown sibling keys always throw. This means `assertThat: ${expr}` + `contains: 'expected'` would fail parsing.

**Fix:** Add `absorbSiblings: boolean` to TS `Definition`/`CatalogEntry`. Update Walker to check this flag before rejecting unknown sibling keys.

### C4: `annotations` Field Missing from All TS Step Types

All 13 Java `ResolvedStep` variants carry `annotations: List<Annotation>`. No TS step type has this field. Even if the annotation system isn't implemented, the field needs to exist (as `annotations?: unknown[]` or similar) for structural alignment.

---

## Part 4 — High Priority Gaps

### H1: Annotation System (`#@` syntax)

**Entirely missing from TS.** Java has:
- `AnnotationParser` — parses `#@Name(args)` from YAML comments
- `AnnotationExtractor` — document-level and step-level annotations with hierarchical dotted-key addressing (`0`, `0.1`, `1.0.2`)
- `AnnotationMap` — immutable store with `forStep(key)`, `forDocument(name)`, `hasStepAnnotation()`
- `InjectionBinding` / `InjectionResolver` — `@Inject(TypeName, qualifier: "value")` DI
- 12 migrated decorators: `timeout`, `retry`, `delay`, `priority`, `resource`, `background`, `on-error`, `trigger`, `semaphore`, `at`, `cancel`, `mutex`
- Annotations threaded through `resolveMatchCases()` and `resolveSelectBranches()`

**Impact:** Covers platform#700, #716, #718. Annotations are syntactic sugar for decorators — inline decorator syntax still works — so this is high priority but not blocking for most playbooks.

### H2: Type-Aware Expression Resolution

**Missing from TS.** Java has:
- `ParameterType.EXPRESSION` (7th type, TS only has 6)
- `TypeAwareParamResolver` — delegates EXPRESSION params to `ExpressionEngineRegistry`
- `ExpressionEngineRegistry` — pluggable expression engines (MVEL, JQ)
- `ExpressionContext` enum — `CONDITION`, `TRANSFORM`, `FILTER`, `PARAMETER`
- `CompiledExpression` — compiled expression cache

TS resolves everything as string interpolation via `VariableResolver`. No expression engine infrastructure exists.

### H3: Typed Error Handling in Catch Scope

**Missing from TS.** Java catch blocks inject typed error info:
- `${error.type}` — `ErrorCategory` enum value (20 categories)
- `${error.message}` — error message
- `${error.step}` — step name where error occurred
- `${error.detail}` — structured error details

Via `YamlErrorMapper` which maps 11+ exception types to the `YamlError` sealed hierarchy (`ParseError`, `RuntimeStepError`, `CoordinationError`).

TS catch blocks get the same resolver as try — no error info injected.

### H4: Test Infrastructure (`.test.yaml`)

**Entirely missing from TS.** Java has:
- `YamlTestDiscovery` — scans for `*.test.yaml` files
- `YamlTestExecutor` — executes test cases with setup/teardown lifecycle
- `YamlTestEngine` — JUnit Platform integration (engine ID: `casehub-yaml`)
- `TestReport` / `TestResult` / `TestStatus` — reporting
- `assert` plugin — expression-based assertion
- `assertThat` plugin — 12 matchers (`equals`, `contains`, `matches`, `hasSize`, `startsWith`, `endsWith`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `not-null`, `not-empty`, `empty`)
- `run-playbook` plugin — sub-playbook execution
- `validate-playbook` plugin — compilation check (returns step count, names, pool declarations, etc.)
- `verify-simulation` plugin — invocation journal assertions (`called`, `calledAtLeast`, `calledAtMost`, `neverCalled`, `inOrder`, `exhaustive`)

Test file structure: `name`, `simulate`, `setup`, `teardown`, `vars`, `params`, `tests` (multi-test) or `steps` (single-test).

### H5: Agent Session Bindings

**Missing from TS.** Java has 4 session binding types and handlers:
- `InvokeBinding.SessionOpen` / `AgentSessionOpenHandler`
- `InvokeBinding.SessionQuery` / `AgentSessionQueryHandler`
- `InvokeBinding.SessionClear` / `AgentSessionClearHandler`
- `InvokeBinding.SessionClose` / `AgentSessionCloseHandler`

Also missing from TS `AgentBinding`: `modelQuery`, `pool`, `modelChain`, `responseFormat`.

### H6: Missing DECORATOR_KEYS (`at`, `on-complete`, `resource`, `priority`)

These 4 decorator keys are in Java's `DECORATOR_KEYS` and `RESERVED_KEYS` but absent from TS. The TS DecoratorChain has handler code for `at` and `resource`/`priority`, but the Walker will reject them as unknown keys before they reach the chain.

**Fix:** Add `at`, `on-complete`, `resource`, `priority` to both `DECORATOR_KEYS` and `RESERVED_KEYS` in walker.ts.

### H7: VariableResolver Dual-Registration

**Missing from TS.** Java `VariableResolver` has:
- `scopeContainers: Map<String, Object>` — expression context containers
- `withExpressionContext(prefix, Map)` — adds to scopeContainers only (no variable source)
- `buildExpressionContext()` — builds context map from scopeContainers

TS `VariableResolver` is purely functional/immutable for string interpolation. No expression context pathway. This blocks H2 (type-aware expression resolution).

### H8: `Result.Failure` Missing `detail` Field

Java: `Result.Failure(message, category, detail: Record<String, Object>)` — structured error info.
TS: `{ kind: 'failure'; message; failureCategory? }` — no `detail` field.

**Fix:** Add `detail?: Record<string, unknown>` to TS Result failure type.

---

## Part 5 — Medium Priority Gaps

### M1: Combined-Key Prefixes — `barrier`, `quorum`

TS `COMBINED_KEY_PREFIXES` is missing `barrier` and `quorum`. Steps like `barrier wait-for-all:` or `quorum 3-of-5:` won't parse in the TS Walker.

### M2: `concurrent:` Keyword

Java Walker handles `concurrent:` as equivalent to `parallel:` map form. TS has no mention of `concurrent`. Playbooks using `concurrent:` will fail in TS.

### M3: `pools:` and `orchestration:` Top-Level Keys

Java parses `pools:` for agent pool declarations (agent-id, backend, max-active, max-prompt-tokens, clearing policy) and `orchestration:` for barrier/signal pre-declarations. TS parses neither.

### M4: ControlStep (`pause`/`resume`)

Java Walker produces `ControlStep(name, target, activate, decorators, annotations)` for `pause:` and `resume:` keys. TS has no equivalent step type or Walker handling. These keys are not in TS `RESERVED_KEYS` and would throw.

### M5: FusedPipelineStep (Streaming Pipeline)

Java `FusionPass` fuses consecutive type-compatible `PluginStep`s into `FusedPipelineStep` for streaming optimization. TS has no equivalent. Lower priority — this is a runtime optimization, not a correctness issue.

### M6: SimulateBlockParser

Java has `SimulateBlockParser` for parsing inline `simulate:` blocks in test YAML, with alias expansion (`agent` → `agent-provider.invoke`, with field mapping `prompt`→`key`, `response`→`output`). TS has `SimulationRuntime` and `SimulationOverlay` but no test-block parser.

### M7: DecoratorChain `loop` Position Drift

Java places `loop` at position 5 (same level as `timeout`). TS places `loop` after `on-error` (position 4). This means loop behavior wraps differently relative to error handling in edge cases.

### M8: `vars:`/`params:` Key Naming Drift

Java `PlaybookVariableParser` parses `vars:` and `params:` with typed names (`count:int`, `name:string`) and constraints. TS `expand.ts` handles `variables:` (different key name). TS `TypedName.parse()` only handles 4 scalar types — no domain types.

### M9: AgentBinding Missing Fields

TS `AgentBinding` has `model?: string` only. Java has:
- `modelQuery: ModelQuery` — capability-based model selection
- `pool: string` — pool-based session routing
- `modelChain: List<String>` — fallback model chain
- `responseFormat: ResponseFormat` — structured output (JSON schema)

---

## Part 6 — Low Priority / Rendering Gaps

### L1: OnCompleteExpander Uses Wrong Key

TS `on-complete-expander.ts` line 39 uses `name` for step naming. Java uses `step:`. This is a drift that would produce invalid steps when `on-complete:` is expanded.

### L2: Decorator Badge Rendering

Step-viewer renders **9 of 31** decorator types as visual badges: `retry`, `timeout`, `loop`, `when`, `mutex`, `forEach`, `publish`, `from`, `cancel`. The remaining 22 decorators are silently dropped — present in the `decorators` map but never rendered.

### L3: Action Icon Coverage

Step-viewer `ICON_MAP` covers only 10 actions: `click`, `fill`, `select`, `navigate`, `assert`, `log`, `signal`, `await`, `graphql`, `delay`. Missing icons for `rest-request`, `process`, `agent-invoke`, `mcp`, `emit-event`, `verify-simulation`.

### L4: Step-Viewer Missing Step Types

No rendering components for `ControlStep` or `FusedPipelineStep` (which are also missing from the TS Walker).

---

## Part 7 — In-Progress Platform Issues

### #735 — Combined-Key Shorthand for Invoke Bindings

**Status:** No branch, no commits, not started in either repo.

**What it adds:** `rest-request GET /api/users:` shorthand where discriminator fields (method + URL) are extracted from the key suffix and merged into step params.

**TS impact:** When Java implements this, TS needs the same combined-key extension — plus per-binding discriminator field mapping. The parsing mechanism is nearly identical in both repos.

### #742 — `capture:` and `name:` as First-Class Step-Level Keys

**Status:** No branch, no commits, not started in either repo.

**Current state:**
- `capture` is in Java `DECORATOR_KEYS` — not in TS
- `capture` runtime wiring exists in Java `PlaybookRunnerCore` for `PluginStep` only
- `name:` does not exist in either — both use `step:` for naming
- `seenNames` validates step name uniqueness in both

**TS impact:**
1. Add `capture` to `DECORATOR_KEYS` and `RESERVED_KEYS` (C2 above)
2. Wire capture in step evaluation — store `Result` output as named scope
3. If `name:` is added in Java, add it to TS as an alias for `step:`

---

## Part 8 — What's at Full Parity

These areas need no work:

| Area | Status |
|------|--------|
| Module system (`ModuleExpander`, `ModuleBridge`, `TypedExpandedModule`) | Full parity |
| Orchestration primitives (signals, semaphores, latches, channels, state machines, counters, gauges, flags, accumulators, maps) | Full parity |
| Simulation runtime (`SimulationOverlay`, `InvocationJournal`, corpus strategies) | Full parity |
| Scenario system (`ScenarioParser`, `ScenarioValidator`, `ScenarioCompiler`) | Full parity |
| Plugin/binding system (`PluginRegistry`, `CompositeCatalog`, `CatalogSource`) | Full parity |
| Promotable decorators (`forEach`, `retry`, `timeout`, `when`, `mutex`, `loop`) | Full parity |
| Combined-key parsing (structural types) | Full parity |
| Condition evaluation (`ConditionEvaluator`, truthiness fast-path) | Full parity |
| Playbook front matter (`PlaybookFrontMatter`, `PlaybookSchemaRegistry`) | Reasonable parity |
| Portability system (`Portability`, `inferPortability`) | Full parity |

---

## Part 9 — Prioritised Implementation Plan

### Phase 1 — Critical Fixes (blocking correctness)

| # | Gap | Effort | Blocks |
|---|-----|--------|--------|
| C1 | Fix scalar subject key: `value` → `_subject` | XS | Cross-platform plugin compat |
| C2 | Add `capture` to DECORATOR_KEYS + RESERVED_KEYS | XS | #742, test parity |
| C3 | Add `absorbSiblings` to Definition + Walker | S | assertThat, emit-event |
| C4 | Add `annotations` field to all ResolvedStep types | S | Annotation system |
| H6 | Add `at`, `on-complete`, `resource`, `priority` to keyword sets | XS | Decorator chain handlers already exist |
| M1 | Add `barrier`, `quorum` to COMBINED_KEY_PREFIXES | XS | Combined-key parity |

### Phase 2 — High Priority (test/playbook parity)

| # | Gap | Effort | Blocks |
|---|-----|--------|--------|
| H4 | Test infrastructure (assert, assertThat, run-playbook, verify-simulation) | L | .test.yaml parity |
| H3 | Typed error catch scope | M | Error-aware playbooks |
| H8 | Result.failure.detail field | XS | Error detail propagation |
| M4 | ControlStep (pause/resume) | S | Consumer lifecycle |
| M2 | `concurrent:` as parallel alias | XS | Playbook compatibility |
| M3 | `pools:` and `orchestration:` parsing | S | Agent pool playbooks |
| M8 | `vars:`/`params:` alignment | M | Typed variables |
| M6 | SimulateBlockParser for test blocks | M | Test simulation |
| L1 | OnCompleteExpander `name` → `step:` fix | XS | on-complete correctness |

### Phase 3 — Expression System (foundational)

| # | Gap | Effort | Blocks |
|---|-----|--------|--------|
| H2 | Type-aware expression resolution | XL | EXPRESSION param type |
| H7 | VariableResolver dual-registration | M | Expression context |
| H1 | Annotation system | L | @Inject, migrated decorators |

### Phase 4 — Alignment with In-Progress Features

| # | Gap | Effort | Blocks |
|---|-----|--------|--------|
| H5 | Agent session bindings | M | Multi-turn agent playbooks |
| M5 | FusedPipelineStep | M | Streaming optimization |
| M9 | AgentBinding fields (modelQuery, pool, modelChain, responseFormat) | S | Advanced agent config |
| M7 | DecoratorChain loop position | XS | Edge-case ordering |

### Phase 5 — Visual Polish

| # | Gap | Effort | Blocks |
|---|-----|--------|--------|
| L2 | Decorator badge rendering (22 missing) | M | Visual completeness |
| L3 | Action icon coverage | S | Visual polish |
| L4 | Step-viewer for new step types | S | Visual completeness |

---

## Appendix A — Java Catalog Stub Actions (63 actions)

The full action vocabulary registered in `ValidatePlaybookPlugin.CATALOG_STUB_ACTIONS`:

**Agent:** `agent-session-open`, `agent-session-close`, `agent-session-clear`, `agent-query`, `agent-delegate`, `agent-invoke`
**Orchestration:** `chan-consume`, `chan-produce`, `counter-add`, `counter-get`, `flag-check`, `flag-set`, `flag-toggle`, `gauge-cas`, `gauge-get`, `gauge-set`, `latch-countdown`, `latch-create`, `latch-status`, `sm-create`, `sm-state`, `sm-transition`, `spawn-task`, `task-join`, `task-poll`, `deadline-check`, `deadline-create`, `deadline-work`, `corr-await`, `corr-expect`, `corr-send`, `map-reader`, `pipeline-consume`, `stop`, `pause`, `resume`
**IO:** `rest-request`, `graphql`, `graphql-exec`, `mcp-call`, `process-exec`, `script-run`
**Testing:** `assert`, `simulated`, `validate-playbook`, `verify-simulation`
**UI:** `click`, `fill`, `navigate`, `select`, `expand`, `collapse`, `wait`, `show-markdown`, `spotlight`, `scroll-to-row`, `editor-insert`, `editor-set-content`, `editor-replace`, `editor-delete`, `editor-cursor`, `editor-highlight`, `editor-completion`
**Other:** `log`, `emit-event`, `delay`, `fail`, `run-playbook`

## Appendix B — Java ErrorCategory Enum (20 values)

`UNKNOWN_STEP`, `PARAMETER_VIOLATION`, `INVALID_STRUCTURE`, `EXPRESSION_PARSE`, `DUPLICATE_STEP`, `STEP_ACTION_FAILED`, `TIMEOUT`, `RETRY_EXHAUSTED`, `GUARD_REJECTED`, `EXPRESSION_EVAL`, `CHANNEL_CLOSED`, `DEADLINE_EXCEEDED`, `CORRELATION_TIMEOUT`, `SEMAPHORE_REENTRANCY`, `ILLEGAL_TRANSITION`, `RATE_LIMIT`, `SESSION_LIMIT`, `NOT_FOUND`, `AUTH_DENIED`, `SIMULATION`, `INFRASTRUCTURE`

## Appendix C — Java AssertThat Matchers (12)

`equals`, `contains`, `matches`, `hasSize`, `startsWith`, `endsWith`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `not-null`, `not-empty`, `empty`

## Appendix D — Java Migrated Decorators (annotation form, 12)

`timeout`, `retry`, `delay`, `priority`, `resource`, `background`, `on-error`, `trigger`, `semaphore`, `at`, `cancel`, `mutex`
