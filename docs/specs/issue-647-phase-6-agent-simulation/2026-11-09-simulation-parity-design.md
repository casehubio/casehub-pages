# Full Simulation Parity — Phase-Aware Agent Simulation + Streaming API

**Issues:** casehubio/casehub-pages#647, casehubio/casehub-pages#645
**Date:** 2026-11-09
**Parent:** casehubio/casehub-pages#608 (TS/Java YAML runtime parity)
**Phase:** 6 — Simulation & Showcase

---

## Overview

Bring the TS simulation infrastructure to full parity with Java's `simulation-core` module. This covers three workstreams built together on a single branch:

1. **#645 — Streaming simulation API:** Streaming corpus entries with configurable chunking/delays, session-aware corpus, `SimulatedSessionPipeline`
2. **#647 — Phase-aware agent simulation:** All 4 corpus selectors (StateMachine, Duration, LookupCount, Weighted), `PhasedCorpus`, per-test simulation config
3. **Remaining simulation gaps:** Missing strategies (random, recorded-replay, nearest-match), `ExhaustionPolicy`, `KeyExtractor`, `SimilarityScorer`, profiles, global speed

### Current State (TS)

- `SimulationRuntime` with overlay stack, 3 strategies (sequential, key-lookup, passthrough)
- `SimulationOverlay` with journal and sequential counters
- `SimulateBlockParser` parses YAML simulate blocks with alias table
- `SessionPipeline`/`AgentSession` interfaces from #642
- Agent session handlers (open/query/clear/close)
- Test infrastructure (`YamlTestParser`, `YamlTestExecutor`, `describeYamlTests`) — no `.test.yaml` files yet
- No corpus selectors, no phased corpus, no state machine, no streaming simulation

### Target State

Full parity with Java `simulation-core`: typed generic corpus, 5 strategy types, 4 selector types, phased corpus, streaming corpus entries, session-aware simulation, profiles, per-test config.

---

## Architecture

All simulation code moves to `yaml-core/src/simulation/`. The existing `step/simulation-runtime.ts` becomes a re-export shim, then gets removed once consumers migrate imports.

```
yaml-core/src/simulation/
├── types.ts                          — shared types and enums
├── corpus.ts                         — SimulationCorpus<I,O> interface
├── in-memory-corpus.ts               — InMemorySimulationCorpus<I,O>
├── phased-corpus.ts                  — PhasedCorpus<I,O> (read-only selector wrapper)
├── journal.ts                        — InvocationJournal
├── overlay.ts                        — SimulationOverlay
├── runtime.ts                        — SimulationRuntime
├── config.ts                         — SimulationConfig interface + MapSimulationConfig
├── selectors/
│   ├── corpus-selector.ts            — CorpusSelector interface
│   ├── state-machine.ts              — StateMachineSelector
│   ├── duration.ts                   — DurationSelector
│   ├── lookup-count.ts               — LookupCountSelector
│   └── weighted.ts                   — RandomSelector
├── strategies/
│   ├── simulation-strategy.ts        — SimulationStrategy<I,O> interface
│   ├── sequential.ts                 — SequentialStrategy
│   ├── key-lookup.ts                 — KeyLookupStrategy
│   ├── random.ts                     — RandomStrategy
│   ├── recorded-replay.ts            — RecordedReplayStrategy
│   └── nearest-match.ts              — NearestMatchStrategy
├── streaming.ts                      — StreamingCorpusDatum, chunkToStream()
├── session/
│   ├── simulated-session.ts          — SimulatedAgentSession
│   └── simulated-session-pipeline.ts — SimulatedSessionPipeline
├── profile.ts                        — ProfileSource, SimulationProfile
├── key-extractor.ts                  — KeyExtractor<I>
├── similarity-scorer.ts              — SimilarityScorer<I>
└── index.ts                          — barrel exports
```

---

## Core Types & Interfaces

### SimulationCorpus<I, O>

Full generic port matching Java:

```typescript
interface SimulationCorpus<I, O> {
  lookupByKey(qualifiedName: string, key: string): O | undefined;
  lookupAllByKey(qualifiedName: string, key: string): O[];
  lookupByIndex(qualifiedName: string, index: number): O | undefined;
  list(qualifiedName: string): InvocationRecord<I, O>[];
  listByTenant(qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[];
  record(qualifiedName: string, tenancyId: string, input: I, output: O, key?: string): void;
  seed(qualifiedName: string, records: InvocationRecord<I, O>[]): void;
  clear(qualifiedName: string): void;
  size(qualifiedName: string): number;
}
```

