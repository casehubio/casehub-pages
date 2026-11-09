# Full Simulation Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #647 — feat: Phase 6 — phase-aware agent simulation
**Issue group:** #645, #647 (streaming simulation + phase-aware selectors)

**Goal:** Bring TS simulation infrastructure to full parity with Java's `simulation-core` module — typed generic corpus, 5 strategies, 4 selectors, phased corpus, streaming, session simulation, profiles, per-test config.

**Architecture:** New `yaml-core/src/simulation/` directory mirrors Java's `simulation-core`. Types and interfaces form the foundation. Selectors route corpus lookups by phase. PhasedCorpus wraps a selector + phase map. Strategies resolve inputs via corpus entries. SimulationRuntime ties it all together with overlay stacking, caching, and selector management. Streaming and sessions layer on top for agent simulation.

**Tech Stack:** TypeScript, Vitest, yaml-core package internals

## Global Constraints

- Full Java `simulation-core` parity — every type, interface, and behavior
- All new code under `packages/yaml-core/src/simulation/`
- Existing consumers must continue working via re-export shim during migration
- Test command: `npx vitest run <test-file>` from `packages/yaml-core/`
- Import style: relative `.js` extension imports (ESM)

---

## Batch 1: Foundation — Types, Corpus, Config

### Task 1: Shared types, corpus interface, InMemorySimulationCorpus, config, journal

**Files:**
- Create: `packages/yaml-core/src/simulation/types.ts`
- Create: `packages/yaml-core/src/simulation/key-extractor.ts`
- Create: `packages/yaml-core/src/simulation/similarity-scorer.ts`
- Create: `packages/yaml-core/src/simulation/corpus.ts`
- Create: `packages/yaml-core/src/simulation/in-memory-corpus.ts`
- Create: `packages/yaml-core/src/simulation/in-memory-corpus.test.ts`
- Create: `packages/yaml-core/src/simulation/config.ts`
- Create: `packages/yaml-core/src/simulation/config.test.ts`
- Create: `packages/yaml-core/src/simulation/journal.ts`
- Create: `packages/yaml-core/src/simulation/profile.ts`

**Interfaces:**
- Consumes: nothing (foundation layer)
- Produces:
  - `DataRealism` — `'GARBAGE' | 'PLACEHOLDER' | 'STRUCTURALLY_VALID' | 'DOMAIN_PLAUSIBLE' | 'RECORDED_REAL'`
  - `ExhaustionPolicy` — `'WRAP' | 'THROW' | 'CLAMP'`
  - `MatchPolicy` — `'FIRST' | 'ALL'`
  - `InvocationRecord<I, O>` — `{ tenancyId: string; key: string; input: I; output: O; recordedAt: number }`
  - `JournalEntry` — `{ qualifiedName: string; tenancyId: string; input: unknown; output: unknown; timestamp: number; dataRealism: DataRealism }`
  - `DurationPhase` — `{ name: string; durationMs: number }`
  - `CountPhase` — `{ name: string; count: number }`
  - `WeightedPhase` — `{ name: string; weight: number }`
  - `SelectorPhaseInfo` — `{ type: string; activePhase: string }`
  - `CorpusSelectorConfig` — discriminated union with kinds: `'state-machine'`, `'duration'`, `'lookup-count'`, `'weighted'`
  - `TriggerConfig` — `{ event: string; action: string }`
  - `KeyExtractor<I>` — `(input: I) => string`
  - `SimilarityScorer<I>` — `(a: I, b: I) => number`
  - `SimulationCorpus<I, O>` — interface with `lookupByKey`, `lookupAllByKey`, `lookupByIndex`, `list`, `listByTenant`, `record`, `seed`, `clear`, `size`
  - `InMemorySimulationCorpus<I, O>` — class implementing `SimulationCorpus<I, O>`
  - `SimulationConfig` — interface with `strategyFor`, `captureEnabled`, `exhaustionPolicy`, `matchPolicy`, `threshold`, `speed`, `fallthroughRealism`, `corpusSelection`, `corpusSelectionKeys`, `corpusSelectionGroup`, `triggers`
  - `MapSimulationConfig` — class implementing `SimulationConfig` backed by maps
  - `InvocationJournal` — class with `record`, `entries`, `entriesFor`, `countFor`
  - `ProfileSource` — `{ resolve(name: string): SimulationProfile | undefined }`
  - `SimulationProfile` — `{ config: SimulationConfig; corpus: SimulationCorpus<unknown, unknown> }`

- [ ] **Step 1: Write types.ts**

```typescript
// packages/yaml-core/src/simulation/types.ts

export type DataRealism =
  | 'GARBAGE' | 'PLACEHOLDER' | 'STRUCTURALLY_VALID'
  | 'DOMAIN_PLAUSIBLE' | 'RECORDED_REAL';

export type ExhaustionPolicy = 'WRAP' | 'THROW' | 'CLAMP';

export type MatchPolicy = 'FIRST' | 'ALL';

export interface InvocationRecord<I, O> {
  readonly tenancyId: string;
  readonly key: string;
  readonly input: I;
  readonly output: O;
  readonly recordedAt: number;
}

export interface JournalEntry {
  readonly qualifiedName: string;
  readonly tenancyId: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly timestamp: number;
  readonly dataRealism: DataRealism;
}

export interface DurationPhase {
  readonly name: string;
  readonly durationMs: number;
}

export interface CountPhase {
  readonly name: string;
  readonly count: number;
}

export interface WeightedPhase {
  readonly name: string;
  readonly weight: number;
}

export interface SelectorPhaseInfo {
  readonly type: string;
  readonly activePhase: string;
}

export type CorpusSelectorConfig =
  | { readonly kind: 'state-machine'; readonly initial: string;
      readonly transitions: Map<string, Map<string, string>>;
      readonly phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { readonly kind: 'duration'; readonly orderedPhases: DurationPhase[];
      readonly phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { readonly kind: 'lookup-count'; readonly orderedPhases: CountPhase[];
      readonly phases: Map<string, InvocationRecord<unknown, unknown>[]> }
  | { readonly kind: 'weighted'; readonly weightedPhases: WeightedPhase[];
      readonly phases: Map<string, InvocationRecord<unknown, unknown>[]> };

export interface TriggerConfig {
  readonly event: string;
  readonly action: string;
}
```

- [ ] **Step 2: Write key-extractor.ts and similarity-scorer.ts**

```typescript
// packages/yaml-core/src/simulation/key-extractor.ts
export type KeyExtractor<I> = (input: I) => string;
```

```typescript
// packages/yaml-core/src/simulation/similarity-scorer.ts
export type SimilarityScorer<I> = (a: I, b: I) => number;
```

- [ ] **Step 3: Write corpus.ts (interface)**

