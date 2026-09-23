import type { OrcChannel } from './types.js';
import { ChannelClosedError } from './errors.js';

interface RecvWaiter<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface SendWaiter<T> {
  value: T;
  resolve: (sent: boolean) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class DefaultOrcChannel<T> implements OrcChannel<T> {
  private _buffer: T[] = [];
  private _recvWaiters: RecvWaiter<T>[] = [];
  private _sendWaiters: SendWaiter<T>[] = [];
  private _closed = false;
  private _closeError?: Error;
  private readonly _capacity: number | undefined;

  constructor(capacity?: number) {
    this._capacity = capacity;
  }

  send(value: T): Promise<void>;
  send(value: T, timeoutMs: number): Promise<boolean>;
  send(value: T, timeoutMs?: number): Promise<void | boolean> {
    if (this._closed) {
      const err = new ChannelClosedError('channel', this._closeError);
      return timeoutMs !== undefined ? Promise.resolve(false) : Promise.reject(err);
    }
    const receiver = this._recvWaiters.shift();
    if (receiver) {
      if (receiver.timer) clearTimeout(receiver.timer);
      receiver.resolve(value);
      return timeoutMs !== undefined ? Promise.resolve(true) : Promise.resolve();
    }
    if (this._capacity === undefined || this._buffer.length < this._capacity) {
      this._buffer.push(value);
      return timeoutMs !== undefined ? Promise.resolve(true) : Promise.resolve();
    }
    return new Promise<boolean>((resolve) => {
      const waiter: SendWaiter<T> = { value, resolve };
      if (timeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const idx = this._sendWaiters.indexOf(waiter);
          if (idx >= 0) this._sendWaiters.splice(idx, 1);
          resolve(false);
        }, timeoutMs);
      }
      this._sendWaiters.push(waiter);
    }).then((result) => (timeoutMs !== undefined ? result : undefined)) as Promise<void | boolean>;
  }

  receive(): Promise<T>;
  receive(timeoutMs: number): Promise<T | undefined>;
  receive(timeoutMs?: number): Promise<T | undefined> {
    if (this._buffer.length > 0) {
      const value = this._buffer.shift()!;
      const sender = this._sendWaiters.shift();
      if (sender) {
        if (sender.timer) clearTimeout(sender.timer);
        this._buffer.push(sender.value);
        sender.resolve(true);
      }
      return Promise.resolve(value);
    }
    if (this._closed) {
      const err = new ChannelClosedError('channel', this._closeError);
      return timeoutMs !== undefined ? Promise.resolve(undefined) : Promise.reject(err);
    }
    return new Promise<T>((resolve, reject) => {
      const waiter: RecvWaiter<T> = { resolve, reject };
      if (timeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const idx = this._recvWaiters.indexOf(waiter);
          if (idx >= 0) this._recvWaiters.splice(idx, 1);
          resolve(undefined as T);
        }, timeoutMs);
      }
      this._recvWaiters.push(waiter);
    });
  }

  isEmpty(): boolean {
    return this._buffer.length === 0;
  }

  close(): void;
  close(cause: Error): void;
  close(cause?: Error): void {
    this._closed = true;
    if (cause) this._closeError = cause;
    const err = new ChannelClosedError('channel', cause);
    for (const w of this._recvWaiters) {
      if (w.timer) clearTimeout(w.timer);
      w.reject(err);
    }
    this._recvWaiters = [];
    for (const w of this._sendWaiters) {
      if (w.timer) clearTimeout(w.timer);
      w.resolve(false);
    }
    this._sendWaiters = [];
  }

  isErrorClosed(): boolean {
    return this._closed && this._closeError !== undefined;
  }

  closeError(): Error | undefined {
    return this._closeError;
  }
}
