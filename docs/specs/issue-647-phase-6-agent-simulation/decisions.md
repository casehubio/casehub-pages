## D1: Simulation code organization

**Choice:** New `yaml-core/src/simulation/` subdirectory
**Alternatives:**
- New `pages-simulation` package — clean boundary but adds cross-package dependency; risk of circular deps with step types
- Keep flat in `step/` — simplest but `step/` already has 20+ files, poor navigation at scale
**Rationale:** The simulation system is growing to match Java's `simulation-core` (30+ files). A subdirectory gives room to grow without the overhead of a new package. yaml-core is the natural home since simulation is consumed by Walker and Evaluator.
**Trade-offs:** Less isolation than a separate package; simulation types share yaml-core's versioning.
**Sources:** Java `simulation-core` module structure, TS `yaml-core/src/step/simulation-runtime.ts`
**Exploration:** quick
**Status:** captured

## D2: SimulationCorpus interface typing

**Choice:** Full generic port — `SimulationCorpus<I, O>` with typed generics matching Java
**Alternatives:**
- Type-erased (`unknown`) — simpler, but breaks the parity principle when Java has typed generics
- Keep CorpusDatum arrays — no interface abstraction, blocks PhasedCorpus wrapping
**Rationale:** Full Java parity is the standing rule. The generic interface matches Java's `SimulationCorpus<I, O>` exactly. Callsites that handle mixed action types can use `SimulationCorpus<unknown, unknown>`.
**Trade-offs:** More verbose at heterogeneous call sites where generics resolve to `unknown`.
**Sources:** Java `SimulationCorpus<I, O>` interface, current TS `CorpusDatum` type
**Exploration:** quick
**Status:** captured

## D3: Streaming corpus design

**Choice:** Corpus-level streaming — `StreamingCorpusDatum` with per-entry chunk config (delay, split strategy). Strategy returns `StreamingResult` with `AsyncIterable<AgentEvent>` factory.
**Alternatives:**
- Wrapper in SimulatedSessionPipeline — simpler corpus but uniform chunking, can't vary delay per corpus entry
**Rationale:** Chunking config (inter-chunk delay, word/character split) is per-corpus-entry data, not session pipeline logic. Different simulated agent responses should be able to stream at different speeds.
**Trade-offs:** More complex corpus entry type; strategies need to handle both plain and streaming resolution.
**Depends on:** D2 (SimulationCorpus interface — streaming entries stored in the corpus)
**Sources:** #645 issue scope, Java SimulationCorpus, TS AgentEvent type
**Exploration:** quick
**Status:** captured

## D4: Session-aware corpus tracking

**Choice:** Corpus-level sessions — corpus entries keyed by session name + turn. CorpusSelector (especially LookupCount) handles turn-based phase transitions. Sessions and phases are the same abstraction.
**Alternatives:**
- Pipeline-only tracking — SimulatedSessionPipeline owns Map<name, turnCount>, corpus stays session-unaware. Duplicates phase logic.
**Rationale:** A session's conversation turns are fundamentally a phase sequence. The selector system already handles "advance after N lookups" (LookupCountSelector) and "advance on trigger" (StateMachineSelector). Reusing this avoids duplicating the concept.
**Trade-offs:** More complex corpus interface; session lifecycle (open/clear/close) must be visible to the corpus.
**Depends on:** D2 (SimulationCorpus interface), D3 (streaming corpus)
**Sources:** #645 scope (session-aware corpus, clear resets), Java CorpusSelector.onResolved()
**Exploration:** quick
**Status:** captured