### InvocationRecord<I, O>

```typescript
interface InvocationRecord<I, O> {
  tenancyId: string;
  key: string;
  input: I;
  output: O;
  recordedAt: number;
}
```

### CorpusSelector

```typescript
interface CorpusSelector {
  activePhase(): string;
  type(): string;
  onResolved(): void;
  reset(): void;
}
```

### CorpusSelectorConfig

Discriminated union mirroring Java's sealed interface:

```typescript
type CorpusSelectorConfig =
  | { kind: 'state-machine'; initial: string;
      transitions: Map<string, Map<string, string>>;
      phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { kind: 'duration'; orderedPhases: DurationPhase[];
      phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { kind: 'lookup-count'; orderedPhases: CountPhase[];
      phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { kind: 'weighted'; weightedPhases: WeightedPhase[];
      phases: Map<string, InvocationRecord<unknown, unknown>[]> }

interface DurationPhase { name: string; durationMs: number }
interface CountPhase { name: string; count: number }
interface WeightedPhase { name: string; weight: number }
```

### SimulationStrategy<I, O>

```typescript
interface SimulationStrategy<I, O> {
  resolve(input: I): O | undefined;
  canResolve(input: I): boolean;
  dataRealism(): DataRealism;
}
```

### SimulationConfig

```typescript
interface SimulationConfig {
  strategyFor(qualifiedName: string): string | undefined;
  captureEnabled(qualifiedName: string): boolean;
  exhaustionPolicy(qualifiedName: string): ExhaustionPolicy | undefined;
  matchPolicy(qualifiedName: string): MatchPolicy | undefined;
  threshold(qualifiedName: string): number | undefined;
  speed(): number;
  fallthroughRealism(qualifiedName: string): DataRealism | undefined;
  corpusSelection(qualifiedName: string): CorpusSelectorConfig | undefined;
  corpusSelectionKeys(): string[];
  corpusSelectionGroup(qualifiedName: string): string | undefined;
  triggers(): TriggerConfig[];
}
```

`MapSimulationConfig` — default implementation backed by plain Maps/Records.

### Enums (string unions)

```typescript
type ExhaustionPolicy = 'WRAP' | 'THROW' | 'CLAMP';
type MatchPolicy = 'FIRST' | 'ALL';
type DataRealism = 'GARBAGE' | 'PLACEHOLDER' | 'STRUCTURALLY_VALID'
                 | 'DOMAIN_PLAUSIBLE' | 'RECORDED_REAL';
```

### Functional Interfaces

```typescript
type KeyExtractor<I> = (input: I) => string;
type SimilarityScorer<I> = (a: I, b: I) => number;
```

### Profile

```typescript
interface ProfileSource {
  resolve(name: string): SimulationProfile | undefined;
}
interface SimulationProfile {
  config: SimulationConfig;
  corpus: SimulationCorpus<unknown, unknown>;
}
```

---

## SimulationRuntime Expansion

### Constructor

```typescript
class SimulationRuntime {
  constructor(config: SimulationConfig, corpus: SimulationCorpus<unknown, unknown>)
}
```

### New Fields

- `extractors: Map<string, KeyExtractor<unknown>>` — per-qualified-name key extractors
- `scorers: Map<string, SimilarityScorer<unknown>>` — per-qualified-name similarity scorers
- `strategyCache: Map<string, SimulationStrategy<unknown, unknown>>` — memoized strategies
- `corpusSelectors: Map<string, CorpusSelector>` — active selectors
- `profileSource: ProfileSource | undefined`
- `globalSpeed: number`

### New Methods

- `registerExtractor(qualifiedName, extractor)` / `registerScorer(qualifiedName, scorer)`
- `apply(seed: CorpusSeed)` — seed corpus + register extractor
- `pushProfile(name)` — resolve via profileSource, push overlay
- `initializeSelectors()` — build selectors from config's corpusSelectionKeys
- `stateMachineSelector(qualifiedName): StateMachineSelector | undefined`
- `advanceStateMachine(qualifiedName, trigger)` — advance one selector
- `advanceStateMachines(trigger)` — advance all state machine selectors
- `stateMachineStates(): Map<string, string>` — snapshot of all SM states
- `allSelectorInfo(): Map<string, SelectorPhaseInfo>`
- `resetSelector(qualifiedName)`
- `setGlobalSpeed(speed)` / `globalSpeed()`

### Strategy Resolution

`createStrategy(qualifiedName, strategyName, corpus, config)`:

