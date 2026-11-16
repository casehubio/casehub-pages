import type { SimulationConfig } from './config.js';
import { MapSimulationConfig } from './config.js';
import type { SimulationCorpus } from './corpus.js';
import { InMemorySimulationCorpus } from './in-memory-corpus.js';
import { SimulationOverlay } from './overlay.js';
import type { InvocationJournal } from './journal.js';
import type { DataRealism, CorpusSelectorConfig, SelectorPhaseInfo, ExhaustionPolicy, MatchPolicy } from './types.js';
import type { SimulationStrategy } from './strategies/simulation-strategy.js';
import type { CorpusSelector } from './selectors/corpus-selector.js';
import { StateMachineSelector } from './selectors/state-machine.js';
import { DurationSelector } from './selectors/duration.js';
import { LookupCountSelector } from './selectors/lookup-count.js';
import { RandomSelector } from './selectors/weighted.js';
import { PhasedCorpus } from './phased-corpus.js';
import { SequentialStrategy } from './strategies/sequential.js';
import { KeyLookupStrategy } from './strategies/key-lookup.js';
import { RandomStrategy } from './strategies/random.js';
import { RecordedReplayStrategy } from './strategies/recorded-replay.js';
import { NearestMatchStrategy } from './strategies/nearest-match.js';
import type { KeyExtractor } from './key-extractor.js';
import type { SimilarityScorer } from './similarity-scorer.js';
import type { ProfileSource } from './profile.js';

const IDENTITY_EXTRACTOR: KeyExtractor<unknown> = (input) => String(input);

interface LegacyConfig {
  strategies: Record<string, string>;
  corpus: Array<{ file: string } | { inline: Record<string, Array<{ input: unknown; output: unknown; realism?: DataRealism }>> }>;
  capture: string[];
  fallthroughRealism?: Record<string, DataRealism>;
}

function isLegacyConfig(config: unknown): config is LegacyConfig {
  return typeof config === 'object' && config !== null
    && 'strategies' in config && typeof (config as Record<string, unknown>)['strategies'] === 'object'
    && !('strategyFor' in config);
}

function convertLegacy(legacy: LegacyConfig): { config: SimulationConfig; corpus: SimulationCorpus<unknown, unknown> } {
  const corpus = new InMemorySimulationCorpus<unknown, unknown>();
  for (const entry of legacy.corpus) {
    if ('inline' in entry) {
      for (const [qn, data] of Object.entries(entry.inline)) {
        for (const datum of data) corpus.record(qn, '', datum.input, datum.output);
      }
    }
  }
  return {
    config: new MapSimulationConfig({
      strategies: legacy.strategies,
      capture: legacy.capture,
      fallthroughRealism: legacy.fallthroughRealism ?? {},
    }),
    corpus,
  };
}

function resolveAlias(name: string): string {
  switch (name) {
    case 'seq': return 'sequential';
    case 'key': return 'key-lookup';
    case 'rand': return 'random';
    case 'replay': return 'recorded-replay';
    case 'nearest': return 'nearest-match';
    default: return name;
  }
}

export class SimulationRuntime {
  private readonly config: SimulationConfig;
  private readonly corpus: SimulationCorpus<unknown, unknown>;
  private readonly overlayStack: SimulationOverlay[] = [];
  private readonly extractors = new Map<string, KeyExtractor<unknown>>();
  private readonly scorers = new Map<string, SimilarityScorer<unknown>>();
  private readonly strategyCache = new Map<string, SimulationStrategy<unknown, unknown>>();
  private readonly corpusSelectors = new Map<string, CorpusSelector>();
  private _profileSource: ProfileSource | undefined;
  private _globalSpeed: number;

  constructor(config?: SimulationConfig, corpus?: SimulationCorpus<unknown, unknown>) {
    this.config = config ?? new MapSimulationConfig();
    this.corpus = corpus ?? new InMemorySimulationCorpus();
    this._globalSpeed = this.config.speed();
  }

