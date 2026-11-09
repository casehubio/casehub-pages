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