```typescript
// packages/yaml-core/src/simulation/corpus.ts
import type { InvocationRecord } from './types.js';

export interface SimulationCorpus<I, O> {
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

- [ ] **Step 4: Write failing tests for InMemorySimulationCorpus**

```typescript
// packages/yaml-core/src/simulation/in-memory-corpus.test.ts
import { describe, it, expect } from 'vitest';
import { InMemorySimulationCorpus } from './in-memory-corpus.js';

describe('InMemorySimulationCorpus', () => {
  it('starts empty for unknown qualified names', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    expect(corpus.size('foo')).toBe(0);
    expect(corpus.list('foo')).toEqual([]);
  });

  it('records and lists entries', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'tenant1', 'in', 'out');
    expect(corpus.size('action')).toBe(1);
    const entries = corpus.list('action');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.input).toBe('in');
    expect(entries[0]!.output).toBe('out');
    expect(entries[0]!.tenancyId).toBe('tenant1');
  });

  it('records with key and looks up by key', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'tenant1', 'in', 'out', 'key1');
    expect(corpus.lookupByKey('action', 'key1')).toBe('out');
    expect(corpus.lookupByKey('action', 'key2')).toBeUndefined();
  });

  it('lookupAllByKey returns all matches', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't1', 'in1', 'out1', 'k');
    corpus.record('action', 't2', 'in2', 'out2', 'k');
    expect(corpus.lookupAllByKey('action', 'k')).toEqual(['out1', 'out2']);
  });

  it('lookupByIndex returns entry at position', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'in1', 'out1');
    corpus.record('action', 't', 'in2', 'out2');
    expect(corpus.lookupByIndex('action', 0)).toBe('out1');
    expect(corpus.lookupByIndex('action', 1)).toBe('out2');
    expect(corpus.lookupByIndex('action', 2)).toBeUndefined();
  });

  it('listByTenant filters by tenancy', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 'a', 'in1', 'out1');
    corpus.record('action', 'b', 'in2', 'out2');
    expect(corpus.listByTenant('action', 'a')).toHaveLength(1);
    expect(corpus.listByTenant('action', 'a')[0]!.input).toBe('in1');
  });

  it('seed replaces entries for qualified name', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'old', 'old');
    corpus.seed('action', [
      { tenancyId: 't', key: '', input: 'new', output: 'new', recordedAt: Date.now() },
    ]);
    expect(corpus.size('action')).toBe(1);
    expect(corpus.list('action')[0]!.input).toBe('new');
  });

  it('clear removes all entries for qualified name', () => {
    const corpus = new InMemorySimulationCorpus<string, string>();
    corpus.record('action', 't', 'in', 'out');
    corpus.clear('action');
    expect(corpus.size('action')).toBe(0);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/simulation/in-memory-corpus.test.ts` from `packages/yaml-core/`
Expected: FAIL — `InMemorySimulationCorpus` not found

- [ ] **Step 6: Implement InMemorySimulationCorpus**

```typescript
// packages/yaml-core/src/simulation/in-memory-corpus.ts
import type { InvocationRecord } from './types.js';
import type { SimulationCorpus } from './corpus.js';

export class InMemorySimulationCorpus<I, O> implements SimulationCorpus<I, O> {
  private readonly data = new Map<string, InvocationRecord<I, O>[]>();

  lookupByKey(qualifiedName: string, key: string): O | undefined {
    const entries = this.data.get(qualifiedName);
    if (!entries) return undefined;
    const match = entries.find(e => e.key === key);
    return match?.output;
  }

  lookupAllByKey(qualifiedName: string, key: string): O[] {
    const entries = this.data.get(qualifiedName);
    if (!entries) return [];
    return entries.filter(e => e.key === key).map(e => e.output);
  }

  lookupByIndex(qualifiedName: string, index: number): O | undefined {
    const entries = this.data.get(qualifiedName);
    if (!entries || index < 0 || index >= entries.length) return undefined;
    return entries[index]!.output;
  }

  list(qualifiedName: string): InvocationRecord<I, O>[] {
    return this.data.get(qualifiedName) ?? [];
  }

  listByTenant(qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[] {
    return this.list(qualifiedName).filter(e => e.tenancyId === tenancyId);
  }

  record(qualifiedName: string, tenancyId: string, input: I, output: O, key?: string): void {
    if (!this.data.has(qualifiedName)) this.data.set(qualifiedName, []);
    this.data.get(qualifiedName)!.push({
      tenancyId, key: key ?? '', input, output, recordedAt: Date.now(),
    });
  }

  seed(qualifiedName: string, records: InvocationRecord<I, O>[]): void {
    this.data.set(qualifiedName, [...records]);
  }

  clear(qualifiedName: string): void {
    this.data.delete(qualifiedName);
  }

  size(qualifiedName: string): number {
    return this.data.get(qualifiedName)?.length ?? 0;
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/simulation/in-memory-corpus.test.ts` from `packages/yaml-core/`
Expected: PASS

- [ ] **Step 8: Write journal.ts (migrate from simulation-runtime.ts)**

```typescript
// packages/yaml-core/src/simulation/journal.ts
import type { JournalEntry, DataRealism } from './types.js';

export class InvocationJournal {
  private readonly _entries: JournalEntry[] = [];

  record(qualifiedName: string, tenancyId: string, input: unknown,
         output: unknown, dataRealism: DataRealism): void {
    this._entries.push({
      qualifiedName, tenancyId, input, output,
      timestamp: Date.now(), dataRealism,
    });
  }

  entries(): readonly JournalEntry[] { return this._entries; }

  entriesFor(qualifiedName: string): readonly JournalEntry[] {
    return this._entries.filter(e => e.qualifiedName === qualifiedName);
  }

  countFor(qualifiedName: string): number {
    return this._entries.filter(e => e.qualifiedName === qualifiedName).length;
  }
}
```

- [ ] **Step 9: Write config.ts with failing tests, then implement MapSimulationConfig**

Write `config.test.ts` testing: `strategyFor` returns configured strategy, `corpusSelection` returns configured selector config, `speed` defaults to 1.0, `fallthroughRealism` returns configured value.

Write `config.ts` with `SimulationConfig` interface and `MapSimulationConfig` class backed by `Map`/`Record` fields, constructor taking optional partial config.

Run: `npx vitest run src/simulation/config.test.ts` from `packages/yaml-core/`
Expected: PASS

- [ ] **Step 10: Write profile.ts**

```typescript
// packages/yaml-core/src/simulation/profile.ts
import type { SimulationConfig } from './config.js';
import type { SimulationCorpus } from './corpus.js';

export interface SimulationProfile {
  readonly config: SimulationConfig;
  readonly corpus: SimulationCorpus<unknown, unknown>;
}

export interface ProfileSource {
  resolve(name: string): SimulationProfile | undefined;
}
```

- [ ] **Step 11: Commit**

```bash
git add packages/yaml-core/src/simulation/
git commit -m "feat(#647): simulation foundation — types, corpus, config, journal, profile

Refs #647"
```

---

## Batch 2: Selectors & PhasedCorpus

### Task 2: CorpusSelector interface + all 4 selector implementations

**Files:**
- Create: `packages/yaml-core/src/simulation/selectors/corpus-selector.ts`
- Create: `packages/yaml-core/src/simulation/selectors/state-machine.ts`
- Create: `packages/yaml-core/src/simulation/selectors/state-machine.test.ts`
- Create: `packages/yaml-core/src/simulation/selectors/duration.ts`
- Create: `packages/yaml-core/src/simulation/selectors/duration.test.ts`
- Create: `packages/yaml-core/src/simulation/selectors/lookup-count.ts`
- Create: `packages/yaml-core/src/simulation/selectors/lookup-count.test.ts`
- Create: `packages/yaml-core/src/simulation/selectors/weighted.ts`
- Create: `packages/yaml-core/src/simulation/selectors/weighted.test.ts`

**Interfaces:**
- Consumes: `DurationPhase`, `CountPhase`, `WeightedPhase` from `types.ts`
- Produces:
  - `CorpusSelector` — interface `{ activePhase(): string; type(): string; onResolved(): void; reset(): void }`
  - `StateMachineSelector` — class with `advance(trigger: string): void`
  - `DurationSelector` — class taking `orderedPhases: DurationPhase[]`, `speedSupplier: () => number`
  - `LookupCountSelector` — class taking `orderedPhases: CountPhase[]`
  - `RandomSelector` — class taking `weightedPhases: WeightedPhase[]`

- [ ] **Step 1: Write corpus-selector.ts (interface)**

```typescript
// packages/yaml-core/src/simulation/selectors/corpus-selector.ts
export interface CorpusSelector {
  activePhase(): string;
  type(): string;
  onResolved(): void;
  reset(): void;
}
```

- [ ] **Step 2: Write failing tests for StateMachineSelector**

Test cases:
- starts in initial state
- `advance(trigger)` transitions to target state
- `advance` with unknown trigger is no-op
- `advance` in terminal state (no transitions) is no-op
- `reset()` returns to initial
- `type()` returns `'state-machine'`
- `onResolved()` is no-op (state doesn't change)

- [ ] **Step 3: Run tests — verify fail**

- [ ] **Step 4: Implement StateMachineSelector**

```typescript
// packages/yaml-core/src/simulation/selectors/state-machine.ts
import type { CorpusSelector } from './corpus-selector.js';

export class StateMachineSelector implements CorpusSelector {
  private readonly initial: string;
  private readonly transitions: Map<string, Map<string, string>>;
  private currentState: string;

  constructor(initial: string, transitions: Map<string, Map<string, string>>) {
    this.initial = initial;
    this.transitions = transitions;
    this.currentState = initial;
  }

  activePhase(): string { return this.currentState; }
  type(): string { return 'state-machine'; }
  onResolved(): void { /* no-op — advances only on explicit triggers */ }

  reset(): void { this.currentState = this.initial; }

  advance(trigger: string): void {
    const stateTransitions = this.transitions.get(this.currentState);
    if (!stateTransitions) return;
    const next = stateTransitions.get(trigger);
    if (next !== undefined) this.currentState = next;
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

- [ ] **Step 6: Write failing tests for LookupCountSelector**

Test cases:
- starts in first phase
- advances to next phase after count lookups via `onResolved()`
- last phase is sticky (stays in final phase past total count)
- `reset()` returns to first phase
- `type()` returns `'lookup-count'`

- [ ] **Step 7: Implement LookupCountSelector**

```typescript
// packages/yaml-core/src/simulation/selectors/lookup-count.ts
import type { CorpusSelector } from './corpus-selector.js';
import type { CountPhase } from '../types.js';

export class LookupCountSelector implements CorpusSelector {
  private readonly orderedPhases: CountPhase[];
  private counter = 0;

  constructor(orderedPhases: CountPhase[]) {
    this.orderedPhases = orderedPhases;
  }

  activePhase(): string {
    let cumulative = 0;
    for (const phase of this.orderedPhases) {
      cumulative += phase.count;
      if (this.counter < cumulative) return phase.name;
    }
    return this.orderedPhases[this.orderedPhases.length - 1]!.name;
  }

  type(): string { return 'lookup-count'; }
  onResolved(): void { this.counter++; }
  reset(): void { this.counter = 0; }
}
```

- [ ] **Step 8: Run tests — verify pass**

- [ ] **Step 9: Write failing tests + implement DurationSelector**

Test cases:
- starts in first phase
- advances to next phase after elapsed time × speed
- speed multiplier affects phase timing
- `reset()` restarts the clock
- `type()` returns `'duration'`
- `onResolved()` is no-op

```typescript
// packages/yaml-core/src/simulation/selectors/duration.ts
import type { CorpusSelector } from './corpus-selector.js';
import type { DurationPhase } from '../types.js';

export class DurationSelector implements CorpusSelector {
  private readonly orderedPhases: DurationPhase[];
  private readonly speedSupplier: () => number;
  private startTime: number;

  constructor(orderedPhases: DurationPhase[], speedSupplier: () => number) {
    this.orderedPhases = orderedPhases;
    this.speedSupplier = speedSupplier;
    this.startTime = Date.now();
  }

  activePhase(): string {
    const elapsed = (Date.now() - this.startTime) * this.speedSupplier();
    let cumulative = 0;
    for (const phase of this.orderedPhases) {
      cumulative += phase.durationMs;
      if (elapsed < cumulative) return phase.name;
    }
    return this.orderedPhases[this.orderedPhases.length - 1]!.name;
  }

  type(): string { return 'duration'; }
  onResolved(): void { /* time-driven, no-op */ }
  reset(): void { this.startTime = Date.now(); }
}
```

Use `vi.useFakeTimers()` in tests to control time progression.

- [ ] **Step 10: Run tests — verify pass**

- [ ] **Step 11: Write failing tests + implement RandomSelector (Weighted)**

Test cases:
- returns a phase name from the weighted list
- with single phase (weight 1.0), always returns that phase
- `type()` returns `'weighted'`
- `onResolved()` and `reset()` are no-ops

```typescript
// packages/yaml-core/src/simulation/selectors/weighted.ts
import type { CorpusSelector } from './corpus-selector.js';
import type { WeightedPhase } from '../types.js';

export class RandomSelector implements CorpusSelector {
  private readonly weightedPhases: WeightedPhase[];
  private readonly totalWeight: number;

  constructor(weightedPhases: WeightedPhase[]) {
    this.weightedPhases = weightedPhases;
    this.totalWeight = weightedPhases.reduce((sum, p) => sum + p.weight, 0);
  }

  activePhase(): string {
    const r = Math.random() * this.totalWeight;
    let cumulative = 0;
    for (const phase of this.weightedPhases) {
      cumulative += phase.weight;
      if (r < cumulative) return phase.name;
    }
    return this.weightedPhases[this.weightedPhases.length - 1]!.name;
  }

  type(): string { return 'weighted'; }
  onResolved(): void { /* stateless */ }
  reset(): void { /* stateless */ }
}
```

- [ ] **Step 12: Run tests — verify pass**

- [ ] **Step 13: Commit**

```bash
git add packages/yaml-core/src/simulation/selectors/
git commit -m "feat(#647): CorpusSelector interface + all 4 selector implementations

StateMachineSelector, LookupCountSelector, DurationSelector, RandomSelector

Refs #647"
```

### Task 3: PhasedCorpus

**Files:**
- Create: `packages/yaml-core/src/simulation/phased-corpus.ts`
- Create: `packages/yaml-core/src/simulation/phased-corpus.test.ts`

**Interfaces:**
- Consumes: `SimulationCorpus<I, O>` from `corpus.ts`, `CorpusSelector` from `selectors/corpus-selector.ts`, `InvocationRecord<I, O>` from `types.ts`
- Produces: `PhasedCorpus<I, O>` — class implementing `SimulationCorpus<I, O>`, read-only, delegates to active phase

- [ ] **Step 1: Write failing tests for PhasedCorpus**

Test cases:
- delegates `list()` to active phase's entries
- `lookupByIndex()` returns from active phase only
- `lookupByKey()` returns from active phase only
- `size()` returns active phase entry count
- switching selector phase changes which entries are returned
- `record()` throws (read-only)
- `seed()` throws (read-only)
- `clear()` throws (read-only)

```typescript
// packages/yaml-core/src/simulation/phased-corpus.test.ts
import { describe, it, expect } from 'vitest';
import { PhasedCorpus } from './phased-corpus.js';
import { LookupCountSelector } from './selectors/lookup-count.js';
import type { InvocationRecord } from './types.js';

function rec(input: string, output: string, key = ''): InvocationRecord<string, string> {
  return { tenancyId: '', key, input, output, recordedAt: 0 };
}

describe('PhasedCorpus', () => {
  it('delegates list to active phase', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 2 }, { name: 'b', count: 2 }]);
    const phases = new Map([
      ['a', [rec('in-a', 'out-a')]],
      ['b', [rec('in-b', 'out-b')]],
    ]);
    const corpus = new PhasedCorpus(selector, phases);

    expect(corpus.list('any')).toEqual([rec('in-a', 'out-a')]);
    selector.onResolved();
    selector.onResolved();
    expect(corpus.list('any')).toEqual([rec('in-b', 'out-b')]);
  });

  it('throws on record', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus(selector, new Map([['a', []]]));
    expect(() => corpus.record('q', 't', 'in', 'out')).toThrow();
  });

  it('throws on seed', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus(selector, new Map([['a', []]]));
    expect(() => corpus.seed('q', [])).toThrow();
  });

  it('throws on clear', () => {
    const selector = new LookupCountSelector([{ name: 'a', count: 1 }]);
    const corpus = new PhasedCorpus(selector, new Map([['a', []]]));
    expect(() => corpus.clear('q')).toThrow();
  });
});
```

- [ ] **Step 2: Run test — verify fail**

- [ ] **Step 3: Implement PhasedCorpus**

```typescript
// packages/yaml-core/src/simulation/phased-corpus.ts
import type { InvocationRecord } from './types.js';
import type { SimulationCorpus } from './corpus.js';
import type { CorpusSelector } from './selectors/corpus-selector.js';

export class PhasedCorpus<I, O> implements SimulationCorpus<I, O> {
  constructor(
    private readonly selector: CorpusSelector,
    private readonly phases: Map<string, InvocationRecord<I, O>[]>,
  ) {}

  private activeEntries(): InvocationRecord<I, O>[] {
    return this.phases.get(this.selector.activePhase()) ?? [];
  }

  lookupByKey(_qualifiedName: string, key: string): O | undefined {
    return this.activeEntries().find(e => e.key === key)?.output;
  }

  lookupAllByKey(_qualifiedName: string, key: string): O[] {
    return this.activeEntries().filter(e => e.key === key).map(e => e.output);
  }

  lookupByIndex(_qualifiedName: string, index: number): O | undefined {
    const entries = this.activeEntries();
    return index >= 0 && index < entries.length ? entries[index]!.output : undefined;
  }

  list(_qualifiedName: string): InvocationRecord<I, O>[] {
    return this.activeEntries();
  }

  listByTenant(_qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[] {
    return this.activeEntries().filter(e => e.tenancyId === tenancyId);
  }

  record(): void { throw new Error('PhasedCorpus is read-only'); }
  seed(): void { throw new Error('PhasedCorpus is read-only'); }
  clear(): void { throw new Error('PhasedCorpus is read-only'); }

  size(_qualifiedName: string): number {
    return this.activeEntries().length;
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/yaml-core/src/simulation/phased-corpus.*
git commit -m "feat(#647): PhasedCorpus — read-only corpus wrapper with selector-driven phase routing

Refs #647"
```

---

## Batch 3: Strategies

### Task 4: SimulationStrategy interface + SequentialStrategy + KeyLookupStrategy

**Files:**
- Create: `packages/yaml-core/src/simulation/strategies/simulation-strategy.ts`
- Create: `packages/yaml-core/src/simulation/strategies/sequential.ts`
- Create: `packages/yaml-core/src/simulation/strategies/sequential.test.ts`
- Create: `packages/yaml-core/src/simulation/strategies/key-lookup.ts`
- Create: `packages/yaml-core/src/simulation/strategies/key-lookup.test.ts`

**Interfaces:**
- Consumes: `SimulationCorpus<I, O>`, `InvocationRecord<I, O>`, `DataRealism`, `ExhaustionPolicy`, `MatchPolicy`, `KeyExtractor<I>`
- Produces:
  - `SimulationStrategy<I, O>` — interface `{ resolve(input: I): O | undefined; canResolve(input: I): boolean; dataRealism(): DataRealism }`
  - `SequentialStrategy<I, O>` — class taking `corpus`, `qualifiedName`, `exhaustionPolicy`
  - `KeyLookupStrategy<I, O>` — class taking `corpus`, `qualifiedName`, `extractor`, `matchPolicy`, `exhaustionPolicy`

- [ ] **Step 1: Write simulation-strategy.ts (interface)**

```typescript
// packages/yaml-core/src/simulation/strategies/simulation-strategy.ts
import type { DataRealism } from '../types.js';

export interface SimulationStrategy<I, O> {
  resolve(input: I): O | undefined;
  canResolve(input: I): boolean;
  dataRealism(): DataRealism;
}
```

- [ ] **Step 2: Write failing tests for SequentialStrategy**

Test cases:
- resolves entries in order
- WRAP policy: cycles back to start after exhaustion
- CLAMP policy: repeats last entry after exhaustion
- THROW policy: throws after exhaustion
- `canResolve()` returns true when corpus has entries
- `dataRealism()` returns `'DOMAIN_PLAUSIBLE'`

- [ ] **Step 3: Implement SequentialStrategy**

The strategy maintains a counter per qualified name. On `resolve(input)`, looks up corpus entry at counter position, increments. On exhaustion, applies the configured `ExhaustionPolicy`.

- [ ] **Step 4: Run tests — verify pass**

- [ ] **Step 5: Write failing tests for KeyLookupStrategy**

Test cases:
- extracts key via `KeyExtractor`, looks up corpus entry by key
- FIRST match policy: returns first matching entry
- ALL match policy: returns all matching entries (first one from resolve)
- no match returns undefined
- `canResolve()` returns true when key has a match

- [ ] **Step 6: Implement KeyLookupStrategy**

- [ ] **Step 7: Run tests — verify pass**

- [ ] **Step 8: Commit**

```bash
git add packages/yaml-core/src/simulation/strategies/
git commit -m "feat(#647): SimulationStrategy interface + SequentialStrategy + KeyLookupStrategy

SequentialStrategy with WRAP/CLAMP/THROW exhaustion policies.
KeyLookupStrategy with KeyExtractor and FIRST/ALL match policies.

Refs #647"
```

### Task 5: RandomStrategy + RecordedReplayStrategy + NearestMatchStrategy

**Files:**
- Create: `packages/yaml-core/src/simulation/strategies/random.ts`
- Create: `packages/yaml-core/src/simulation/strategies/random.test.ts`
- Create: `packages/yaml-core/src/simulation/strategies/recorded-replay.ts`
- Create: `packages/yaml-core/src/simulation/strategies/recorded-replay.test.ts`
- Create: `packages/yaml-core/src/simulation/strategies/nearest-match.ts`
- Create: `packages/yaml-core/src/simulation/strategies/nearest-match.test.ts`

**Interfaces:**
- Consumes: `SimulationStrategy<I, O>`, `SimulationCorpus<I, O>`, `KeyExtractor<I>`, `SimilarityScorer<I>`, `DataRealism`
- Produces:
  - `RandomStrategy<I, O>` — class taking `corpus`, `qualifiedName`
  - `RecordedReplayStrategy<I, O>` — class taking `corpus`, `qualifiedName`, `extractor`
  - `NearestMatchStrategy<I, O>` — class taking `corpus`, `qualifiedName`, `scorer`, `threshold`

- [ ] **Step 1: Write failing tests for RandomStrategy**

Test cases:
- resolves a random entry from corpus
- `canResolve()` true when corpus has entries, false when empty
- `dataRealism()` returns `'DOMAIN_PLAUSIBLE'`

- [ ] **Step 2: Implement RandomStrategy**

```typescript
// packages/yaml-core/src/simulation/strategies/random.ts
import type { SimulationStrategy } from './simulation-strategy.js';
import type { SimulationCorpus } from '../corpus.js';
import type { DataRealism } from '../types.js';

export class RandomStrategy<I, O> implements SimulationStrategy<I, O> {
  constructor(
    private readonly corpus: SimulationCorpus<I, O>,
    private readonly qualifiedName: string,
  ) {}

  resolve(_input: I): O | undefined {
    const entries = this.corpus.list(this.qualifiedName);
    if (entries.length === 0) return undefined;
    const idx = Math.floor(Math.random() * entries.length);
    return entries[idx]!.output;
  }

  canResolve(_input: I): boolean {
    return this.corpus.size(this.qualifiedName) > 0;
  }

  dataRealism(): DataRealism { return 'DOMAIN_PLAUSIBLE'; }
}
```

- [ ] **Step 3: Run tests — verify pass**

- [ ] **Step 4: Write failing tests + implement RecordedReplayStrategy**

Uses `KeyExtractor` to extract a key from input, then looks up by key in corpus. Test cases: replays recorded entry by key match; returns undefined for unrecorded key.

- [ ] **Step 5: Run tests — verify pass**

- [ ] **Step 6: Write failing tests + implement NearestMatchStrategy**

Iterates corpus entries, scores each via `SimilarityScorer`, returns the highest-scoring entry above threshold. Test cases: returns closest match above threshold; returns undefined when all below threshold; returns highest scorer when multiple match.

- [ ] **Step 7: Run tests — verify pass**

- [ ] **Step 8: Commit**

```bash
git add packages/yaml-core/src/simulation/strategies/
git commit -m "feat(#647): RandomStrategy + RecordedReplayStrategy + NearestMatchStrategy

Refs #647"
```

---

## Batch 4: SimulationRuntime Expansion & Migration

### Task 6: SimulationOverlay, SimulationRuntime expansion, barrel exports, re-export shim

**Files:**
- Create: `packages/yaml-core/src/simulation/overlay.ts`
- Create: `packages/yaml-core/src/simulation/runtime.ts`
- Create: `packages/yaml-core/src/simulation/runtime.test.ts`
- Create: `packages/yaml-core/src/simulation/index.ts`
- Modify: `packages/yaml-core/src/step/simulation-runtime.ts` — convert to re-export shim
- Modify: `packages/yaml-core/src/step/index.ts` — update simulation exports

**Interfaces:**
- Consumes: All types, corpus, config, selectors, strategies, profiles from prior tasks
- Produces:
  - `SimulationOverlay` — class holding `config: SimulationConfig`, `corpus: SimulationCorpus`, `journal: InvocationJournal`, `strategyCache: Map`
  - `SimulationRuntime` — class with constructor `(config: SimulationConfig, corpus: SimulationCorpus)`, overlay stack, strategy resolution via `createStrategy()`, selector management (`advanceStateMachine`, `advanceStateMachines`, `stateMachineStates`, `allSelectorInfo`, `resetSelector`), profiles (`pushProfile`), speed (`globalSpeed`, `setGlobalSpeed`), extractors/scorers registration
  - Backward-compatible re-exports: `DataRealism`, `JournalEntry`, `CorpusDatum`, `CorpusEntry`, `SimulationConfig` (legacy shape), `InvocationJournal`, `SimulationOverlay`, `SimulationRuntime`, `inputContains`

- [ ] **Step 1: Write overlay.ts**

```typescript
// packages/yaml-core/src/simulation/overlay.ts
import type { SimulationConfig } from './config.js';
import type { SimulationCorpus } from './corpus.js';
import type { SimulationStrategy } from './strategies/simulation-strategy.js';
import { InvocationJournal } from './journal.js';

export class SimulationOverlay {
  readonly journal = new InvocationJournal();
  readonly strategyCache = new Map<string, SimulationStrategy<unknown, unknown>>();

  constructor(
    readonly config: SimulationConfig,
    readonly corpus: SimulationCorpus<unknown, unknown>,
  ) {}
}
```

- [ ] **Step 2: Write failing tests for SimulationRuntime**

Test cases covering:
- constructor takes config + corpus
- `pushOverlay(config, corpus?)` adds overlay, clears strategy cache
- `popOverlay(overlay)` removes overlay
- `strategyFor(qn)` returns cached strategy, walks overlay stack
- `createStrategy` builds correct strategy type from name (sequential, key-lookup, random, recorded-replay, nearest-match)
- `createStrategy` resolves aliases (seq, key, rand, replay, nearest)
- `createStrategy` with `corpusSelection` builds selector + wraps in PhasedCorpus
- `registerExtractor` / `registerScorer` make extractors/scorers available to strategies
- `advanceStateMachine(qn, trigger)` advances specific SM selector
- `advanceStateMachines(trigger)` advances all SM selectors
- `stateMachineStates()` returns all SM states
- `allSelectorInfo()` returns all selector info
- `resetSelector(qn)` resets specific selector
- `globalSpeed()` / `setGlobalSpeed(n)` get/set speed
- `pushProfile(name)` resolves via profileSource, pushes overlay
- `recordJournal` records to top overlay's journal
- `fallthroughRealism` walks overlay stack
- backward compat: no-arg construction still works (empty config + empty corpus)

- [ ] **Step 3: Run tests — verify fail**

- [ ] **Step 4: Implement SimulationRuntime**

The runtime class with:
- Constructor taking `SimulationConfig` and `SimulationCorpus` (both optional for backward compat — defaults to empty `MapSimulationConfig` and `InMemorySimulationCorpus`)
- Overlay stack management (preserved from existing code)
- `createStrategy()` — factory method dispatching on strategy name, building selectors when `corpusSelection` is configured, wrapping with `PhasedCorpus`, wrapping strategy with `onResolved()` callback
- Selector management methods
- Profile support
- Speed management
- Backward-compatible `resolve(qualifiedName, input)` method that delegates to `strategyFor()` then calls `strategy.resolve()`
- Preserve existing `inputContains()` utility function

- [ ] **Step 5: Run tests — verify pass**

- [ ] **Step 6: Write barrel exports (index.ts)**

Export everything from all simulation submodules. This is the public API surface.

- [ ] **Step 7: Update step/simulation-runtime.ts to re-export shim**

Replace the file contents with re-exports from `../simulation/index.js`. Preserve all existing export names so consumers don't break.

Also export backward-compatible types: `CorpusDatum` as an alias, `CorpusEntry` as an alias, the old `SimulationConfig` shape mapped to `MapSimulationConfig`.

- [ ] **Step 8: Update step/index.ts simulation exports**

Change the simulation export block to re-export from the new location. Keep the same public names.

- [ ] **Step 9: Run full yaml-core test suite**

Run: `npx vitest run` from `packages/yaml-core/`
Expected: All existing tests still pass (no breaking changes via re-export shim)

- [ ] **Step 10: Commit**

```bash
git add packages/yaml-core/src/simulation/ packages/yaml-core/src/step/simulation-runtime.ts packages/yaml-core/src/step/index.ts
git commit -m "feat(#647): SimulationRuntime expansion — strategy factory, selectors, profiles, speed

Backward-compatible re-export shim preserves all existing imports.

Refs #647"
```

### Task 7: Consumer migration — update imports

**Files:**
- Modify: `packages/yaml-core/src/test/simulate-block-parser.ts` — import from `../simulation/`
- Modify: `packages/yaml-core/src/step/decorator-chain.ts` — import from `../simulation/`
- Modify: `packages/yaml-core/src/test/yaml-test-executor.ts` — import from `../simulation/`
- Modify: `packages/yaml-core/src/test/plugins/verify-simulation-plugin.ts` — import from `../../simulation/`
- Modify: `packages/pages-aria/src/playbook/invoke/simulation-aware-handler.ts` — import from `@casehubio/yaml-core/simulation`
- Modify: `packages/pages-aria/src/playbook/invoke/verify-simulation-handler.ts` — import from `@casehubio/yaml-core/simulation`

**Interfaces:**
- Consumes: New simulation barrel exports
- Produces: No new interfaces — same consumer contracts, updated import paths

- [ ] **Step 1: Update SimulateBlockParser imports**

Change `import type { SimulationConfig, CorpusDatum, CorpusEntry } from '../step/simulation-runtime.js'` to import from `'../simulation/index.js'`.

- [ ] **Step 2: Update decorator-chain.ts SimulationDecorator imports**

Change simulation-related imports to use `'../simulation/index.js'`.

- [ ] **Step 3: Update YamlTestExecutor imports**

Change `import { SimulationRuntime } from '../step/simulation-runtime.js'` to `'../simulation/index.js'`.

- [ ] **Step 4: Update verify-simulation-plugin imports**

Change `import type { SimulationRuntime } from '../../step/simulation-runtime.js'` to `'../../simulation/index.js'`.

- [ ] **Step 5: Update pages-aria handler imports**

Change `import type { SimulationRuntime } from '@casehubio/yaml-core/step'` to `'@casehubio/yaml-core/simulation'` (requires adding simulation export path to yaml-core package.json exports map if not already present).

- [ ] **Step 6: Run full test suite across affected packages**

Run: `npx vitest run` from `packages/yaml-core/`
Run: `npx vitest run` from `packages/pages-aria/`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/yaml-core/ packages/pages-aria/
git commit -m "refactor(#647): migrate simulation imports to new simulation/ directory

All consumers now import from yaml-core/src/simulation/ directly.
Re-export shim in step/simulation-runtime.ts preserved for external consumers.

Refs #647"
```

---

## Batch 5: Streaming & Sessions

### Task 8: StreamingCorpusDatum + chunkToStream + SimulatedAgentSession + SimulatedSessionPipeline

**Files:**
- Create: `packages/yaml-core/src/simulation/streaming.ts`
- Create: `packages/yaml-core/src/simulation/streaming.test.ts`
- Create: `packages/yaml-core/src/simulation/session/simulated-session.ts`
- Create: `packages/yaml-core/src/simulation/session/simulated-session-pipeline.ts`
- Create: `packages/yaml-core/src/simulation/session/simulated-session-pipeline.test.ts`
- Modify: `packages/yaml-core/src/simulation/index.ts` — add streaming + session exports

**Interfaces:**
- Consumes: `AgentEvent`, `AgentSession`, `SessionPipeline`, `AgentSessionInit`, `ClearingPolicy` from `step/invoke/session-pipeline.ts`; `SimulationCorpus`, `CorpusSelector`, `SimulationConfig` from simulation modules
- Produces:
  - `StreamingCorpusDatum` — `{ text: string; chunkStrategy: 'word' | 'char'; delayMs: number; inputTokens?: number; outputTokens?: number }`
  - `chunkToStream(datum: StreamingCorpusDatum): AsyncIterable<AgentEvent>` — async generator yielding text-delta events with delays
  - `SimulatedAgentSession` — class implementing `AgentSession`, backed by corpus + selector
  - `SimulatedSessionPipeline` — class implementing `SessionPipeline`, manages `Map<string, SimulatedAgentSession>`

- [ ] **Step 1: Write failing tests for chunkToStream**

Test cases:
- word chunking splits on whitespace, yields text-delta per word
- char chunking yields text-delta per character
- final event is invocation-complete with token counts
- delay of 0 produces events without waiting

```typescript
// packages/yaml-core/src/simulation/streaming.test.ts
import { describe, it, expect } from 'vitest';
import { chunkToStream } from './streaming.js';
import type { AgentEvent } from '../step/invoke/session-pipeline.js';

async function collectEvents(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

describe('chunkToStream', () => {
  it('chunks by word and emits text-delta + invocation-complete', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'hello world', chunkStrategy: 'word', delayMs: 0,
    }));
    const deltas = events.filter(e => e.kind === 'text-delta');
    expect(deltas.map(d => d.text).join('')).toBe('hello world');
    expect(events[events.length - 1]!.kind).toBe('invocation-complete');
  });

  it('chunks by char', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'hi', chunkStrategy: 'char', delayMs: 0,
    }));
    const deltas = events.filter(e => e.kind === 'text-delta');
    expect(deltas).toHaveLength(2);
    expect(deltas[0]!.text).toBe('h');
    expect(deltas[1]!.text).toBe('i');
  });

  it('includes token counts in invocation-complete', async () => {
    const events = await collectEvents(chunkToStream({
      text: 'test', chunkStrategy: 'word', delayMs: 0,
      inputTokens: 10, outputTokens: 5,
    }));
    const complete = events.find(e => e.kind === 'invocation-complete')!;
    expect(complete).toMatchObject({ inputTokens: 10, outputTokens: 5 });
  });
});
```

- [ ] **Step 2: Run test — verify fail**

- [ ] **Step 3: Implement streaming.ts**

```typescript
// packages/yaml-core/src/simulation/streaming.ts
import type { AgentEvent } from '../step/invoke/session-pipeline.js';