  registerExtractor(qualifiedName: string, extractor: KeyExtractor<unknown>): void {
    this.extractors.set(qualifiedName, extractor);
  }

  registerScorer(qualifiedName: string, scorer: SimilarityScorer<unknown>): void {
    this.scorers.set(qualifiedName, scorer);
  }

  setProfileSource(profileSource: ProfileSource): void {
    this._profileSource = profileSource;
  }

  pushOverlay(config: SimulationConfig | LegacyConfig, corpus?: SimulationCorpus<unknown, unknown>): SimulationOverlay {
    let effectiveConfig: SimulationConfig;
    let effectiveCorpus: SimulationCorpus<unknown, unknown>;

    if (isLegacyConfig(config)) {
      const converted = convertLegacy(config);
      effectiveConfig = converted.config;
      effectiveCorpus = converted.corpus;
    } else {
      effectiveConfig = config;
      effectiveCorpus = corpus ?? new InMemorySimulationCorpus();
    }

    const overlay = new SimulationOverlay(effectiveConfig, effectiveCorpus);
    this.overlayStack.push(overlay);
    this.strategyCache.clear();
    for (const qn of effectiveConfig.corpusSelectionKeys()) {
      const sel = effectiveConfig.corpusSelection(qn);
      if (sel) this.buildSelector(qn, sel);
    }
    return overlay;
  }

  popOverlay(overlay: SimulationOverlay): void {
    const idx = this.overlayStack.indexOf(overlay);
    if (idx >= 0) this.overlayStack.splice(idx, 1);
    this.strategyCache.clear();
  }

  popAll(): void {
    this.overlayStack.length = 0;
    this.strategyCache.clear();
  }

  hasActiveOverlay(): boolean {
    return this.overlayStack.length > 0;
  }

  strategyFor<I, O>(qualifiedName: string): SimulationStrategy<I, O> | undefined {
    for (let i = this.overlayStack.length - 1; i >= 0; i--) {
      const overlay = this.overlayStack[i]!;
      const strategyName = overlay.config.strategyFor(qualifiedName);
      if (strategyName !== undefined) {
        const cached = overlay.strategyCache.get(qualifiedName);
        if (cached) return cached as SimulationStrategy<I, O>;
        const strategy = this.createStrategy(qualifiedName, strategyName, overlay.corpus, overlay.config);
        overlay.strategyCache.set(qualifiedName, strategy);
        return strategy as SimulationStrategy<I, O>;
      }
    }

    const strategyName = this.config.strategyFor(qualifiedName);
    if (strategyName === undefined) return undefined;
    const cached = this.strategyCache.get(qualifiedName);
    if (cached) return cached as SimulationStrategy<I, O>;
    const strategy = this.createStrategy(qualifiedName, strategyName, this.corpus, this.config);
    this.strategyCache.set(qualifiedName, strategy);
    return strategy as SimulationStrategy<I, O>;
  }

  resolve(qualifiedName: string, input: unknown): { output: unknown; realism: DataRealism } | undefined {
    const strategy = this.strategyFor<unknown, unknown>(qualifiedName);
    if (!strategy) return undefined;
    const output = strategy.resolve(input);
    if (output === undefined) return undefined;
    return { output, realism: strategy.dataRealism() };
  }

  recordJournal(qualifiedName: string, tenancyId: string, input: unknown,
                output: unknown, dataRealism: DataRealism): void {
    if (this.overlayStack.length === 0) return;
    const topOverlay = this.overlayStack[this.overlayStack.length - 1]!;
    topOverlay.journal.record(qualifiedName, tenancyId, input, output, dataRealism);
  }

  activeJournal(): InvocationJournal | undefined {
    return this.overlayStack.length > 0
      ? this.overlayStack[this.overlayStack.length - 1]!.journal
      : undefined;
  }

