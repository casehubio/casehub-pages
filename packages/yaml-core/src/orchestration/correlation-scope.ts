import type { MatchPattern } from '../match.js';
import { matches } from '../match.js';

export class CorrelationTimeoutError extends Error {
  constructor(id: string, timeoutMs: number) {
    super(`Correlation '${id}' timed out after ${timeoutMs}ms`);
    this.name = 'CorrelationTimeoutError';
  }
}

interface PendingCorrelation<T> {
  pattern: MatchPattern;
  resolve?: (item: T) => void;
  reject?: (error: Error) => void;
  buffer: T[];
  createdAt: number;
}

export interface CorrelationScopeOptions {
  evictionMs?: number;
}

export interface CorrelationScope<T> {
  expect(id: string, pattern: MatchPattern): void;
  await(id: string, timeoutMs?: number): Promise<T>;
  deliver(item: T): boolean;
  evict(): void;
  close(): void;
}

export class DefaultCorrelationScope<T> implements CorrelationScope<T> {
  private readonly pending = new Map<string, PendingCorrelation<T>>();
  private readonly scrutineeExtractor: (item: T) => unknown;
  private readonly evictionMs: number;

  constructor(
    scrutineeExtractor: (item: T) => unknown,
    options?: CorrelationScopeOptions,
  ) {
    this.scrutineeExtractor = scrutineeExtractor;
    this.evictionMs = options?.evictionMs ?? 0;
  }

  expect(id: string, pattern: MatchPattern): void {
    this.pending.set(id, { pattern, buffer: [], createdAt: Date.now() });
  }

  async await(id: string, timeoutMs?: number): Promise<T> {
    const entry = this.pending.get(id);
    if (!entry) {
      throw new Error(`No correlation registered for id '${id}'`);
    }

    if (entry.buffer.length > 0) {
      const item = entry.buffer.shift()!;
      this.pending.delete(id);
      return item;
    }

    return new Promise<T>((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;

      if (timeoutMs != null) {
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new CorrelationTimeoutError(id, timeoutMs));
          }
        }, timeoutMs);
      }
    });
  }

  deliver(item: T): boolean {
    const scrutinee = this.scrutineeExtractor(item);
    for (const [id, entry] of this.pending) {
      if (matches(entry.pattern, scrutinee)) {
        if (entry.resolve) {
          entry.resolve(item);
          this.pending.delete(id);
        } else {
          entry.buffer.push(item);
        }
        return true;
      }
    }
    return false;
  }

  evict(): void {
    if (this.evictionMs <= 0) return;
    const now = Date.now();
    for (const [id, entry] of this.pending) {
      if (now - entry.createdAt > this.evictionMs) {
        entry.buffer.length = 0;
        if (entry.resolve) {
          entry.reject?.(new CorrelationTimeoutError(id, this.evictionMs));
        }
        this.pending.delete(id);
      }
    }
  }

  close(): void {
    for (const [id, entry] of this.pending) {
      entry.reject?.(new Error(`CorrelationScope closed while awaiting '${id}'`));
    }
    this.pending.clear();
  }
}
