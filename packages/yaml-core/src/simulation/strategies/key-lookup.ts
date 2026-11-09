import type { SimulationStrategy } from './simulation-strategy.js';
import type { SimulationCorpus } from '../corpus.js';
import type { DataRealism, ExhaustionPolicy, MatchPolicy } from '../types.js';
import type { KeyExtractor } from '../key-extractor.js';

export class KeyLookupStrategy<I, O> implements SimulationStrategy<I, O> {
  constructor(
    private readonly corpus: SimulationCorpus<I, O>,
    private readonly qualifiedName: string,
    private readonly extractor: KeyExtractor<I>,
    private readonly matchPolicy: MatchPolicy = 'FIRST',
    private readonly exhaustionPolicy: ExhaustionPolicy = 'CLAMP',
  ) {}

  resolve(input: I): O | undefined {
    const key = this.extractor(input);

    if (this.matchPolicy === 'ALL') {
      const all = this.corpus.lookupAllByKey(this.qualifiedName, key);
      return all.length > 0 ? all[0] : this.handleNoMatch();
    }

    const result = this.corpus.lookupByKey(this.qualifiedName, key);
    if (result !== undefined) return result;
    return this.handleNoMatch();
  }

  private handleNoMatch(): O | undefined {
    if (this.exhaustionPolicy === 'THROW') {
      throw new Error(`No corpus match for '${this.qualifiedName}'`);
    }
    return undefined;
  }

  canResolve(input: I): boolean {
    const key = this.extractor(input);
    return this.corpus.lookupByKey(this.qualifiedName, key) !== undefined;
  }

  dataRealism(): DataRealism { return 'DOMAIN_PLAUSIBLE'; }
}
