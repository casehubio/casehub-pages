import { describe, it, expect, vi } from "vitest";
import { DynamicPageLoader } from "./dynamic-page-loader.js";
import type { PageMetadata, PageDocument } from "./page-api.js";

function pageYaml(name: string): string {
  return `name: ${name}\ncomponents:\n  - type: title\n    properties:\n      text: ${name}\n`;
}

function mockClient(
  meta: PageMetadata[],
  pages: Record<string, PageDocument>,
) {
  return {
    list: vi.fn().mockResolvedValue(meta),
    get: vi.fn().mockImplementation((name: string) => {
      const page = pages[name];
      if (!page) return Promise.reject(new Error("Not found"));
      return Promise.resolve(page);
    }),
  };
}

describe("DynamicPageLoader", () => {
  it("fetches metadata listing", async () => {
    const client = mockClient(
      [{ name: "custom", description: "A page" }],
      {},
    );

    const loader = new DynamicPageLoader(client as any);
    const meta = await loader.fetchIndex();
    expect(meta).toHaveLength(1);
    expect(meta[0]!.name).toBe("custom");
  });

  it("fetches and parses a single page", async () => {
    const client = mockClient([], {
      custom: { name: "custom", yaml: pageYaml("custom") },
    });

    const loader = new DynamicPageLoader(client as any);
    const component = await loader.fetchPage("custom");
    expect(component.type).toBe("page");
    expect(component.props?.name).toBe("custom");
  });

  it("caches fetched pages", async () => {
    const client = mockClient([], {
      cached: { name: "cached", yaml: pageYaml("cached") },
    });

    const loader = new DynamicPageLoader(client as any);
    await loader.fetchPage("cached");
    await loader.fetchPage("cached");
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("invalidates cache for a single page", async () => {
    const client = mockClient([], {
      inv: { name: "inv", yaml: pageYaml("inv") },
    });

    const loader = new DynamicPageLoader(client as any);
    await loader.fetchPage("inv");
    loader.invalidate("inv");
    await loader.fetchPage("inv");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("invalidateAll clears both page and metadata cache", async () => {
    const client = mockClient(
      [{ name: "p" }],
      { p: { name: "p", yaml: pageYaml("p") } },
    );

    const loader = new DynamicPageLoader(client as any);
    await loader.fetchIndex();
    await loader.fetchPage("p");
    loader.invalidateAll();
    await loader.fetchIndex();
    await loader.fetchPage("p");
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  describe("LRU eviction", () => {
    it("evicts least recently used page when cache exceeds maxCacheSize", async () => {
      const client = mockClient([], {
        a: { name: "a", yaml: pageYaml("a") },
        b: { name: "b", yaml: pageYaml("b") },
        c: { name: "c", yaml: pageYaml("c") },
      });

      const loader = new DynamicPageLoader(client as any, undefined, { maxCacheSize: 2 });
      await loader.fetchPage("a");
      await loader.fetchPage("b");
      await loader.fetchPage("c"); // evicts "a"

      client.get.mockClear();
      await loader.fetchPage("b"); // cache hit
      await loader.fetchPage("c"); // cache hit
      expect(client.get).toHaveBeenCalledTimes(0);

      await loader.fetchPage("a"); // cache miss — was evicted
      expect(client.get).toHaveBeenCalledTimes(1);
      expect(client.get).toHaveBeenCalledWith("a");
    });

    it("accessing a cached page refreshes its position", async () => {
      const client = mockClient([], {
        a: { name: "a", yaml: pageYaml("a") },
        b: { name: "b", yaml: pageYaml("b") },
        c: { name: "c", yaml: pageYaml("c") },
      });

      const loader = new DynamicPageLoader(client as any, undefined, { maxCacheSize: 2 });
      await loader.fetchPage("a");
      await loader.fetchPage("b");
      await loader.fetchPage("a"); // refresh "a" — "b" is now LRU
      await loader.fetchPage("c"); // evicts "b", not "a"

      client.get.mockClear();
      await loader.fetchPage("a"); // cache hit
      expect(client.get).toHaveBeenCalledTimes(0);

      await loader.fetchPage("b"); // cache miss — was evicted
      expect(client.get).toHaveBeenCalledTimes(1);
    });

    it("defaults to unbounded cache when maxCacheSize not specified", async () => {
      const pages: Record<string, PageDocument> = {};
      for (let i = 0; i < 100; i++) {
        const name = `page-${String(i)}`;
        pages[name] = { name, yaml: pageYaml(name) };
      }
      const client = mockClient([], pages);

      const loader = new DynamicPageLoader(client as any);
      for (let i = 0; i < 100; i++) {
        await loader.fetchPage(`page-${String(i)}`);
      }

      client.get.mockClear();
      for (let i = 0; i < 100; i++) {
        await loader.fetchPage(`page-${String(i)}`);
      }
      expect(client.get).toHaveBeenCalledTimes(0); // all still cached
    });
  });

  describe("cache expiry", () => {
    it("re-fetches page after ttl expires", async () => {
      vi.useFakeTimers();
      const client = mockClient([], {
        stale: { name: "stale", yaml: pageYaml("stale") },
      });

      const loader = new DynamicPageLoader(client as any, undefined, {
        maxCacheSize: 10,
        ttlMs: 5000,
      });
      await loader.fetchPage("stale");
      vi.advanceTimersByTime(5001);
      await loader.fetchPage("stale"); // should re-fetch
      expect(client.get).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("serves from cache before ttl expires", async () => {
      vi.useFakeTimers();
      const client = mockClient([], {
        fresh: { name: "fresh", yaml: pageYaml("fresh") },
      });

      const loader = new DynamicPageLoader(client as any, undefined, {
        maxCacheSize: 10,
        ttlMs: 5000,
      });
      await loader.fetchPage("fresh");
      vi.advanceTimersByTime(4999);
      await loader.fetchPage("fresh"); // should be cache hit
      expect(client.get).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