1. Check `config.corpusSelection(qn)` — if present, build a `CorpusSelector` via factory dispatch on `kind`
2. Wrap the corpus in `PhasedCorpus(selector, phases)`
3. Build the strategy from the (possibly wrapped) corpus:
   - `sequential` → `SequentialStrategy(corpus, qn, exhaustionPolicy)`
   - `key-lookup` → `KeyLookupStrategy(corpus, qn, extractor, matchPolicy, exhaustionPolicy)`
   - `random` → `RandomStrategy(corpus, qn)`
   - `recorded-replay` → `RecordedReplayStrategy(corpus, qn, extractor)`
   - `nearest-match` → `NearestMatchStrategy(corpus, qn, scorer, threshold)`
4. If selector exists, wrap strategy to call `selector.onResolved()` after each resolution

Aliases resolved: `seq`→`sequential`, `key`→`key-lookup`, `rand`→`random`, `replay`→`recorded-replay`, `nearest`→`nearest-match`.

### Overlay Stack Semantics (preserved)

`pushOverlay(config, corpus?)` creates a new `SimulationOverlay`, adds to stack, clears strategy cache. `popOverlay` removes and clears cache. Strategy lookups walk the stack top-down — overlay strategies take priority.

---

## Selectors

### StateMachineSelector

- `advance(trigger)` — atomically transitions: `currentState + trigger → transitions[currentState][trigger]`. No-op if no transition defined for the trigger in the current state.
- `activePhase()` — returns current state
- `onResolved()` — no-op (advances only on explicit triggers)
- `reset()` — returns to initial state

### DurationSelector

- `orderedPhases: DurationPhase[]` with cumulative durations
- Takes a `speedSupplier: () => number` from the runtime's `globalSpeed`
- `activePhase()` — computes elapsed time × speed, walks ordered phases to find current
- `onResolved()` — no-op (time-driven)
- `reset()` — resets start time

### LookupCountSelector

- `orderedPhases: CountPhase[]` with cumulative counts
- Tracks a resolution counter
- `activePhase()` — walks ordered phases, returns phase whose count range contains the counter
- `onResolved()` — increments counter
- Last phase is sticky (counter past total stays in final phase)
- `reset()` — resets counter to 0

### RandomSelector (Weighted)

- `weightedPhases: WeightedPhase[]` with weights
- `activePhase()` — picks randomly using cumulative weight distribution
- `onResolved()` — no-op (stateless)
- `reset()` — no-op

---

## Strategies

### SequentialStrategy (enhanced)

Existing sequential behavior enhanced with `ExhaustionPolicy`:
- **WRAP** — cycles back to start (current behavior)
- **CLAMP** — repeats last entry indefinitely
- **THROW** — throws on exhaustion

### KeyLookupStrategy (enhanced)

Existing key-lookup enhanced with:
- `KeyExtractor<I>` — pluggable key extraction (default: `String(input)`)
- `MatchPolicy` — FIRST returns first match, ALL returns all matches
- `ExhaustionPolicy` — applies when key has no match

### RandomStrategy (new)

Picks a random entry from the corpus for the qualified name.

### RecordedReplayStrategy (new)

Uses `KeyExtractor` to match input to a previously recorded corpus entry. For replay-based testing where real interactions were captured.

### NearestMatchStrategy (new)

Uses `SimilarityScorer` to find the closest matching corpus entry above a configurable threshold. For fuzzy matching in agent simulation.

---

## Streaming (#645)

### StreamingCorpusDatum

```typescript
interface StreamingCorpusDatum {
  text: string;
  chunkStrategy: 'word' | 'char';
  delayMs: number;
  inputTokens?: number;
  outputTokens?: number;
}
```

### chunkToStream utility

```typescript
async function* chunkToStream(datum: StreamingCorpusDatum): AsyncIterable<AgentEvent> {
  const chunks = datum.chunkStrategy === 'word'
    ? datum.text.split(/(\s+)/)
    : [...datum.text];
  for (const chunk of chunks) {
    if (datum.delayMs > 0) await delay(datum.delayMs);
    yield { kind: 'text-delta', text: chunk };
  }
  yield {
    kind: 'invocation-complete',
    inputTokens: datum.inputTokens ?? 0,
    outputTokens: datum.outputTokens ?? 0,
    durationMs: chunks.length * datum.delayMs,
  };
}
```

### SimulatedAgentSession

Implements `AgentSession`. Backed by a `SimulationCorpus` + `CorpusSelector`.

- `query(prompt)` — looks up next corpus entry, advances selector via `onResolved()`, returns streaming async iterable. If entry has streaming config, uses `chunkToStream`; otherwise wraps plain output in single `text-delta` + `invocation-complete`.
- `clear()` — resets the selector (resets turn counter for LookupCountSelector)