export interface StreamingCorpusDatum {
  readonly text: string;
  readonly chunkStrategy: 'word' | 'char';
  readonly delayMs: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function* chunkToStream(datum: StreamingCorpusDatum): AsyncGenerator<AgentEvent> {
  const chunks = datum.chunkStrategy === 'word'
    ? datum.text.split(/(\s+)/)
    : [...datum.text];
  const startTime = Date.now();
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    if (datum.delayMs > 0) await delay(datum.delayMs);
    yield { kind: 'text-delta', text: chunk };
  }
  yield {
    kind: 'invocation-complete',
    inputTokens: datum.inputTokens ?? 0,
    outputTokens: datum.outputTokens ?? 0,
    durationMs: Date.now() - startTime,
  };
}
```

- [ ] **Step 4: Run test — verify pass**

- [ ] **Step 5: Write failing tests for SimulatedSessionPipeline**

Test cases:
- `openSession` creates a session, `sessionFor` returns it
- `sessionFor` returns undefined for unknown name
- `releaseSession` removes the session
- `query()` returns streaming events from corpus entries
- `query()` advances through sequential corpus entries on each call
- `clear()` resets the session's position back to first entry

- [ ] **Step 6: Implement SimulatedAgentSession**

```typescript
// packages/yaml-core/src/simulation/session/simulated-session.ts
import type { AgentSession, AgentEvent } from '../../step/invoke/session-pipeline.js';
import type { SimulationCorpus } from '../corpus.js';
import type { CorpusSelector } from '../selectors/corpus-selector.js';
import type { StreamingCorpusDatum } from '../streaming.js';
import { chunkToStream } from '../streaming.js';

