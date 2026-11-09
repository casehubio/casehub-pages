# Decisions — #641 Expression System

## D1: Scope — full pipeline with cross-repo parity

**Choice:** Build the full expression pipeline (engine infra + ParameterType.EXPRESSION + VariableResolver integration) on BOTH TS and Java sides simultaneously, maintaining parity.
**Alternatives:**
- Engine infra only — match what Java has today, defer integration. Lower risk but leaves the pipeline incomplete on both sides.
- Reassess scope — descope #641 since audit spec overstated the gap. Wastes the momentum from Phases 1-2.
**Rationale:** Java has the engine infrastructure but not the integration. TS has neither. Building both sides together ensures the contract stays symmetric and avoids drift.
**Trade-offs:** Larger scope (cross-repo), requires platform in the slot. But the integration work is the same shape on both sides — doing it once in sync is cheaper than retrofitting parity later.
**Sources:** Audit spec H2/H7 sections, Java ExpressionEngineRegistry (platform-api), TS VariableResolver (yaml-core)
**Exploration:** quick
**Status:** captured

## D2: TS engines — JQ + JS, not MVEL/JEXL

**Choice:** TS ships with a JQ engine (via `@sscots/jqjs`, pure JS, 76.7 kB) and a native JS expression engine. No MVEL or JEXL — those are JVM-only.
**Alternatives:**
- Interface + no-op registry only — defer all engine implementations. Contracts without functionality.
- JQ wasm (`jq-web`) — full jq fidelity but heavy bundle (several hundred KB wasm binary).
**Rationale:** `@sscots/jqjs` is lightweight, browser-compatible, and its `compile()` → generator API maps directly to `ExpressionEngine.compile()` → `CompiledExpression.eval()`. JS engine covers the MVEL/JEXL use cases (simple expressions, conditions) in the browser context.
**Trade-offs:** `@sscots/jqjs` lacks user-defined jq functions. Acceptable for CaseHub data transforms. Upgrade path to `jq-web` wasm exists if needed.
**Sources:** npm `@sscots/jqjs` (76.7 kB, ISC license, fork of mwh/jqjs), npm `jq-web` (wasm fallback)
**Exploration:** deep-analysis
**Status:** captured

## D3: EXPRESSION param routing — ParameterType.EXPRESSION

**Choice:** Add `EXPRESSION` as a 7th ParameterType value. Plugin param schemas declare `type: EXPRESSION`. The resolution pipeline checks param type and routes EXPRESSION params to the engine registry, all others to VariableResolver string interpolation.
**Alternatives:**
- Expression prefix syntax (`=jq(...)`) — any param can be an expression via prefix. Flexible but muddies the type system.
- Dedicated expression key — sibling `expression:` key alongside param. Explicit but verbose.
**Rationale:** The plugin definition owns the decision about how a param is resolved, not the YAML author. Clean separation — no special syntax, no ambiguity. Matches the existing ParameterType pattern.
**Trade-offs:** A param is either EXPRESSION or not — can't have a param that's sometimes interpolated and sometimes evaluated. This is a feature, not a limitation.
**Sources:** TS ParameterType (yaml-core/src/types.ts:1), Java ParameterType (yaml-plugin-api)
**Exploration:** quick
**Status:** captured

## D4: VariableResolver dual-registration — parallel containers

**Choice:** Add `expressionContainers: Record<string, unknown>` to VariableResolver (both TS and Java). `withExpressionContext(prefix, map)` returns a new resolver with the container added. `buildExpressionContext()` aggregates all containers into the context map passed to `CompiledExpression.eval()`.
**Alternatives:**
- Separate ExpressionContext object — standalone builder threaded alongside resolver. Cleaner separation but requires threading a second object through the evaluation pipeline.
- Unified resolver with mode — one object, two behaviors (INTERPOLATION vs EXPRESSION). Conflates responsibilities.
**Rationale:** Same immutable pattern as existing prefixSources/objectSources — just a third source type. No new objects to thread, no pipeline changes beyond the routing at the evaluation choke point.
**Trade-offs:** VariableResolver grows slightly in surface area. Acceptable given it already has two source types.
**Sources:** TS VariableResolver (yaml-core/src/variable-resolver.ts), Java VariableResolver (yaml-core/resolver/VariableResolver.java)
**Exploration:** quick
**Depends on:** D3 (EXPRESSION params need a context to evaluate against)

## D5: Packaging — expression system in yaml-core

**Choice:** ExpressionEngine, ExpressionEngineRegistry, CompiledExpression, ExpressionContext all go in yaml-core (both TS and Java). Concrete engine implementations (JQ, JS) also in yaml-core for TS; Java engines stay in expression-core.
**Alternatives:**
- New pages-expression package — clean boundary but adds a dependency edge from yaml-core.
- Split interfaces/impls — interfaces in yaml-core, engines in pages-expression-engines. Mirrors Java's split but adds complexity for TS's simpler package landscape.
**Rationale:** yaml-core already owns VariableResolver and ParameterType. The expression system is a natural extension. Registry is populated by injection (same as Catalog). No new dependency edges.
**Trade-offs:** yaml-core grows. But the expression interfaces are small (4-5 types) and the engine implementations are thin wrappers.
**Sources:** TS yaml-core package structure, Java platform-api/expression-core split
**Exploration:** quick
**Status:** captured

## D6: Unsupported engine fallback — registry descriptive output

**Choice:** ExpressionEngineRegistry.compile() returns a DescriptiveExpression when the requested engine type isn't registered. `eval()` returns a structured description: `{engine, expression, context, status: 'not-available'}`. No throw, no silent skip.
**Alternatives:**
- NoOpExpressionEngine per type — register for each unsupported type. Explicit but requires pre-registering every possible engine name.
- Throw with structured error — registry throws, caller catches and produces print-out. Pushes fallback logic to every call site.
**Rationale:** Same pattern as Aria in Java and MCP in browser — unsupported capabilities produce descriptive output rather than failing. The registry owns the fallback, not the caller.
**Trade-offs:** Callers must handle the `not-available` status in the eval result. But this is expected — the whole point is visible degradation.
**Sources:** Aria print-out pattern (Java), MCP browser fallback pattern
**Exploration:** quick
**Status:** captured

## D7: Java wiring — extend VariableResolver symmetrically

**Choice:** Add scopeContainers + withExpressionContext + buildExpressionContext to Java VariableResolver, matching the TS design (D4). Add resolveExpression() that delegates to ExpressionEngineRegistry. Both sides symmetric.
**Alternatives:**
- New TypeAwareParamResolver — separate resolver layer between plugin executor and VariableResolver. Different shape from TS.
- Follow existing Java design intent — but no concrete design exists in platform issues beyond the audit spec's mention.
**Rationale:** Symmetric design across TS and Java reduces cognitive overhead. Same mental model, same method names, same data flow. The parity principle from D1.
**Trade-offs:** Java VariableResolver gains expression-related methods even though Java has a more natural place for a separate resolver. Symmetry wins over Java-idiomatic separation here.
**Sources:** Java VariableResolver (yaml-core/resolver/VariableResolver.java), D4 (TS design)
**Depends on:** D1 (cross-repo parity), D4 (TS dual-registration design)
**Exploration:** quick
**Status:** captured
