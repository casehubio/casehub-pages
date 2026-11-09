import type { CorpusSelector } from './corpus-selector.js';
import type { CountPhase } from '../types.js';

export class LookupCountSelector implements CorpusSelector {
  private readonly orderedPhases: CountPhase[];
  private counter = 0;

  constructor(orderedPhases: CountPhase[]) {
    if (orderedPhases.length === 0) throw new Error('LookupCountSelector requires at least one phase');
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