  fallthroughRealism(qualifiedName: string): DataRealism {
    for (let i = this.overlayStack.length - 1; i >= 0; i--) {
      const fr = this.overlayStack[i]!.config.fallthroughRealism(qualifiedName);
      if (fr !== undefined) return fr;
    }
    const base = this.config.fallthroughRealism(qualifiedName);
    return base ?? 'RECORDED_REAL';
  }

  captureEnabled(qualifiedName: string): boolean {
    return this.config.captureEnabled(qualifiedName);
  }

  capture(qualifiedName: string, tenancyId: string, input: unknown, output: unknown, key?: string): void {
    this.corpus.record(qualifiedName, tenancyId, input, output, key);
  }

  allEntriesFor(qualifiedName: string): readonly import('./types.js').JournalEntry[] {
    const result: import('./types.js').JournalEntry[] = [];
    for (const overlay of this.overlayStack) {
      result.push(...overlay.journal.entriesFor(qualifiedName));
    }
    return result;
  }

  allEntries(): readonly import('./types.js').JournalEntry[] {
    const result: import('./types.js').JournalEntry[] = [];
    for (const overlay of this.overlayStack) {
      result.push(...overlay.journal.entries());
    }
    return result;
  }

  globalSpeed(): number { return this._globalSpeed; }

  setGlobalSpeed(speed: number): void {
    if (speed <= 0) throw new Error('speed must be positive');
    this._globalSpeed = speed;
  }

  pushProfile(name: string): SimulationOverlay {
    if (!this._profileSource) {
      throw new Error(`No ProfileSource registered — cannot resolve profile '${name}'`);
    }
    const profile = this._profileSource.resolve(name);
    if (!profile) {
      throw new Error(`Unknown simulation profile: '${name}'`);
    }
    return this.pushOverlay(profile.config, profile.corpus);
  }

  initializeSelectors(): void {
    for (const qn of this.config.corpusSelectionKeys()) {
      const sel = this.config.corpusSelection(qn);
      if (sel) this.buildSelector(qn, sel);
    }
  }

  stateMachineSelector(qualifiedName: string): StateMachineSelector | undefined {
    const selector = this.corpusSelectors.get(qualifiedName);
    return selector instanceof StateMachineSelector ? selector : undefined;
  }

  advanceStateMachine(qualifiedName: string, trigger: string): void {
    const selector = this.corpusSelectors.get(qualifiedName);
    if (!selector) throw new Error(`No selector registered for: ${qualifiedName}`);
    if (!(selector instanceof StateMachineSelector)) {
      throw new Error(`Selector '${qualifiedName}' is type '${selector.type()}', not a state machine`);
    }
    selector.advance(trigger);
  }

  advanceStateMachines(trigger: string): void {
    for (const [, selector] of this.corpusSelectors) {
      if (selector instanceof StateMachineSelector) {
        selector.advance(trigger);
      }
    }
  }

  stateMachineStates(): Map<string, string> {
    const states = new Map<string, string>();
    for (const [name, selector] of this.corpusSelectors) {
      if (selector instanceof StateMachineSelector) {
        states.set(name, selector.activePhase());
      }
    }
    return states;
  }

  allSelectorInfo(): Map<string, SelectorPhaseInfo> {
    const result = new Map<string, SelectorPhaseInfo>();
    for (const [name, selector] of this.corpusSelectors) {
      result.set(name, { type: selector.type(), activePhase: selector.activePhase() });
    }
    return result;
  }

  resetSelector(qualifiedName: string): void {
    const selector = this.corpusSelectors.get(qualifiedName);
    if (!selector) throw new Error(`No selector registered for: ${qualifiedName}`);
    selector.reset();
  }

