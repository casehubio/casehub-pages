# Decisions — #642 Streaming Pipeline & Agent Session Handlers

## D1: Agent session handler architecture

**Choice:** Callback-based SessionPipeline interface with four separate handler classes (one per binding kind), following the established InvokeHandler pattern
**Alternatives:**
- Single unified AgentSessionHandler — fewer files but concentrates logic, diverges from Java pattern, harder to test in isolation
**Rationale:** Matches Java's four-handler architecture 1:1, follows the proven DI pattern from AgentInvokeHandler (callback injection), and each handler is independently testable
**Trade-offs:** More files (4 handlers + 1 interface vs 1 unified handler), but each is focused and simple
**Sources:** Java `AgentSessionOpenHandler` et al in yaml-step-runtime; TS `AgentInvokeHandler` pattern in `agent-handler.ts`
**Exploration:** quick
**Status:** captured

## D2: Agent session runtime scope

**Choice:** Full runtime execution — SessionPipeline interface with pluggable backend, handlers execute real session operations
**Alternatives:**
- Stub handlers returning not-implemented — schema parity only, no runtime
- Interface + NoOp default — full interface but ships with stub implementation
**Rationale:** Enables multi-turn agent playbooks in the browser, which is the stated goal of H5b
**Trade-offs:** Requires consumers to provide a SessionPipeline implementation; no out-of-the-box execution without a backend
**Sources:** Issue #642 scope ("runtime execution for SessionOpen/Query/Clear/Close bindings")
**Exploration:** quick
**Status:** captured

## D3: Streaming type compatibility model

**Choice:** String-based type tags on StreamingTypeInfo (e.g. 'text', 'json', 'binary'). Compatibility is tag equality.
**Alternatives:**
- Structural type matching via Zod/JSON Schema — more precise but heavyweight, overkill for current plugin set
- Opaque factory-only (no type checking) — maximally simple but risks silent runtime errors from incompatible types
**Rationale:** TS has no class-based assignability like Java's `isAssignableFrom()`. String tags are simple, explicit, and sufficient for the known streaming use cases. Can be upgraded to structural matching later if needed.
**Trade-offs:** Less precise than structural matching; relies on plugin authors using consistent tag names
**Sources:** Java `StreamingTypeInfo` in yaml-plugin-api; Java `FusionPass` type compatibility check
**Exploration:** quick
**Status:** captured

## D4: Fusion pass architecture

**Choice:** Post-walk fusion pass mirroring Java — `FusionPass.fuse()` as a static function called after `Walker.resolve()`, adding `FusedPipelineStep` to `ResolvedStep` union
**Alternatives:**
- Walker-integrated fusion — fuse during `resolveOne()` instead of a post-pass. Mixes parsing and optimization concerns, harder to maintain.
**Rationale:** Matches Java's architecture, keeps the walker focused on parsing, and the post-pass is independently testable
**Trade-offs:** Extra pass over the step list (O(n) cost, negligible for playbook-sized inputs)
**Sources:** Java `FusionPass.fuse()` in yaml-step-runtime, called at Walker.resolve() line 68
**Exploration:** quick
**Status:** captured

## D5: Fused pipeline evaluation model

**Choice:** Async iterables — each stage's StreamingStepFactory produces an AsyncIterable, stages pipe into each other for true streaming
**Alternatives:**
- Sequential execution — each stage awaits fully before the next starts. Simpler but loses the streaming latency benefit
**Rationale:** True streaming is FusionPass's entire purpose — sequential execution would make fusion pointless
**Trade-offs:** More complex evaluation implementation; requires careful error handling and cleanup of async iterables on failure
**Sources:** Java `StructuralStepEvaluator.evaluateFusedPipeline()` using reactive streams
**Exploration:** quick
**Depends on:** D3 (streaming type tags), D4 (post-walk fusion pass)
**Status:** captured