export class SimulatedAgentSession implements AgentSession {
  private counter = 0;

  constructor(
    private readonly corpus: SimulationCorpus<unknown, unknown>,
    private readonly qualifiedName: string,
    private readonly selector: CorpusSelector | undefined,
  ) {}

  async *query(_prompt: string): AsyncGenerator<AgentEvent> {
    const entries = this.corpus.list(this.qualifiedName);
    const idx = this.counter % Math.max(entries.length, 1);
    this.counter++;
    if (this.selector) this.selector.onResolved();

    const entry = entries[idx];
    if (!entry) {
      yield { kind: 'text-delta', text: '' };
      yield { kind: 'invocation-complete', inputTokens: 0, outputTokens: 0, durationMs: 0 };
      return;
    }

    const output = entry.output;
    if (typeof output === 'object' && output !== null && 'text' in output
        && 'chunkStrategy' in output) {
      yield* chunkToStream(output as StreamingCorpusDatum);
    } else {
      const text = typeof output === 'string' ? output : JSON.stringify(output);
      yield { kind: 'text-delta', text };
      yield { kind: 'invocation-complete', inputTokens: 0, outputTokens: 0, durationMs: 0 };
    }
  }

  async clear(): Promise<void> {
    this.counter = 0;
    if (this.selector) this.selector.reset();
  }
}
```

- [ ] **Step 7: Implement SimulatedSessionPipeline**

```typescript
// packages/yaml-core/src/simulation/session/simulated-session-pipeline.ts
import type { SessionPipeline, AgentSession, AgentSessionInit, ClearingPolicy }
  from '../../step/invoke/session-pipeline.js';
