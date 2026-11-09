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
  onResolved(): void { /* advances only on explicit triggers */ }

  reset(): void { this.currentState = this.initial; }

  advance(trigger: string): void {
    const stateTransitions = this.transitions.get(this.currentState);
    if (!stateTransitions) return;
    const next = stateTransitions.get(trigger);
    if (next !== undefined) this.currentState = next;
  }
}
