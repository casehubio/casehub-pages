import type { OrcSignal } from './types.js';

interface Waiter {
  resolve: (timedOut: boolean) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class DefaultOrcSignal implements OrcSignal {
  private _signalled = false;
  private _payload: unknown = undefined;
  private readonly _repeatable: boolean;
  private _waiters: Waiter[] = [];

  constructor(repeatable = false) {
    this._repeatable = repeatable;
  }

  signal(payload?: unknown): void {
    this._payload = payload;
    this._signalled = true;
    const waiters = this._waiters;
    this._waiters = [];
    for (const w of waiters) {
      if (w.timer) clearTimeout(w.timer);
      w.resolve(true);
    }
    if (this._repeatable) {
      this._signalled = false;
    }
  }

  await(): Promise<void>;
  await(timeoutMs: number): Promise<boolean>;
  await(timeoutMs?: number): Promise<void | boolean> {
    if (this._signalled && !this._repeatable) {
      return timeoutMs !== undefined ? Promise.resolve(true) : Promise.resolve();
    }
    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = {
        resolve: (val) => resolve(val),
      };
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

  payload(): unknown {
    return this._payload;
  }

  isSignalled(): boolean {
    return this._signalled;
  }
}