import type { SimulationCorpus } from '../corpus.js';
import type { SimulationConfig } from '../config.js';
import { SimulatedAgentSession } from './simulated-session.js';
import { LookupCountSelector } from '../selectors/lookup-count.js';
import { StateMachineSelector } from '../selectors/state-machine.js';
import { DurationSelector } from '../selectors/duration.js';
import { RandomSelector } from '../selectors/weighted.js';
import type { CorpusSelector } from '../selectors/corpus-selector.js';

export class SimulatedSessionPipeline implements SessionPipeline {
  private readonly sessions = new Map<string, SimulatedAgentSession>();

  constructor(
    private readonly corpus: SimulationCorpus<unknown, unknown>,
    private readonly config: SimulationConfig,
    private readonly speedSupplier: () => number = () => 1,
  ) {}

  async openSession(name: string, _init: AgentSessionInit, _clearingPolicy: ClearingPolicy): Promise<void> {
    const qn = `agent-session.${name}`;
    const selectorConfig = this.config.corpusSelection(qn);
    let selector: CorpusSelector | undefined;
    if (selectorConfig) {
      switch (selectorConfig.kind) {
        case 'state-machine':
          selector = new StateMachineSelector(selectorConfig.initial, selectorConfig.transitions);
          break;
        case 'lookup-count':
          selector = new LookupCountSelector(selectorConfig.orderedPhases);
          break;
        case 'duration':
          selector = new DurationSelector(selectorConfig.orderedPhases, this.speedSupplier);
          break;
        case 'weighted':
          selector = new RandomSelector(selectorConfig.weightedPhases);
          break;
      }
    }
    this.sessions.set(name, new SimulatedAgentSession(this.corpus, qn, selector));
  }

