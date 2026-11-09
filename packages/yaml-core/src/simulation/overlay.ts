import type { SimulationConfig } from './config.js';
import type { SimulationCorpus } from './corpus.js';
import type { SimulationStrategy } from './strategies/simulation-strategy.js';
import { InvocationJournal } from './journal.js';

export class SimulationOverlay {
  readonly journal = new InvocationJournal();
  readonly strategyCache = new Map<string, SimulationStrategy<unknown, unknown>>();

  constructor(
    readonly config: SimulationConfig,
    readonly corpus: SimulationCorpus<unknown, unknown>,
  ) {}
}
