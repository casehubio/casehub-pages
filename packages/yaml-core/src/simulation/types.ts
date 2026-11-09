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