  sessionFor(name: string): AgentSession | undefined {
    return this.sessions.get(name);
  }

  async releaseSession(name: string): Promise<void> {
    this.sessions.delete(name);
  }
}
```

- [ ] **Step 8: Run tests — verify pass**

- [ ] **Step 9: Update simulation/index.ts barrel with streaming + session exports**

- [ ] **Step 10: Commit**

```bash
git add packages/yaml-core/src/simulation/
git commit -m "feat(#645): streaming corpus + SimulatedSessionPipeline

chunkToStream utility for word/char chunking with configurable delay.
SimulatedAgentSession implements AgentSession against simulation corpus.
SimulatedSessionPipeline manages sessions with selector-based turn tracking.

Refs #645"
```

---

## Batch 6: Parser Extensions & Per-Test Config

### Task 9: SimulateBlockParser extensions + per-test config + YamlTestExecutor overlay stacking

**Files:**
- Modify: `packages/yaml-core/src/test/simulate-block-parser.ts` — add `selection`, `exhaustion`, `streaming` parsing
- Modify: `packages/yaml-core/src/test/simulate-block-parser.test.ts` — add tests for new keys
- Modify: `packages/yaml-core/src/test/yaml-test-parser.ts` — add `simulate` to `TestCase`
- Modify: `packages/yaml-core/src/test/yaml-test-executor.ts` — add per-test overlay stacking

**Interfaces:**
- Consumes: `CorpusSelectorConfig`, `ExhaustionPolicy`, `StreamingCorpusDatum`, `MapSimulationConfig`, `SimulationRuntime`
- Produces:
  - `SimulateBlockParser.parse()` now returns config with `corpusSelection`, `exhaustionPolicy`, and streaming datum on corpus entries
  - `TestCase.simulate?: Record<string, unknown>` — per-test simulation override
  - `YamlTestExecutor` pushes per-test overlays when `testCase.simulate` is present

- [ ] **Step 1: Write failing tests for new SimulateBlockParser features**

Test cases:
- `exhaustion: clamp` on an action produces `ExhaustionPolicy` in config
- `selection` block with `kind: lookup-count` produces `CorpusSelectorConfig`
- `selection` block with `kind: state-machine` produces transitions + initial
- `streaming` on corpus entry produces `StreamingCorpusDatum`
- delay parsing: `50ms` → 50, `1s` → 1000

```typescript
// Add to existing simulate-block-parser.test.ts

