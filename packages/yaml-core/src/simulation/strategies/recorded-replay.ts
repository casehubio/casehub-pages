import type { SimulationStrategy } from './simulation-strategy.js';
import type { SimulationCorpus } from '../corpus.js';
import type { DataRealism } from '../types.js';
import type { KeyExtractor } from '../key-extractor.js';

export class RecordedReplayStrategy<I, O> implements SimulationStrategy<I, O> {
  constructor(
    private readonly corpus: SimulationCorpus<I, O>,
    private readonly qualifiedName: string,
    private readonly extractor: KeyExtractor<I>,
  ) {}

  resolve(input: I): O | undefined {
    const key = this.extractor(input);
    return this.corpus.lookupByKey(this.qualifiedName, key);
  }

  canResolve(input: I): boolean {
    const key = this.extractor(input);
    return this.corpus.lookupByKey(this.qualifiedName, key) !== undefined;
  }

  dataRealism(): DataRealism { return 'RECORDED_REAL'; }
}
