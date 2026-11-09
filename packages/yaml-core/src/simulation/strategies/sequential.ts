import type { SimulationStrategy } from './simulation-strategy.js';
import type { SimulationCorpus } from '../corpus.js';
import type { DataRealism, ExhaustionPolicy } from '../types.js';

export class SequentialStrategy<I, O> implements SimulationStrategy<I, O> {
  private counter = 0;

  constructor(
    private readonly corpus: SimulationCorpus<I, O>,
    private readonly qualifiedName: string,
    private readonly exhaustionPolicy: ExhaustionPolicy = 'WRAP',
  ) {}

  resolve(_input: I): O | undefined {
    const entries = this.corpus.list(this.qualifiedName);
    if (entries.length === 0) return undefined;

    if (this.counter >= entries.length) {
      switch (this.exhaustionPolicy) {
        case 'WRAP':
          this.counter = this.counter % entries.length;
          break;
        case 'CLAMP':
          return entries[entries.length - 1]!.output;
        case 'THROW':
          throw new Error(`Sequential corpus exhausted for '${this.qualifiedName}' (${entries.length} entries)`);
      }
    }

    const entry = entries[this.counter]!;
    this.counter++;
    return entry.output;
  }

  canResolve(_input: I): boolean {
    return this.corpus.size(this.qualifiedName) > 0;
  }

  dataRealism(): DataRealism { return 'DOMAIN_PLAUSIBLE'; }
}