it('parses exhaustion policy', () => {
  const config = SimulateBlockParser.parse({
    agent: { strategy: 'sequential', exhaustion: 'clamp', corpus: [] },
  });
  // verify exhaustionPolicy('agent-provider.invoke') === 'CLAMP'
});

it('parses lookup-count selection', () => {
  const config = SimulateBlockParser.parse({
    agent: {
      strategy: 'sequential',
      corpus: [],
      selection: {
        kind: 'lookup-count',
        phases: { greeting: 1, conversation: 3 },
      },
    },
  });
  // verify corpusSelection('agent-provider.invoke') returns lookup-count config
});

it('parses streaming config on corpus entries', () => {
  const config = SimulateBlockParser.parse({
    agent: {
      strategy: 'sequential',
      corpus: [
        { prompt: 'hi', response: 'hello', streaming: { delay: '50ms' } },
      ],
    },
  });
  // verify corpus entry output has streaming metadata
});
```

- [ ] **Step 2: Run tests — verify fail**

- [ ] **Step 3: Extend SimulateBlockParser.parse()**

Update the `parse()` method to:
1. Read `exhaustion` key → store in a per-qualified-name exhaustion policy map
2. Read `selection` key → build `CorpusSelectorConfig` from kind, phases, transitions, initial
3. Read `streaming` on corpus entries → attach `StreamingCorpusDatum` metadata to output
4. Parse delay strings: `'50ms'` → 50, `'1s'` → 1000
5. Return an enhanced config object (use `MapSimulationConfig` instead of the old plain object)

- [ ] **Step 4: Run tests — verify pass**

- [ ] **Step 5: Write failing tests for per-test simulation config**

```typescript
// Add to existing yaml-test-parser tests

