import type { CorpusSelector } from './corpus-selector.js';
import type { DurationPhase } from '../types.js';

export class DurationSelector implements CorpusSelector {
  private readonly orderedPhases: DurationPhase[];
  private readonly speedSupplier: () => number;
  private startTime: number;

  constructor(orderedPhases: DurationPhase[], speedSupplier: () => number) {
    if (orderedPhases.length === 0) throw new Error('DurationSelector requires at least one phase');
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
  onResolved(): void { /* time-driven */ }
  reset(): void { this.startTime = Date.now(); }
}
