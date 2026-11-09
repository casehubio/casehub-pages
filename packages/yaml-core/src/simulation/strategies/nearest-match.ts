import type { SimulationStrategy } from './simulation-strategy.js';
import type { SimulationCorpus } from '../corpus.js';
import type { DataRealism } from '../types.js';
import type { SimilarityScorer } from '../similarity-scorer.js';

export class NearestMatchStrategy<I, O> implements SimulationStrategy<I, O> {
  constructor(
    private readonly corpus: SimulationCorpus<I, O>,
    private readonly qualifiedName: string,
    private readonly scorer: SimilarityScorer<I>,
    private readonly threshold: number = 0,
  ) {}

  resolve(input: I): O | undefined {
    const entries = this.corpus.list(this.qualifiedName);
    let bestScore = -1;
    let bestOutput: O | undefined;

    for (const entry of entries) {
      const score = this.scorer(input, entry.input);
      if (score > bestScore && score >= this.threshold) {
        bestScore = score;
        bestOutput = entry.output;
      }
    }

    return bestOutput;
  }

  canResolve(input: I): boolean {
    return this.resolve(input) !== undefined;
  }

  dataRealism(): DataRealism { return 'DOMAIN_PLAUSIBLE'; }
}