it('parses per-test simulate block', () => {
  const result = YamlTestParser.parse({
    name: 'suite',
    simulate: { agent: { strategy: 'sequential', corpus: [] } },
    tests: [
      { name: 'test1', steps: [] },
      { name: 'test2', simulate: { agent: { strategy: 'key-lookup', corpus: [] } }, steps: [] },
    ],
  });
  expect(result.tests[0]!.simulate).toBeUndefined();
  expect(result.tests[1]!.simulate).toBeDefined();
});
```

- [ ] **Step 6: Update YamlTestParser to parse per-test simulate**

Add `simulate?: Record<string, unknown>` to `TestCase` interface. Update `parse()` to read `simulate` from each test entry in the `tests` array.

- [ ] **Step 7: Update YamlTestExecutor for per-test overlay stacking**

In `runTestCase()`, after pushing the file-level overlay (if present), check `testCase.simulate`. If present, parse via `SimulateBlockParser` and push a second overlay. Pop both in the `finally` block (already handled by `runtime.popAll()`).

- [ ] **Step 8: Run full yaml-core test suite**

Run: `npx vitest run` from `packages/yaml-core/`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add packages/yaml-core/src/test/ packages/yaml-core/src/simulation/
git commit -m "feat(#647): SimulateBlockParser extensions + per-test simulation config

Parse selection, exhaustion, streaming keys in simulate blocks.
Per-test simulate overrides via overlay stacking in YamlTestExecutor.

Refs #647, #645"
```

---

## References

- [2026-11-09-simulation-parity-design.md] — design spec this plan implements
- [packages/yaml-core/src/step/simulation-runtime.ts] — existing TS simulation runtime
- [packages/yaml-core/src/test/simulate-block-parser.ts] — existing parser
- [packages/yaml-core/src/test/yaml-test-parser.ts] — test file parser
- [packages/yaml-core/src/test/yaml-test-executor.ts] — test executor
- [packages/yaml-core/src/step/invoke/session-pipeline.ts] — SessionPipeline interface
- [packages/yaml-core/src/step/index.ts] — step barrel exports
- [platform/simulation-core/src/main/java/io/casehub/platform/simulation/] — Java reference
- [GitHub #645] — streaming simulation API
- [GitHub #647] — phase-aware agent simulation
- [GitHub #608] — parent epic
