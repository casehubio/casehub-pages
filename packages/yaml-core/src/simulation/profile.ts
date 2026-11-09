import type { SimulationConfig } from './config.js';
import type { SimulationCorpus } from './corpus.js';

export interface SimulationProfile {
  readonly config: SimulationConfig;
  readonly corpus: SimulationCorpus<unknown, unknown>;
}

export interface ProfileSource {
  resolve(name: string): SimulationProfile | undefined;
}
