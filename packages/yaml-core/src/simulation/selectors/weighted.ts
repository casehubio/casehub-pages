import type { CorpusSelector } from './corpus-selector.js';
import type { WeightedPhase } from '../types.js';

export class RandomSelector implements CorpusSelector {
  private readonly weightedPhases: WeightedPhase[];
  private readonly totalWeight: number;

  constructor(weightedPhases: WeightedPhase[]) {
    if (weightedPhases.length === 0) throw new Error('RandomSelector requires at least one phase');
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
