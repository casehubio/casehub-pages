import type { JournalEntry, DataRealism } from './types.js';

export class InvocationJournal {
  private readonly _entries: JournalEntry[] = [];

  record(qualifiedName: string, tenancyId: string, input: unknown,
         output: unknown, dataRealism: DataRealism): void {
    this._entries.push({
      qualifiedName, tenancyId, input, output,
      timestamp: Date.now(), dataRealism,
    });
  }

  entries(): readonly JournalEntry[] { return this._entries; }

  entriesFor(qualifiedName: string): readonly JournalEntry[] {
    return this._entries.filter(e => e.qualifiedName === qualifiedName);
  }

  countFor(qualifiedName: string): number {
    return this._entries.filter(e => e.qualifiedName === qualifiedName).length;
  }
}
