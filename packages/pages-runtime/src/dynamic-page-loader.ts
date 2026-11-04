import type { Component } from "@casehubio/pages-component";
import type { PageApiClient, PageMetadata } from "./page-api.js";
import { parseDynamicPage } from "@casehubio/pages-ui/dist/parser/dynamic-page-parser.js";
import { load as yamlLoad } from "js-yaml";
import { LruCache } from "./lru-cache.js";

export interface DynamicPageLoaderOptions {
  readonly maxCacheSize?: number;
  readonly ttlMs?: number;
}

export class DynamicPageLoader {
  readonly #client: PageApiClient;
  readonly #cache: LruCache<string, Component>;
  #metaCache: PageMetadata[] | null = null;
  #globalDefaults: Record<string, unknown> | undefined;

  constructor(client: PageApiClient, globalDefaults?: Record<string, unknown>, options?: DynamicPageLoaderOptions) {
    this.#client = client;
    this.#globalDefaults = globalDefaults;
    this.#cache = new LruCache(options?.maxCacheSize ?? Infinity, options?.ttlMs ? { ttlMs: options.ttlMs } : undefined);
  }

  async fetchIndex(): Promise<PageMetadata[]> {
    if (this.#metaCache) return this.#metaCache;
    this.#metaCache = await this.#client.list();
    return this.#metaCache;
  }

  async fetchPage(name: string): Promise<Component> {
    const cached = this.#cache.get(name);
    if (cached) return cached;

    const doc = await this.#client.get(name);
    const raw = yamlLoad(doc.yaml) as Record<string, unknown>;
    const component = parseDynamicPage(raw, this.#globalDefaults);
    this.#cache.set(name, component);
    return component;
  }

  invalidate(name: string): void {
    this.#cache.delete(name);
  }

  invalidateAll(): void {
    this.#cache.clear();
    this.#metaCache = null;
  }
}
