import type { InvocationRecord } from './types.js';

export interface SimulationCorpus<I, O> {
  lookupByKey(qualifiedName: string, key: string): O | undefined;
  lookupAllByKey(qualifiedName: string, key: string): O[];
  lookupByIndex(qualifiedName: string, index: number): O | undefined;
  list(qualifiedName: string): InvocationRecord<I, O>[];
  listByTenant(qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[];
  record(qualifiedName: string, tenancyId: string, input: I, output: O, key?: string): void;
  seed(qualifiedName: string, records: InvocationRecord<I, O>[]): void;
  clear(qualifiedName: string): void;
  size(qualifiedName: string): number;
}
