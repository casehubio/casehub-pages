import type { InvocationRecord } from './types.js';
import type { SimulationCorpus } from './corpus.js';
import type { CorpusSelector } from './selectors/corpus-selector.js';

export class PhasedCorpus<I, O> implements SimulationCorpus<I, O> {
  constructor(
    private readonly selector: CorpusSelector,
    private readonly phases: Map<string, InvocationRecord<I, O>[]>,
  ) {}

  private activeEntries(): InvocationRecord<I, O>[] {
    return this.phases.get(this.selector.activePhase()) ?? [];
  }

  lookupByKey(_qualifiedName: string, key: string): O | undefined {
    return this.activeEntries().find(e => e.key === key)?.output;
  }

  lookupAllByKey(_qualifiedName: string, key: string): O[] {
    return this.activeEntries().filter(e => e.key === key).map(e => e.output);
  }

  lookupByIndex(_qualifiedName: string, index: number): O | undefined {
    const entries = this.activeEntries();
    return index >= 0 && index < entries.length ? entries[index]!.output : undefined;
  }

  list(_qualifiedName: string): InvocationRecord<I, O>[] {
    return this.activeEntries();
  }

  listByTenant(_qualifiedName: string, tenancyId: string): InvocationRecord<I, O>[] {
    return this.activeEntries().filter(e => e.tenancyId === tenancyId);
  }

  record(): void { throw new Error('PhasedCorpus is read-only'); }
  seed(): void { throw new Error('PhasedCorpus is read-only'); }
  clear(): void { throw new Error('PhasedCorpus is read-only'); }

  size(_qualifiedName: string): number {
    return this.activeEntries().length;
  }
}
