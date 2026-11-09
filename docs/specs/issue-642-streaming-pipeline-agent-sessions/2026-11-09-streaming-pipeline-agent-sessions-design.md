# Phase 4 — Streaming Pipeline & Agent Session Handlers

**Issue:** casehubio/casehub-pages#642
**Parent:** casehubio/casehub-pages#608 (TS/Java YAML runtime parity)
**Date:** 2026-11-09
**Gaps:** H5b (agent session handlers), M5 (FusedPipelineStep)

---

## Summary

Two independent subsystems bringing TS runtime parity with Java:

1. **Agent session handlers (H5b)** — runtime execution for `SessionOpen`, `SessionQuery`, `SessionClear`, `SessionClose` bindings against a pluggable `SessionPipeline` backend. Enables multi-turn agent playbooks in the browser.

2. **FusedPipelineStep (M5)** — post-walk optimization pass that fuses consecutive type-compatible `PluginStep`s into a streaming pipeline using async iterables.

---

## Part 1: Agent Session Handlers (H5b)

### 1.1 Binding Type Alignment

Phase 1 (#620) added the four session binding types to the `InvokeBinding` union. They are sparser than Java and need additional fields for full runtime capability.

**AgentSessionOpenBinding** — add `system`, `modelQuery`, `modelChain`, `pool`, `checkoutTimeout`:

```ts
export interface AgentSessionOpenBinding {
  kind: 'agent-session-open';
  descriptor: string;
  system?: string;
  model?: string;
  modelQuery?: string;
  modelChain?: string[];
  pool?: string;
  timeout?: string;
  checkoutTimeout?: string;
}
```

**AgentSessionQueryBinding** — add `user`, `responseFormat`, `output`, `priority`:

```ts
export interface AgentSessionQueryBinding {
  kind: 'agent-session-query';
  sessionRef: string;
  user: string;
  responseFormat?: string;
  output?: string;
  priority?: boolean;
  timeout?: string;
}
```

**AgentSessionClearBinding** and **AgentSessionCloseBinding** — unchanged (already sufficient with `sessionRef`).

**Field mapping to Java:**

| TS field | Java field | Notes |
|----------|-----------|-------|
| `descriptor` | `session` | Session identifier (open) |
| `sessionRef` | `session` | Session identifier (query/clear/close) |
| `system` | `system` | System prompt for the agent |
| `user` | `user` | Query text |
| `model` | `model` | Model selection |
| `modelQuery` | `modelQuery` | Dynamic model selection criteria |
| `modelChain` | `modelChain` | Ordered list of fallback models |
| `pool` | `pool` | Agent pool reference |
| `responseFormat` | `responseFormat` | Output format constraint |
| `output` | `output` | Output variable name |
| `priority` | `priority` | Priority execution flag |
| `timeout` | `timeout` | Operation timeout |
| `checkoutTimeout` | `checkoutTimeout` | Pool checkout timeout |

### 1.2 DefinitionParser.parseInvoke() — Session Binding Parsing

**Current state:** `DefinitionParser.parseInvoke()` does NOT handle session binding keys at all. Attempting to parse `{ 'agent-session-open': { ... } }` will throw "Unknown invoke binding type." This is a gap from Phase 1 — the TypeScript types were added but the parser was never updated.

**Required changes:** Add four new branches to `parseInvoke()`, mirroring Java's `DeclarationParser` (lines 114-125, 212-249):

```ts
if (raw['agent-session-open']) {
  const spec = raw['agent-session-open'] as Record<string, unknown>;
  return {
    kind: 'agent-session-open',
    descriptor: spec['session'] as string,
    system: spec['system'] as string | undefined,
    model: spec['model'] as string | undefined,
    modelQuery: spec['model-query'] ?? spec['modelQuery'] as string | undefined,
    modelChain: spec['model-chain'] ?? spec['modelChain'] as string[] | undefined,
    pool: spec['pool'] as string | undefined,
    timeout: spec['timeout'] as string | undefined,
    checkoutTimeout: (spec['checkout-timeout'] ?? spec['checkoutTimeout']) as string | undefined,
  };
}
if (raw['agent-query']) {
  const spec = raw['agent-query'] as Record<string, unknown>;
  return {
    kind: 'agent-session-query',
    sessionRef: spec['session'] as string,
    user: spec['user'] as string,
    responseFormat: (spec['response-format'] ?? spec['responseFormat']) as string | undefined,
    output: spec['output'] as string | undefined,
    priority: spec['priority'] === true,
    timeout: spec['timeout'] as string | undefined,
  };
}
if (raw['agent-session-clear']) {
  const val = raw['agent-session-clear'];
  if (typeof val === 'string') return { kind: 'agent-session-clear', sessionRef: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'agent-session-clear', sessionRef: spec['session'] as string };
}
if (raw['agent-session-close']) {
  const val = raw['agent-session-close'];
  if (typeof val === 'string') return { kind: 'agent-session-close', sessionRef: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'agent-session-close', sessionRef: spec['session'] as string };
}
```

**YAML key to TS field mapping:** The YAML uses `session` as the key name (matching Java), but the TS binding types use `descriptor` (for open) and `sessionRef` (for query/clear/close). The parser maps between them. Similarly, YAML `agent-query` maps to TS `kind: 'agent-session-query'` (the TS kind includes the full `agent-session-` prefix for consistency).

**Shorthand support:** `agent-session-clear` and `agent-session-close` accept a bare string (the session name), matching Java's behavior.

### 1.3 SessionPipeline Interface

New file: `packages/yaml-core/src/step/invoke/session-pipeline.ts`

```ts
export interface AgentSession {
  query(prompt: string): AsyncIterable<AgentEvent>;
  clear(): Promise<void>;
}

export type AgentEvent =
  | { kind: 'text-delta'; text: string }
  | { kind: 'invocation-complete'; inputTokens: number; outputTokens: number; durationMs: number };

export interface SessionPipeline {
  openSession(name: string, init: AgentSessionInit, clearingPolicy: ClearingPolicy): Promise<void>;
  sessionFor(name: string): AgentSession | undefined;
  releaseSession(name: string): Promise<void>;
}

export interface AgentSessionInit {
  system: string;
  model?: string;
}

export type ClearingPolicy = 'manual' | 'auto';
```

The `SessionPipeline` interface mirrors Java's `SessionPipeline` from `agent-session-core`. Consumers provide an implementation when constructing the handlers. The `AgentSession.query()` method returns an `AsyncIterable<AgentEvent>` — the TS equivalent of Java's reactive stream.

### 1.4 Handler Implementations

Four handler classes in `packages/yaml-core/src/step/invoke/`, each implementing `InvokeHandler`:

**AgentSessionOpenHandler:**
- `supports()`: matches `kind === 'agent-session-open'`
- `create()`: returns an `Action` that calls `pipeline.openSession()` with an `AgentSessionInit` built from the binding's `system` (defaulting to "You are a helpful assistant.") and optional `model`. Returns `{ session: descriptor }` on success.

**AgentSessionQueryHandler:**
- `supports()`: matches `kind === 'agent-session-query'`
- `create()`: returns an `Action` that:
  1. Looks up the session via `pipeline.sessionFor(sessionRef)`
  2. If not found, returns failure
  3. Calls `session.query(user)` to get the async iterable
  4. Iterates collecting `text-delta` events into a response string and `invocation-complete` metadata
  5. Returns `{ response, inputTokens, outputTokens, durationMs }`

**AgentSessionClearHandler:**
- `supports()`: matches `kind === 'agent-session-clear'`
- `create()`: returns an `Action` that looks up the session and calls `session.clear()`. Returns `{ session, cleared: true }`.

**AgentSessionCloseHandler:**
- `supports()`: matches `kind === 'agent-session-close'`
- `create()`: returns an `Action` that calls `pipeline.releaseSession(sessionRef)`. Returns `{ session, closed: true }`.

### 1.5 Registration

- Export all four handlers and the `SessionPipeline` types from `packages/yaml-core/src/step/index.ts`
- Add mock session handlers to `createMockInvokeHandlers()` in `test-helpers.ts` using a `MockSessionPipeline` that tracks open sessions in a `Map<string, AgentSession>`

### 1.6 Test Plan

Each handler gets its own test file mirroring the existing handler test pattern (e.g. `agent-handler.test.ts`):

- `agent-session-open-handler.test.ts` — open with/without system prompt, open with model, duplicate session, timeout
- `agent-session-query-handler.test.ts` — query success, session not found, text delta collection, metadata extraction, priority flag
- `agent-session-clear-handler.test.ts` — clear success, session not found
- `agent-session-close-handler.test.ts` — close success, release unknown session

---

## Part 2: FusedPipelineStep (M5)

### 2.1 StreamingTypeInfo

New file: `packages/yaml-core/src/step/streaming-types.ts`

```ts
export interface StreamingTypeInfo {
  inputType: string;
  outputType: string;
  inputKey: string;
  factory: StreamingStepFactory;
}

export type StreamingStepFactory = (
  params: Record<string, unknown>,
  input: AsyncIterable<unknown>,
  services: ServiceRegistry,
) => AsyncIterable<unknown>;
```

**Type compatibility:** Two stages are compatible when the producer's `outputType` string equals the consumer's `inputType` string. Known type tags: `'text'`, `'json'`, `'binary'`.

### 2.2 Definition Extension

Add `streamingType?: StreamingTypeInfo` to the `Definition` interface in `types.ts`. Plugin definitions that support streaming declare their input/output types and factory function.

### 2.3 FusedPipelineStep Type

Added to `walker.ts` as a new variant of `ResolvedStep`:

```ts
export interface FusedStageDescriptor {
  stepName: string | null;
  actionName: string;
  params: Record<string, unknown>;
  decorators: Record<string, unknown>;
  inputKey: string;
  factory: StreamingStepFactory;
}

export interface FusedPipelineStep {
  kind: 'fused-pipeline';
  name: string | null;
  stages: FusedStageDescriptor[];
  decorators: Record<string, unknown>;
  annotations: unknown[];
}
```

The `name` is taken from the last step in the fused chain (matches Java). The `decorators` come from the first step's decorators (the chain entry point).

### 2.4 FusionPass

New file: `packages/yaml-core/src/step/fusion-pass.ts`

```ts
export class FusionPass {
  static fuse(steps: ResolvedStep[]): ResolvedStep[]
}
```

**Algorithm** (mirrors Java `FusionPass.fuse()` at lines 29-73):

1. **Short-circuit:** If fewer than 2 steps, return as-is.
2. **Reference analysis:** Scan all steps for `${result.<name>}` patterns in params. Any step whose name appears as a reference cannot be fused mid-chain (its output must remain individually accessible).
3. **Candidate accumulation:** Iterate steps:
   - For each `PluginStep` whose `entry.definition.streamingType` is defined and has no chain-breaking decorator: add to candidate chain.
   - Check type tag equality: `previousStage.outputType === currentStage.inputType`.
   - If any condition breaks, flush the chain.
4. **Non-PluginStep entries:** Immediately flush any accumulated chain and pass through unchanged.
5. **Flush:** Chains of 1 emit the original `PluginStep` unchanged. Chains of 2+ convert to a `FusedPipelineStep` with one `FusedStageDescriptor` per candidate.

**Chain-breaking decorators** (identical to Java):
```ts
const CHAIN_BREAKING_DECORATORS = new Set([
  'from', 'background', 'when', 'on-error', 'wait', 'at',
  'forEach', 'cancel', 'loop', 'transition', 'signal',
  'publish', 'semaphore', 'mutex', 'transform',
]);
```

### 2.5 Walker Integration

At the end of `Walker.resolve()`, after all steps are resolved, call `FusionPass.fuse(steps)` to produce the optimized step list.

### 2.6 Evaluator Integration

Add `'fused-pipeline'` case to `StructuralEvaluator.dispatch()`:

```ts
case 'fused-pipeline': return this.evaluateFusedPipeline(step, context);
```

**evaluateFusedPipeline():**

1. Resolve the first stage's params via `context.resolver.resolveMap()`.
2. Create the initial async iterable from the first stage's factory: `stage.factory(resolvedParams, emptyIterable, services)`.
3. For each subsequent stage: resolve params, call `stage.factory(resolvedParams, previousIterable, services)`.
4. Drain the final iterable, collecting all values into a result.
5. Return `stepSuccess({ ...finalOutput })` with the last stage's name.

**Error handling:**
- Wrap the entire chain in try/finally.
- If any stage throws during iteration, return `stepFailure()` with the failing stage's name.
- On failure, call `.return()` on any active iterators to clean up resources.

### 2.7 Test Plan

**fusion-pass.test.ts:**
- No fusion for fewer than 2 steps
- Two compatible consecutive PluginSteps fuse into FusedPipelineStep
- Three-step chain fuses correctly
- Type-incompatible steps break the chain (output tag !== input tag)
- Chain-breaking decorators prevent fusion
- Non-PluginStep in between breaks the chain
- Referenced step names prevent mid-chain fusion
- Mixed fusible and non-fusible steps produce correct output

**structural-evaluator fused pipeline tests:**
- Two-stage pipeline produces correct output
- Three-stage pipeline chains correctly
- Stage failure returns failure result with stage name
- Async iterable cleanup on error

---

## File Summary

### New files

| File | Purpose |
|------|---------|
| `packages/yaml-core/src/step/invoke/session-pipeline.ts` | SessionPipeline interface, AgentSession, AgentEvent types |
| `packages/yaml-core/src/step/invoke/agent-session-open-handler.ts` | SessionOpen handler |
| `packages/yaml-core/src/step/invoke/agent-session-query-handler.ts` | SessionQuery handler |
| `packages/yaml-core/src/step/invoke/agent-session-clear-handler.ts` | SessionClear handler |
| `packages/yaml-core/src/step/invoke/agent-session-close-handler.ts` | SessionClose handler |
| `packages/yaml-core/src/step/invoke/agent-session-open-handler.test.ts` | Open handler tests |
| `packages/yaml-core/src/step/invoke/agent-session-query-handler.test.ts` | Query handler tests |
| `packages/yaml-core/src/step/invoke/agent-session-clear-handler.test.ts` | Clear handler tests |
| `packages/yaml-core/src/step/invoke/agent-session-close-handler.test.ts` | Close handler tests |
| `packages/yaml-core/src/step/streaming-types.ts` | StreamingTypeInfo, StreamingStepFactory, FusedStageDescriptor |
| `packages/yaml-core/src/step/fusion-pass.ts` | FusionPass.fuse() optimization pass |
| `packages/yaml-core/src/step/fusion-pass.test.ts` | Fusion pass tests |

### Modified files

| File | Change |
|------|--------|
| `packages/yaml-core/src/step/types.ts` | Align session binding fields, add `streamingType` to Definition |
| `packages/yaml-core/src/step/walker.ts` | Add FusedPipelineStep to ResolvedStep union, call FusionPass.fuse() |
| `packages/yaml-core/src/step/structural-evaluator.ts` | Add `'fused-pipeline'` dispatch + evaluateFusedPipeline() |
| `packages/yaml-core/src/step/index.ts` | Export new handlers, types |
| `packages/yaml-core/src/step/invoke/test-helpers.ts` | Add mock session handlers to createMockInvokeHandlers() |
| `packages/yaml-core/src/step/definition-parser.ts` | Parse new session binding fields from YAML |

---

## References

- Java `AgentSessionOpenHandler` et al: `/Users/mdproctor/claude/casehub/slots/222/platform/yaml-step-runtime/src/main/java/io/casehub/yaml/step/handler/`
- Java `FusionPass`: `/Users/mdproctor/claude/casehub/slots/222/platform/yaml-step-runtime/src/main/java/io/casehub/yaml/step/eval/FusionPass.java`
- Java `FusedPipelineStep`: `/Users/mdproctor/claude/casehub/slots/222/platform/yaml-step-runtime/src/main/java/io/casehub/yaml/step/catalog/ResolvedStep.java` (line 306)
- Java `StreamingTypeInfo`: `/Users/mdproctor/claude/casehub/slots/222/platform/yaml-plugin-api/src/main/java/io/casehub/yaml/plugin/api/StreamingTypeInfo.java`
- Java `InvokeBinding` (session records): `/Users/mdproctor/claude/casehub/slots/222/platform/yaml-core/src/main/java/io/casehub/yaml/core/step/InvokeBinding.java` (lines 91-131)
- TS `InvokeHandler` interface: `packages/yaml-core/src/step/invoke/invoke-handler.ts`
- TS `AgentInvokeHandler` pattern: `packages/yaml-core/src/step/invoke/agent-handler.ts`
- TS `StructuralEvaluator`: `packages/yaml-core/src/step/structural-evaluator.ts`
- TS session binding types: `packages/yaml-core/src/step/types.ts` (lines 69-90)
- Audit spec: `docs/specs/2026-11-07-ts-platform-parity-audit.md` (H5b at line 390, M5 at line 391)
- Issue #642: casehubio/casehub-pages#642
