# Platform Fixes Batch — Design Spec

**Date:** 2026-07-03
**Branch:** issue-16-platform-fixes-batch
**Covers:** #16, #60, #90, #96

---

## #16 — CSP Compliance: Replace `new Function()` with JSONata

### Problem

`cell-extract.ts:7-10` uses `new Function("value", ...)` (aliased as `FunctionCtor`) to evaluate column expressions. Requires `unsafe-eval` in CSP, blocking deployment in strict CSP environments.

### Fix

Replace with the existing JSONata bridge (`compileOrCached` from `@casehubio/pages-data/dist/expression/jsonata-bridge.js`). JSONata uses AST-based parsing — verified CSP-safe.

### Changes

**`packages/pages-viz/src/base/cell-extract.ts`:**
- Delete `FunctionCtor` alias and `compileCellExpression`
- `applyCellExpression` becomes async, uses `compileOrCached().evaluate()` with type-preserving coercion (numbers stay numbers, Dates stay Dates — unlike `evaluateExpression()` which stringifies)
- Error handling preserved: async `applyCellExpression` wraps the `await` in try/catch and returns the raw value on failure, matching the current silent-fallback behavior (`catch { return raw; }`). Both compilation errors (from `compileOrCached`) and runtime evaluation errors (rejected promises from `evaluate()`) fall back to the raw value. Existing dashboards that have expressions failing due to JavaScript→JSONata type differences will show raw values instead of errors.

**`packages/pages-viz/src/charts/option-pipeline.ts`:**
- `datasetToSource` becomes async — uses `Promise.all` for rows × columns

**8 chart components** (`PagesBarChart`, `PagesLineChart`, `PagesAreaChart`, `PagesPieChart`, `PagesScatterChart`, `PagesBubbleChart`, `PagesTimeseries`, `PagesMap`):
- Await `datasetToSource` in render methods

**`PagesTable`** — 2 call sites become `await applyCellExpression(...)`

**`PagesMetric`** — 1 call site becomes `await applyCellExpression(...)`

### Performance: async evaluate overhead

JSONata's `evaluate()` returns a Promise even for pure expressions. Making `applyCellExpression` async means one Promise allocation per cell with an expression. For a 1000-row × 10-column table with 3 expression columns, that's 3,000 promises per render.

Mitigating factors:
- For pure JSONata expressions (no custom async functions), `evaluate()` resolves synchronously — the overhead is microtask scheduling, not I/O
- Compilation is cached via `compileOrCached` — only the `evaluate()` call is per-cell
- The cost is dominated by downstream DOM rendering, not microtask allocation

