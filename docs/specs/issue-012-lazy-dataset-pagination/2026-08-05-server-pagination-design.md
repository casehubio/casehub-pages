# Server-Side Pagination for Datasets

**Issue:** #12 — Add lazy on-demand pagination for datasets
**Date:** 2026-08-05
**Approach:** Pipeline-level pagination (Approach 3)

## §1 — Dataset Definition Extension

Add a `serverPagination` config to `ExternalDataSetDef`:

```typescript
export interface ServerPaginationConfig {
  readonly offsetParam: string;    // template var name for offset
  readonly limitParam: string;     // template var name for limit
  readonly sortParam?: string;     // template var name for sort column
  readonly orderParam?: string;    // template var name for sort direction
  readonly filterParam?: string;   // template var name for filter expression
  readonly defaultPageSize: number;
  readonly maxCachedPages?: number; // default 5
}
```

On `ExternalDataSetDef`:
```typescript
readonly serverPagination?: ServerPaginationConfig;
```

The URL template uses these params:
```
https://api.example.com/items?start={offset}&size={limit}&sort={sort}&dir={order}
```

When `serverPagination` is present, the pipeline treats this dataset as server-paged.
`serverQuery` remains separate — it sends the full lookup to a query endpoint. Server
pagination is simpler: template URL + offset/limit.

## §2 — Page Cache

A `PageCache` class in `pages-data`, co-located with the DataSetManager.

```typescript
interface PageCacheKey {
  readonly offset: number;
  readonly limit: number;
  readonly sort?: string;
  readonly order?: string;
  readonly filter?: string;
}

interface CachedPage {
  readonly dataset: TypedDataSet;
  readonly totalRows: number;
}
```

Cache behaviour:
- **Hit**: return `CachedPage` immediately — no fetch
- **Miss**: return `undefined` — caller fetches and calls `store(key, page)`
- **Invalidation**: sort or filter change → `clear()` the entire cache
- **Eviction**: LRU bounded by `maxCachedPages` (default 5). When full, evict
  least-recently-accessed page
- **Key serialisation**: `${offset}:${limit}:${sort ?? ''}:${order ?? ''}:${filter ?? ''}`
  — deterministic string for Map lookup

The cache lives per-dataset, created when the pipeline first encounters a
`serverPagination` dataset. Stored in a `Map<DataSetId, PageCache>` alongside
the existing `connectors` map in the pipeline.

## §3 — Pipeline Integration

Changes touch three places. No new event types — uses existing `pages-page`,
`pages-sort`, `pages-filter`.

### 3a — Detection and setup (`handleDefRequest`)

When `def.serverPagination` is present:
- Create a `PageCache` for this dataset (if not already created)
- Store the `ServerPaginationConfig` in a `Map<DataSetId, ServerPaginationConfig>`
- Fetch page 0 using the template URL with offset=0, limit=defaultPageSize
- On response: store in page cache, apply as `SnapshotEvent` to the manager,
  call `pushData()` to deliver

No `SourceConnector` is created for server-paged datasets. The pipeline manages
fetches directly — the connect/disconnect lifecycle doesn't fit request-response
pagination.

### 3b — Page navigation (`pushData`)

```
if dataset has serverPagination config:
  key = buildCacheKey(offset, count, currentSort, currentFilter)
  cached = pageCache.get(key)
  if cached:
    deliver cached.dataset to target (immediate — no loading state)
    target.totalRows = cached.totalRows
  else:
    target.loading = true
    url = resolveTemplate(def.url, { offset, limit, sort, order, filter })
    fetch(url) → extract dataset
    pageCache.store(key, { dataset, totalRows })
    deliver to target
    target.loading = false
else:
  existing client-side slice path (unchanged)
```

### 3c — Sort/filter invalidation

When sort or filter changes on a server-paged dataset:
- `pageCache.clear()` — all cached pages are stale
- Reset page to 0
- Fetch page 0 with the new sort/filter params
- Deliver

### 3d — Corrupted view protection

When `serverPagination` is set:
- `manager.lookup()` is never called with client-side sort/filter ops — operations
  are stripped and a warning is logged if any are present
