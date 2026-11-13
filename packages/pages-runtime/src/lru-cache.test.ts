import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LruCache } from "./lru-cache.js";

describe("LruCache", () => {
  describe("basic operations", () => {
    it("returns undefined for missing keys", () => {
      const cache = new LruCache<string, number>(3);
      expect(cache.get("x")).toBeUndefined();
    });

    it("stores and retrieves a value", () => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
    });

    it("tracks size", () => {
      const cache = new LruCache<string, number>(3);
      expect(cache.size).toBe(0);
      cache.set("a", 1);
      expect(cache.size).toBe(1);
      cache.set("b", 2);
      expect(cache.size).toBe(2);
    });

    it("overwrites existing key without changing size", () => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("a", 99);
      expect(cache.get("a")).toBe(99);
      expect(cache.size).toBe(1);
    });
  });

  describe("LRU eviction", () => {
    it("evicts least recently used entry when max size exceeded", () => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.set("d", 4); // should evict "a"
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
      expect(cache.size).toBe(3);
    });

    it("access via get refreshes entry position", () => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.get("a"); // refresh "a" — now "b" is LRU
      cache.set("d", 4); // should evict "b", not "a"
      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("d")).toBe(4);
    });

    it("overwrite via set refreshes entry position", () => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.set("a", 10); // refresh "a" — now "b" is LRU
      cache.set("d", 4); // should evict "b"
      expect(cache.get("a")).toBe(10);
      expect(cache.get("b")).toBeUndefined();
    });

    it("evicts multiple entries if needed through sequential sets", () => {
      const cache = new LruCache<string, number>(2);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3); // evicts "a"
      cache.set("d", 4); // evicts "b"
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });
  });

  describe("time-based expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("returns value before ttl expires", () => {
      const cache = new LruCache<string, number>(10, { ttlMs: 1000 });
      cache.set("a", 1);
      vi.advanceTimersByTime(999);
      expect(cache.get("a")).toBe(1);
    });

    it("returns undefined after ttl expires", () => {
      const cache = new LruCache<string, number>(10, { ttlMs: 1000 });
      cache.set("a", 1);
      vi.advanceTimersByTime(1001);
      expect(cache.get("a")).toBeUndefined();
    });

    it("expired entry is removed from size count", () => {
      const cache = new LruCache<string, number>(10, { ttlMs: 1000 });
      cache.set("a", 1);
      expect(cache.size).toBe(1);
      vi.advanceTimersByTime(1001);
      cache.get("a"); // triggers lazy eviction
      expect(cache.size).toBe(0);
    });

    it("overwriting resets the ttl", () => {
      const cache = new LruCache<string, number>(10, { ttlMs: 1000 });
      cache.set("a", 1);
      vi.advanceTimersByTime(800);
      cache.set("a", 2); // reset ttl
      vi.advanceTimersByTime(800); // 800ms since reset, still alive
      expect(cache.get("a")).toBe(2);
      vi.advanceTimersByTime(201); // now expired
      expect(cache.get("a")).toBeUndefined();
    });

    it("works without ttl — entries never expire", () => {
      const cache = new LruCache<string, number>(10);
      cache.set("a", 1);
      vi.advanceTimersByTime(999_999);
      expect(cache.get("a")).toBe(1);
    });

    afterEach(() => vi.useRealTimers());
  });

  describe("manual invalidation", () => {
    it("delete removes a single entry", () => {
      const cache = new LruCache<string, number>(10);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.delete("a");
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe(2);
      expect(cache.size).toBe(1);
    });

    it("delete on missing key is a no-op", () => {
      const cache = new LruCache<string, number>(10);
      cache.delete("nope");
      expect(cache.size).toBe(0);
    });

    it("clear removes all entries", () => {
      const cache = new LruCache<string, number>(10);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for existing entries", () => {
      const cache = new LruCache<string, number>(10);
      cache.set("a", 1);
      expect(cache.has("a")).toBe(true);
    });

    it("returns false for missing entries", () => {
      const cache = new LruCache<string, number>(10);
      expect(cache.has("x")).toBe(false);
    });

    it("returns false for expired entries", () => {
      vi.useFakeTimers();
      const cache = new LruCache<string, number>(10, { ttlMs: 500 });
      cache.set("a", 1);
      vi.advanceTimersByTime(501);
      expect(cache.has("a")).toBe(false);
      vi.useRealTimers();
    });
  });

  describe("constructor validation", () => {
    it("rejects maxSize of zero", () => {
      expect(() => new LruCache(0)).toThrow(RangeError);
    });

    it("rejects negative maxSize", () => {
      expect(() => new LruCache(-1)).toThrow(RangeError);
    });
  });
});