### SimulatedSessionPipeline

Implements `SessionPipeline`. Manages `Map<string, SimulatedAgentSession>`.

- `openSession(name, init, clearingPolicy)` — creates a `SimulatedAgentSession` with corpus scoped to the session's qualified name. Selector type from simulation config's `corpusSelection` — defaults to LookupCountSelector with single phase if not specified.
- `sessionFor(name)` — returns session or undefined
- `releaseSession(name)` — removes from map

---

## Per-Test Simulation Config

### TestCase extension

```typescript
interface TestCase {
  name: string;
  steps: Record<string, unknown>[];
  simulate?: Record<string, unknown>;  // per-test override
}
```

### YamlTestExecutor behavior

1. If `testFile.simulate` exists → parse via `SimulateBlockParser`, push overlay (file-level defaults)
2. If `testCase.simulate` exists → parse, push second overlay (per-test overrides)
3. Run setup → test steps → teardown
4. Pop overlays in reverse order

Overlay stack semantics mean per-test config naturally overrides file-level config.

### SimulateBlockParser extensions

New keys in the simulate block:

```yaml
simulate:
  agent:
    strategy: sequential
    exhaustion: clamp           # ExhaustionPolicy
    corpus:
      - prompt: "hello"
        response: "Hi there!"
        streaming:              # StreamingCorpusDatum config
          chunkStrategy: word
          delay: 50ms
    selection:                  # CorpusSelectorConfig
      kind: lookup-count
      phases:
        greeting: 1
        conversation: 3
        farewell: 1
```

The parser maps:
- `exhaustion` → `ExhaustionPolicy` on the config
- `streaming` on corpus entries → `StreamingCorpusDatum`
- `selection` → `CorpusSelectorConfig` discriminated by `kind`
- `selection.phases` → phase name → count/duration/weight depending on kind
- For `state-machine` kind: `selection.initial`, `selection.transitions`, `selection.phases`

---

## PhasedCorpus<I, O>

Read-only `SimulationCorpus` wrapper. Constructor takes `CorpusSelector` + `Map<string, InvocationRecord<I, O>[]>`.

- All read methods (`lookupByKey`, `lookupByIndex`, `list`) delegate to the active phase's entries only, determined by `selector.activePhase()`
- Write methods (`record`, `seed`, `clear`) throw — phased corpus is immutable; data is seeded at construction time via the phases map
- `size(qualifiedName)` returns the active phase's entry count

---

## Migration Path

1. Create `yaml-core/src/simulation/` with all new code
2. Create `yaml-core/src/simulation/index.ts` barrel with all exports
3. Update `yaml-core` package barrel to re-export `./simulation`
4. Update `step/simulation-runtime.ts` to re-export from `../simulation/` for backward compat
5. Update direct consumers (`SimulateBlockParser`, `SimulationDecorator`, `SimulationAwareInvokeHandler`, `VerifySimulationHandler`, `YamlTestExecutor`) to import from the new location
6. Remove the re-export shim once all consumers are migrated

---

## Testing Strategy

- **Unit tests per component:** Each selector, strategy, corpus implementation, and the runtime itself gets its own test file matching the Java test structure
- **Integration tests:** `YamlTestExecutor` tests with `.test.yaml` files that exercise the full stack (simulate block → parser → runtime → strategy → selector → corpus → session pipeline)
- **Streaming tests:** Verify `chunkToStream` produces correct event sequences with timing
- **Per-test config tests:** Verify overlay stacking with file-level + test-level simulate blocks

---

## References

- Java `simulation-core/src/main/java/io/casehub/platform/simulation/` — full reference implementation
- Java `StateMachineSelector.java` — state machine corpus selector
- Java `SimulationRuntime.java` — runtime with selector management, strategy caching, profiles
- TS `yaml-core/src/step/simulation-runtime.ts` — existing TS simulation runtime
- TS `yaml-core/src/test/simulate-block-parser.ts` — existing parser
- TS `yaml-core/src/step/invoke/session-pipeline.ts` — SessionPipeline/AgentSession interfaces
- TS `yaml-core/src/test/yaml-test-executor.ts` — test executor with simulate block support
- `docs/specs/2026-11-07-ts-platform-parity-audit.md` Part 10, P6 — audit gap description
- casehubio/casehub-pages#645 — streaming simulation API issue
- casehubio/casehub-pages#647 — phase-aware agent simulation issue
- casehubio/casehub-pages#608 — parent epic