**Benchmark requirement:** async `datasetToSource` must complete in under 10ms for 1000 rows × 10 expression columns on the test CI host. If the threshold is exceeded, refactor to column-level batching (one `evaluate()` per column using JSONata's `$map`, rather than per-cell).

### Expression syntax (breaking change)

Column expressions change from JavaScript to JSONata. This is an intentional capability trade: `new Function()` executes arbitrary JavaScript, requiring `unsafe-eval` in CSP. JSONata uses AST-based evaluation — no code generation, CSP-safe.

**Conversion table (all patterns found in existing example YAML):**

| JavaScript (current) | JSONata (new) | Used in |
|---|---|---|
| `value * 2` | `value * 2` | Arithmetic — identical |
| `value > 100 ? "high" : "low"` | `value > 100 ? "high" : "low"` | Ternary — identical |
| `value.replace("old", "new")` | `$replace(value, "old", "new")` | Prometheus label cleanup |
| `value.replaceAll("old", "new")` | `$replace(value, /old/, "new")` | Label cleanup (multiple files) |
| `value.split(",")[0]` | `$split(value, ",")[0]` | Backstage label extraction |
| `value.substring(0, 19)` | `$substring(value, 0, 19)` | ISO timestamp truncation |
| `parseInt(value / 1024)` | `$floor(value / 1024)` | Memory formatting |
| `parseInt(v) + " MB"` | `$string($floor(v)) & " MB"` | Memory display |
| `value + " suffix"` | `value & " suffix"` | String concatenation |
| `value.toUpperCase()` | `$uppercase(value)` | Case conversion |
| `Math.round(value)` | `$round(value)` | Rounding |
| `value.toFixed(2)` | `$formatNumber(value, "0.00")` | Number formatting |
| `new Date(v*1000).toISOString()` | `$fromMillis(v * 1000)` | Epoch to ISO |
| `/[a-z_]+="\|"/g` regex | `$replace(value, /[a-z_]+="\|"/, "")` | Regex label stripping |
| Multi-line `if/else` blocks | Chained ternary or JSONata `$` bindings | Conditional labels |

**Capability removed:** arbitrary JavaScript (`eval`-equivalent). No existing example uses capabilities beyond what JSONata provides. All 18 example YAML files with column expressions have mechanical JSONata equivalents.

**Migration:** example YAML files are updated as part of this changeset. External YAML files using column expressions will break and must be updated — this is a breaking change as stated.

### ARC42STORIES updates

**§8 Crosscutting Concepts** — update column expressions row:
> Column expressions — `cell-extract.ts` evaluates per-cell expressions via JSONata (`compileOrCached` from `jsonata-bridge.ts`). Sandboxed AST evaluation, CSP-safe. Replaces `new Function()` (#16).

**§12 Risks and Technical Debt** — update `new Function()` row:
> ~~`new Function()` requires CSP `unsafe-eval`~~ Resolved (#16) — column expressions migrated to JSONata AST evaluation. No `unsafe-eval` required.

### Tests

- Update `option-pipeline.test.ts` for async `datasetToSource`
- Add JSONata expression coverage: arithmetic, string (`$replace`, `$split`, `$uppercase`, `$substring`), conditional, `$fromMillis`, `$floor`, `$formatNumber`, error cases
- Verify `null` passthrough, type preservation (numeric, Date, string)
- **Note:** these are net-new tests — existing `cell-extract.test.ts` has zero coverage for `applyCellExpression` (only covers `cellToRaw` and `resolveColumnName`)

---

## #60 — Consolidate Component Push Loops via onChanged

### Problem

14 push sites across `data-pipeline.ts` (6) and `site.ts` (8) duplicate the pattern: iterate registry → match dataSetId → check vizElement → extract filterGroup → call pushData/handleDataRequest. Any new data path can forget to push.

### Fix

Three changes:

1. **Wire `DataSetManager.onChanged` to push** — `onChanged` already fires for every mutation (`snapshot`, `append`, `replace`, `remove`). Wire it to call `refreshDataSet(dataSetId)` on the pipeline. Eliminates all 6 data-pipeline.ts push loops.

2. **Add `refreshDataSet(dataSetId)` to `DataPipeline`** — encapsulates "iterate registry, find components subscribing to this dataset, call pushData for each." Replaces 4 site.ts loops with one-liners.

3. **Add `refreshAll()` to `DataPipeline`** — pushes all registered components. Replaces 2 site.ts loops (popstate, record-navigate) with one-liners.

### DataPipeline interface

```typescript
export interface DataPipeline {
  handleDataRequest(target: VizTarget, lookup: DataSetLookup, componentId: string): void;
  refreshDataSet(dataSetId: DataSetId): void;
  refreshAll(): void;
  setResolverCtx(ctx: ResolverContext): void;
  dispose(): void;
}
```

### Elimination map

**Eliminated by onChanged (6 sites in data-pipeline.ts):**

| Line | Trigger | Why eliminated |
|------|---------|----------------|
| 169-175 | Push source (WS/SSE) | `manager.apply()` fires `onChanged` |
| 477-483 | Parameterised URL resolve | Resolver calls `manager.apply()` internally |
| 524-527 | Initial resolution `.then()` | Redundant — `manager.apply()` inside resolver already fires `onChanged` → `refreshDataSet` pushes to all subscribers including the requesting component. Remove `pushData` from the `.then()` callback; retain `pendingResolutions.delete()` and `scheduleRefresh()` |
| 549-555 | Server-query refresh | Resolver calls `manager.apply()` internally |
| 586-598 | Generator refresh | `manager.apply()` fires `onChanged` |
| 614-625 | URL refresh | Resolver calls `manager.apply()` internally |

**Replaced by refreshDataSet (4 sites in site.ts):**

| Line | Trigger | Becomes |
|------|---------|---------|
| 385-390 | Post-save sync | `pipeline.refreshDataSet(scope.dataset)` |
| 707-711 | Record create | `pipeline.refreshDataSet(scope.dataset)` |
| 748-752 | Record delete | `pipeline.refreshDataSet(scope.dataset)` |
| 791-797 | Action complete | `for (const id of refresh) pipeline.refreshDataSet(id)` |

**Replaced by refreshAll (2 sites in site.ts):**

| Line | Trigger | Becomes |
|------|---------|---------|
| 677-681 | Record navigate | `pipeline.refreshAll()` |
| 973-978 | Popstate | `pipeline.refreshAll()` |

**Unchanged (2 filter handlers in site.ts):**

Filter event handlers at lines 546-572 keep their scoping logic (same-page, listening, selfApply, group matching, child dataScope propagation). The scoping is the value — it cannot be reduced to "push all subscribers."

### onChanged wiring (site.ts)

```typescript
const manager = createDataSetManager({
  onChanged: (id) => {
    contextManager.updateDataset(id, ...);  // existing
    pipeline.refreshDataSet(id);             // new
  },
});
```

### Design basis: resolver stores via manager.apply()

`resolveExternalDataSet` (resolver.ts) stores results exclusively via `manager.apply()`:
- Server-query route: `ctx.manager.apply(def.uuid, { type: "snapshot", dataset })` (line 113)
- Join route: `ctx.manager.apply(def.uuid, { type: "snapshot", dataset })` (line 128)
- Content/URL route: via `applyResolvedDataSet()` → `manager.apply()` (line 162→172-179)

This confirms the 3 resolver-triggered push sites (parameterised URL, server-query refresh, URL refresh) are eliminated by the `onChanged` wiring — every resolver path fires `onChanged` through `manager.apply()`.

### Tests

- Test that `manager.apply()` triggers component pushes automatically
- Test `refreshDataSet` pushes only matching components
- Test `refreshAll` pushes all registered components
- Regression: verify existing push behaviors still work end-to-end

---

## #96 — ServerRelayProvider Auth Gap

### Problem

`ServerRelayProvider` sends only `{ "Content-Type": "application/json" }` — no auth headers. `DataResource` is `@Authenticated`, so both endpoints require JWT. Works in dev mode only (Quarkus dev services bypass security).

### Fix

Follow the existing `ServerQueryClient` pattern exactly.

### Changes

**`server-relay.ts`:**
- Constructor: `(endpoint, fetchFn, tokenFn?)` — adds `fetchFn` for testability and `tokenFn` for auth
- Fetch: inject `Authorization: Bearer ${token}` when `tokenFn` returns a value
- 401 response: dispatch `pages-auth-expired` custom event

**`types.ts`:**
- Add `tokenFn?: () => string | null` to `DataProviderConfig.serverRelay`

**`provider-factory.ts`:**
- Pass `fetchFn` and `config.serverRelay.tokenFn` to `ServerRelayProvider` constructor

**`site.ts`:**
- Auto-inject `createDevAuthTokenFn()` for serverRelay when tokenFn not provided (same pattern as serverQuery block)

### Tests

- Test auth header injection when tokenFn returns a token
- Test no auth header when tokenFn returns null or is absent
- Test 401 dispatches `pages-auth-expired` event
- Update provider-factory tests for new constructor signature

---

## #90 — Server-side Data Caching (Caffeine)

### Problem

Both `/api/dataset/fetch` (relay) and `/api/dataset/query` (push-down) execute upstream calls on every request. No caching layer.

### Fix

Programmatic Caffeine cache with per-entry TTL and tenant isolation.

### New: `DataCacheService.java`

`@ApplicationScoped` bean wrapping relay and query calls.

**Cache key:**
```java
record CacheKey(String tenantId, String type, String hash) {}
```
- `tenantId` — from JWT, prevents cross-tenant data leakage
- `type` — `"relay"` or `"query"` namespace
- `hash` — SHA-256 of deterministic field concatenation (not full JSON serialization — field order must be stable regardless of construction path)

For relay: `hash = SHA256(url + "|" + method + "|" + sortedHeaders + "|" + sortedQuery + "|" + body)`.
For query: `hash = SHA256(dataSetId + "|" + sortedOperationsJson)`.

**Single cache instance** built with `Caffeine.newBuilder()`:
- `maximumSize` from config
- `Expiry` interface for per-entry TTL
- `recordStats()` for Micrometer metrics (hit rate, miss rate, eviction count, estimated size)
- For relay entries: global default TTL
- For query entries: TTL derived from request hint (see below), falling back to per-dataset config override, falling back to global default

**TTL derivation hierarchy** (highest precedence first):
1. Per-dataset config override: `casehub.pages.data.cache.ttl.<dataSetId>=120`
2. Request hint: frontend passes `refreshTimeSeconds` in the lookup/request — cache uses this as TTL for that entry
3. Source-type default: relay and query each have their own configurable default
4. Global default: `casehub.pages.data.cache.default-ttl-seconds`

This hierarchy ensures refresh timers are not defeated by caching — a dataset with `refreshTime: "30s"` automatically gets a 30-second TTL via the request hint, so every frontend refresh sees fresh data.

### refreshTimeSeconds hint — type changes

The TTL hint requires coordinated frontend and backend type changes:

**Frontend (`packages/pages-data`):**
- `DataSetLookup` (lookup.ts:5-8): add `readonly refreshTimeSeconds?: number`
- `DataRequest` (types.ts:44-52): add `readonly refreshTimeSeconds?: number`
- `resolveExternalDataSet` (resolver.ts): derive value from `ExternalDataSetDef.refreshTime` (string like `"30s"`) via `parseRefreshTime()`, convert from ms to seconds, and include in the `DataSetLookup` / `DataRequest` passed to `ServerQueryClient.query()` / `ServerRelayProvider.fetch()`
- `ServerQueryClient` and `ServerRelayProvider`: include `refreshTimeSeconds` in the JSON body sent to the backend

**Backend (`backend/data`):**
- `DataSetLookup.java`: `public record DataSetLookup(String dataSetId, List<DataSetOp> operations, Integer refreshTimeSeconds) {}`
- `DataRequest.java`: `public record DataRequest(String url, String method, Map<String, String> headers, Map<String, String> query, Map<String, String> form, String body, Integer refreshTimeSeconds) {}`
- `DataCacheService`: reads `refreshTimeSeconds` from the incoming request/lookup; uses it in the TTL derivation hierarchy (step 2)
- `RelayClient.fetch()`: strips `refreshTimeSeconds` before building the upstream HTTP request — it is cache metadata, not part of the relayed request

**Public API:**
- `fetchCached(tenantId, DataRequest) → FetchResult`
- `queryCached(tenantId, DataSetLookup) → DataSetResult`
- `invalidate(tenantId, dataSetId)` — evicts query-cache entries whose lookup contains the dataSetId. Does NOT touch relay entries (relay entries are keyed by URL, not dataSetId — they expire via TTL or `invalidateAll`)
- `invalidateAll(tenantId)` — evicts all entries for tenant (relay and query)

### DataResource changes

`DataResource` delegates to `DataCacheService`:
- `fetch()`: `cacheService.fetchCached(tenantId, request)` — SSRF `validateTarget` runs inside `DataCacheService` on cache miss only, before the upstream call. Cached results were already validated at fetch time; re-validating on hits wastes DNS resolution I/O. If the allowlist changes, invalidate the cache.
- `query()`: `cacheService.queryCached(tenantId, lookup)`
- New endpoint: `DELETE /api/dataset/cache/{dataSetId}` → `cacheService.invalidate(tenantId, dataSetId)`

### Configuration

Create `src/main/resources/application.properties` (does not exist — backend/data has only `src/test/resources/application.properties`):

```properties
casehub.pages.data.cache.enabled=true
casehub.pages.data.cache.maximum-size=500
casehub.pages.data.cache.default-ttl-seconds=60
casehub.pages.data.cache.relay-default-ttl-seconds=60
casehub.pages.data.cache.query-default-ttl-seconds=60
# Per-dataset override (admin escape hatch — primary TTL comes from request hints):
# casehub.pages.data.cache.ttl.<dataSetId>=120
```

### Observability

Enable Caffeine's built-in Micrometer integration:
- `Caffeine.newBuilder().recordStats()` — collects hit count, miss count, eviction count, load time
- Register with Quarkus Micrometer via `CaffeineCacheMetrics.monitor(meterRegistry, cache, "pages-data-cache")`
- Metrics exposed on the standard `/q/metrics` endpoint: `cache_gets_total{result="hit|miss"}`, `cache_evictions_total`, `cache_size`

### Dependencies

- Add `com.github.ben-manes.caffeine:caffeine` to `backend/data/pom.xml` (version from Quarkus BOM)
- Add `io.micrometer:micrometer-core` (already in Quarkus BOM via `quarkus-micrometer`)

### Tests

- Cache hit: same tenant + same request returns cached result without upstream call
- Cache miss: different tenant same request → separate cache entries (tenant isolation)
- TTL expiry: entry evicted after configured TTL
- TTL from request hint: entry with `refreshTimeSeconds=30` expires after 30s
- Per-dataset TTL override: dataset with config override uses its TTL, others use default
- Invalidation: `invalidate(tenant, dataSetId)` evicts query entries only, relay entries unaffected
- `invalidateAll(tenant)` evicts both relay and query entries
- SSRF check ordering: `validateTarget` runs on cache miss only, not on cache hits
- Cache key determinism: same logical request via different code paths produces same cache key
- Metrics: `recordStats()` emits hit/miss/eviction counters via Micrometer

---

## Cross-cutting

### Implementation order

1. **#96 first** — smallest change, unblocks auth-dependent testing of #90
2. **#90 second** — backend caching, independent of frontend changes
3. **#60 third** — push loop consolidation, largest refactor
4. **#16 last** — CSP fix, touches most files but all changes are mechanical

### No shared auth abstraction

Three sites use the `tokenFn` → `Authorization: Bearer` pattern (`ServerRelayProvider`, `ServerQueryClient`, `rest-layout-store.ts`). Three lines of obvious code doesn't warrant an abstraction. Each site is clear and self-contained.
