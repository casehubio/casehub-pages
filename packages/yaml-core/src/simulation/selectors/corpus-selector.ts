export interface CorpusSelector {
  activePhase(): string;
  type(): string;
  onResolved(): void;
  reset(): void;
}
