import type { OrcLatch } from './types.js';

interface Waiter {
  resolve: (timedOut: boolean) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class DefaultOrcLatch implements OrcLatch {
  private _count: number;
  private _waiters: Waiter[] = [];

  constructor(count: number) {
    this._count = Math.max(0, count);
  }

  countDown(): void {
    if (this._count <= 0) return;
    this._count--;
    if (this._count === 0) {
      const waiters = this._waiters;
      this._waiters = [];
      for (const w of waiters) {
        if (w.timer) clearTimeout(w.timer);
        w.resolve(true);
      }
    }
  }

  await(): Promise<void>;
  await(timeoutMs: number): Promise<boolean>;
  await(timeoutMs?: number): Promise<void | boolean> {
    if (this._count === 0) {
      return timeoutMs !== undefined ? Promise.resolve(true) : Promise.resolve();
    }
    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = { resolve };
      if (timeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const idx = this._waiters.indexOf(waiter);
          if (idx >= 0) this._waiters.splice(idx, 1);
          resolve(false);
        }, timeoutMs);
      }
      this._waiters.push(waiter);
    }).then((result) => (timeoutMs !== undefined ? result : undefined)) as Promise<void | boolean>;
  }

  getCount(): number {
    return this._count;
  }
}