- The table's `clientSort` and `clientFilter` properties are forced to `false`
- If a component tries to use both: `"[DataPipeline] Dataset "${id}" uses server
  pagination — client-side ${opType} ignored"`

## §4 — URL Template Resolution

Reuses existing `resolveTemplate` infrastructure. Pagination params are injected
as template variables alongside context variables.

**Resolution order:**
1. Context variables (from `ContextManager`) — resolved first
2. Pagination variables (`offset`, `limit`, `sort`, `order`, `filter`) — injected
   from the page request

Pagination variables use the names declared in `ServerPaginationConfig`. If the
config says `offsetParam: "skip"`, the template uses `{skip}` and the pipeline fills
it with the offset value.

**Unresolved params:**
- `sort`/`order`/`filter` with no active value → empty string. URL builder strips
  empty query params.
- `offset` or `limit` unresolved (misconfigured) → fetch blocked, warning logged.

**Mixed variables:** A URL can have both context variables (`{selectedRegion}`) and
pagination variables (`{offset}`, `{limit}`). Context variables are resolved by the
existing `ContextConsumer` mechanism; pagination variables by the server-pagination
path in `pushData()`.

## §5 — YAML Declaration and DSL Builder

### YAML

```yaml
datasets:
  orders:
    url: "https://api.example.com/orders?offset={skip}&limit={take}&sort={sortCol}&dir={sortDir}"
    totalPath: "meta.total"
    serverPagination:
      offsetParam: skip
      limitParam: take
      sortParam: sortCol
      orderParam: sortDir
      defaultPageSize: 25
      maxCachedPages: 10
```

No desugaring changes needed — `serverPagination` is dataset-level config,
passes through to `ExternalDataSetDef` as-is.

### DSL builder

```typescript
export interface ServerPaginationOptions {
  readonly offsetParam?: string;   // default: "offset"
  readonly limitParam?: string;    // default: "limit"
  readonly sortParam?: string;
  readonly orderParam?: string;
  readonly filterParam?: string;
  readonly defaultPageSize?: number; // default: 25
  readonly maxCachedPages?: number;  // default: 5
}

export function serverPaginated(options?: ServerPaginationOptions): ServerPaginationConfig {
  return {
    offsetParam: options?.offsetParam ?? "offset",
    limitParam: options?.limitParam ?? "limit",
    sortParam: options?.sortParam,
    orderParam: options?.orderParam,
    filterParam: options?.filterParam,
    defaultPageSize: options?.defaultPageSize ?? 25,
    maxCachedPages: options?.maxCachedPages ?? 5,
  };
}
```

`DataSourceBinding` gains an optional `serverPagination` field to carry the
config from bind declaration through to the pipeline.

## §6 — Testing Strategy

**Unit tests (pages-data):**
- PageCache — hit, miss, LRU eviction at capacity, `clear()` invalidation,
  key serialisation with and without sort/filter

**Unit tests (pages-runtime):**
- `pushData()` server-pagination branch — cache hit delivers immediately,
  cache miss triggers fetch
- Sort change clears cache and re-fetches page 0
- Filter change clears cache and re-fetches page 0
- Client-side sort/filter ops stripped with warning for server-paged datasets
- Template URL resolution with pagination params — empty params omitted
- Mixed context + pagination variables in same URL template

**Integration tests (pages-runtime):**
- Full round-trip: table emits `pages-page` → pipeline fetches → table receives
  page data + totalRows
- Page forward → page back → cache hit (no second fetch)
- Sort click → cache cleared → page 0 re-fetched with sort params
- Navigate beyond totalRows → clamped to last page

**Test doubles:**
- Mock `fetch` via `fetchFn` (existing pattern from `restSource` tests)
- Track fetch call count to verify cache hits vs misses
- No real HTTP — all unit-testable

## §7 — Scope and Non-Goals

**In scope:**
- REST APIs with offset/limit query parameters
- Server-side sort and filter via URL template params
- LRU page cache with sort/filter invalidation
- Corrupted view protection
- YAML declaration and DSL builder

**Not in scope (future work):**
- Cursor-based pagination (GraphQL after/before)
- Prefetch (background fetch of page N+1)
- Server-side text filter via `pages-text-filter` event
- Push-based paginated sources (WebSocket/SSE)
- Infinite scroll
