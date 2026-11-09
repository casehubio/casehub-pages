import type { InvocationRecord } from './types.js';
import type { SimulationCorpus } from './corpus.js';

export class InMemorySimulationCorpus<I, O> implements SimulationCorpus<I, O> {
  private readonly data = new Map<string, InvocationRecord<I, O>[]>();

  lookupByKey(qualifiedName: string, key: string): O | undefined {
    const entries = this.data.get(qualifiedName);
    if (!entries) return undefined;
    const match = entries.find(e => e.key === key);
    return match?.output;
  }

  lookupAllByKey(qualifiedName: string, key: string): O[] {
    const entries = this.data.get(qualifiedName);
    if (!entries) return [];
    return entries.filter(e => e.key === key).map(e => e.output);
  }

  lookupByIndex(qualifiedName: string, index: number): O | undefined {
    const entries = this.data.get(qualifiedName);
    if (!entries || index < 0 || index >= entries.length) return undefined;
    return entries[index]!.output;
  }

  list(qualifiedName: string): InvocationRecord<I, O>[] {
    return this.data.get(qualifiedName) ?? [];
  }

  listByTenant(qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[] {
    return this.list(qualifiedName).filter(e => e.tenancyId === tenancyId);
  }

  record(qualifiedName: string, tenancyId: string, input: I, output: O, key?: string): void {
    if (!this.data.has(qualifiedName)) this.data.set(qualifiedName, []);
    this.data.get(qualifiedName)!.push({
      tenancyId, key: key ?? '', input, output, recordedAt: Date.now(),
    });
  }

  seed(qualifiedName: string, records: InvocationRecord<I, O>[]): void {
    this.data.set(qualifiedName, [...records]);
  }

  clear(qualifiedName: string): void {
    this.data.delete(qualifiedName);
  }

  size(qualifiedName: string): number {
    return this.data.get(qualifiedName)?.length ?? 0;
  }
}
