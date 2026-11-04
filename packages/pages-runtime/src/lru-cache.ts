export interface LruCacheOptions {
  readonly ttlMs?: number;
}

interface Entry<V> {
  value: V;
  insertedAt: number;
}

export class LruCache<K, V> {
  readonly #maxSize: number;
  readonly #ttlMs: number | undefined;
  readonly #entries: Map<K, Entry<V>> = new Map();

  constructor(maxSize: number, options?: LruCacheOptions) {
    if (maxSize < 1) throw new RangeError("LruCache maxSize must be >= 1");
    this.#maxSize = maxSize;
    this.#ttlMs = options?.ttlMs;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (this.#isExpired(entry)) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    if (this.#isExpired(entry)) {
      this.#entries.delete(key);
      return false;
    }
    return true;
  }

  set(key: K, value: V): void {
    this.#entries.delete(key);
    if (this.#entries.size >= this.#maxSize) {
      const lruKey = this.#entries.keys().next().value!;
      this.#entries.delete(lruKey);
    }
    this.#entries.set(key, { value, insertedAt: Date.now() });
  }

  delete(key: K): void {
    this.#entries.delete(key);
  }

  clear(): void {
    this.#entries.clear();
  }

  #isExpired(entry: Entry<V>): boolean {
    if (this.#ttlMs === undefined) return false;
    return Date.now() - entry.insertedAt > this.#ttlMs;
  }
}
