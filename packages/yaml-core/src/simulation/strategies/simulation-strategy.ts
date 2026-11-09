import type { DataRealism } from '../types.js';

export interface SimulationStrategy<I, O> {
  resolve(input: I): O | undefined;
  canResolve(input: I): boolean;
  dataRealism(): DataRealism;
}