  private buildSelector(qualifiedName: string, selectorConfig: CorpusSelectorConfig): CorpusSelector {
    const existing = this.corpusSelectors.get(qualifiedName);
    if (existing) return existing;

    let selector: CorpusSelector;
    switch (selectorConfig.kind) {
      case 'state-machine':
        selector = new StateMachineSelector(selectorConfig.initial, selectorConfig.transitions);
        break;
      case 'duration':
        selector = new DurationSelector(selectorConfig.orderedPhases, () => this._globalSpeed);
        break;
      case 'lookup-count':
        selector = new LookupCountSelector(selectorConfig.orderedPhases);
        break;
      case 'weighted':
        selector = new RandomSelector(selectorConfig.weightedPhases);
        break;
    }

    this.corpusSelectors.set(qualifiedName, selector);
    return selector;
  }

  private createStrategy(qualifiedName: string, strategyName: string,
                          corpus: SimulationCorpus<unknown, unknown>,
                          effectiveConfig: SimulationConfig): SimulationStrategy<unknown, unknown> {
    let effectiveCorpus: SimulationCorpus<unknown, unknown> = corpus;
    let selector: CorpusSelector | undefined;

    const selection = effectiveConfig.corpusSelection(qualifiedName);
    if (selection) {
      const selectorKey = effectiveConfig.corpusSelectionGroup(qualifiedName) ?? qualifiedName;
      selector = this.buildSelector(selectorKey, selection);
      effectiveCorpus = new PhasedCorpus(selector, selection.phases);
    }

    const ep: ExhaustionPolicy = effectiveConfig.exhaustionPolicy(qualifiedName) ?? 'WRAP';
    const mp: MatchPolicy = effectiveConfig.matchPolicy(qualifiedName) ?? 'FIRST';

    let strategy: SimulationStrategy<unknown, unknown>;
    switch (resolveAlias(strategyName)) {
      case 'sequential':
        strategy = new SequentialStrategy(effectiveCorpus, qualifiedName, ep);
        break;
      case 'key-lookup': {
        const extractor = this.extractors.get(qualifiedName) ?? IDENTITY_EXTRACTOR;
        strategy = new KeyLookupStrategy(effectiveCorpus, qualifiedName, extractor, mp, ep);
        break;
      }
      case 'random':
        strategy = new RandomStrategy(effectiveCorpus, qualifiedName);
        break;
      case 'recorded-replay': {
        const extractor = this.extractors.get(qualifiedName) ?? IDENTITY_EXTRACTOR;
        strategy = new RecordedReplayStrategy(effectiveCorpus, qualifiedName, extractor);
        break;
      }
      case 'nearest-match': {
        const scorer = this.scorers.get(qualifiedName);
        if (!scorer) throw new Error(`Strategy for ${qualifiedName} requires a SimilarityScorer, but none registered`);
        const threshold = effectiveConfig.threshold(qualifiedName) ?? 0;
        strategy = new NearestMatchStrategy(effectiveCorpus, qualifiedName, scorer, threshold);
        break;
      }
      case 'passthrough':
        return { resolve: () => undefined, canResolve: () => false, dataRealism: () => 'RECORDED_REAL' };
      default:
        throw new Error(`Unknown strategy '${strategyName}' for ${qualifiedName}`);
    }

    if (selector) {
      const wrapped = strategy;
      const sel = selector;
      strategy = {
        resolve(input: unknown) {
          const result = wrapped.resolve(input);
          sel.onResolved();
          return result;
        },
        canResolve(input: unknown) { return wrapped.canResolve(input); },
        dataRealism() { return wrapped.dataRealism(); },
      };
    }

    return strategy;
  }
}

export function inputContains(actual: unknown, pattern: unknown): boolean {
  if (pattern === null || pattern === undefined) return true;
  if (typeof pattern !== 'object' || typeof actual !== 'object') return actual === pattern;
  if (actual === null) return false;
  const patObj = pattern as Record<string, unknown>;
  const actObj = actual as Record<string, unknown>;
  for (const key of Object.keys(patObj)) {
    if (!inputContains(actObj[key], patObj[key])) return false;
  }
  return true;
}
