# Platform Fixes Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hortora:subagent-driven-development (recommended) or hortora:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 S-scale platform issues: auth gap (#96), server caching (#90), push loop duplication (#60), CSP compliance (#16).

**Architecture:** Four independent fixes on one branch, implemented in dependency order: #96 unblocks #90's auth-dependent testing, #90 is backend-only, #60 refactors the data pipeline, #16 migrates expressions to JSONata.

**Tech Stack:** TypeScript 5 (Vitest), Java 21 (Quarkus, Caffeine), JSONata, Apache ECharts

## Global Constraints

- Yarn 4.10 workspaces — `yarn build:packages` before `yarn build:components`
- TypeScript strict mode with `@typescript-eslint/strict-type-checked`
- Java records for DTOs — no mutable state
- All commits reference issues: `Refs #N` or `Closes #N`
- Spec: `docs/superpowers/specs/2026-07-03-platform-fixes-batch-design.md`

---

### Task 1: ServerRelayProvider Auth (#96)

**Files:**
- Modify: `packages/pages-data/src/dataset/external/providers/server-relay.ts`
- Modify: `packages/pages-data/src/dataset/external/types.ts:92-94`
- Modify: `packages/pages-data/src/dataset/external/provider-factory.ts:28`
- Modify: `packages/pages-runtime/src/site.ts:155-169`
- Modify: `packages/pages-data/src/dataset/external/provider-factory.test.ts`

**Interfaces:**
- Consumes: `DataProvider` interface (`fetch(request: DataRequest): Promise<FetchResult>`), `createDevAuthTokenFn()` from `dev-auth.ts`
- Produces: `ServerRelayProvider(endpoint, fetchFn, tokenFn?)` constructor, `DataProviderConfig.serverRelay.tokenFn` field

- [ ] **Step 1: Write failing test for auth header injection**

In `packages/pages-data/src/dataset/external/provider-factory.test.ts`, add after the last test:

```typescript
it("passes fetchFn and tokenFn to ServerRelayProvider", async () => {
  const tokenFn = () => "test-jwt-token";
  const customFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ value: 1 }), {
      headers: { "content-type": "application/json" },
    }),
  );
  const factoryWithAuth = createDataProviderFactory(customFetch);
  const provider = factoryWithAuth.create(
    def({ url: "https://api.example.com/data" }),
    config({
      defaultProvider: "server-relay",
      serverRelay: { endpoint: "https://relay.example.com/fetch", tokenFn },
    }),
  );

  expect(provider).toBeInstanceOf(ServerRelayProvider);

  await provider!.fetch({
    url: "https://api.example.com/data",
    method: HttpMethod.GET,
    query: {},
    headers: {},
  });

  expect(customFetch).toHaveBeenCalledWith(
    "https://relay.example.com/fetch",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer test-jwt-token",
      }),
    }),
  );
});

it("omits Authorization header when tokenFn returns null", async () => {
  const tokenFn = () => null;
  const customFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ value: 1 }), {
      headers: { "content-type": "application/json" },
    }),
  );
  const factoryWithAuth = createDataProviderFactory(customFetch);
  const provider = factoryWithAuth.create(
    def({ url: "https://api.example.com/data" }),
    config({
      defaultProvider: "server-relay",
      serverRelay: { endpoint: "https://relay.example.com/fetch", tokenFn },
    }),
  );

  await provider!.fetch({
    url: "https://api.example.com/data",
    method: HttpMethod.GET,
    query: {},
    headers: {},
  });

  const calledHeaders = (customFetch.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
  expect(calledHeaders).not.toHaveProperty("Authorization");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-data run test -- --run src/dataset/external/provider-factory.test.ts`

Expected: FAIL — `ServerRelayProvider` constructor takes 1 arg, tests pass 3 via factory.

- [ ] **Step 3: Update ServerRelayProvider**

Replace the full contents of `packages/pages-data/src/dataset/external/providers/server-relay.ts`:

```typescript
import type { DataProvider, DataRequest, FetchResult } from "../types.js";

export class ServerRelayProvider implements DataProvider {
  constructor(
    private readonly endpoint: string,
    private readonly fetchFn: typeof globalThis.fetch,
    private readonly tokenFn?: () => string | null,
  ) {}

  async fetch(request: DataRequest): Promise<FetchResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.tokenFn?.();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (response.status === 401) {
      if (typeof globalThis.dispatchEvent === "function") {
        globalThis.dispatchEvent(
          new CustomEvent("pages-auth-expired", { detail: { endpoint: this.endpoint } }),
        );
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${String(response.status)} ${response.statusText}: ${text}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("json")) {
      const data: unknown = await response.json();
      return { data, contentType };
    }
    const data = await response.text();
    return contentType ? { data, contentType } : { data };
  }
}
```

- [ ] **Step 4: Add tokenFn to DataProviderConfig.serverRelay**

In `packages/pages-data/src/dataset/external/types.ts`, replace lines 92-94:

```typescript
  readonly serverRelay?: {
    readonly endpoint: string;
    readonly tokenFn?: () => string | null;
  };
```

- [ ] **Step 5: Update provider-factory to pass fetchFn and tokenFn**

In `packages/pages-data/src/dataset/external/provider-factory.ts`, replace line 28:

```typescript
          ? new ServerRelayProvider(config.serverRelay.endpoint, fetchFn ?? globalThis.fetch.bind(globalThis), config.serverRelay.tokenFn)
```

- [ ] **Step 6: Wire auto-inject in site.ts**

In `packages/pages-runtime/src/site.ts`, find the `providerConfig` block (around line 158) and add the `serverRelay` auto-injection after the `serverQuery` block:

```typescript
      ...(options?.providerConfig?.serverRelay ? {
        serverRelay: {
          ...options.providerConfig.serverRelay,
          tokenFn: options.providerConfig.serverRelay.tokenFn ?? createDevAuthTokenFn(),
        },
      } : {}),
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-data run test -- --run src/dataset/external/provider-factory.test.ts`

Expected: ALL PASS

- [ ] **Step 8: Run full package test suite**

Run: `yarn workspace @casehubio/pages-data run test`

Expected: ALL PASS — no regressions

- [ ] **Step 9: Commit**

```
git add packages/pages-data/src/dataset/external/providers/server-relay.ts packages/pages-data/src/dataset/external/types.ts packages/pages-data/src/dataset/external/provider-factory.ts packages/pages-data/src/dataset/external/provider-factory.test.ts packages/pages-runtime/src/site.ts
git commit -m "fix: add auth token support to ServerRelayProvider (#96)

ServerRelayProvider now accepts fetchFn and tokenFn, matching
ServerQueryClient's auth pattern. site.ts auto-injects
createDevAuthTokenFn() for serverRelay config.

Refs #96"
```

---

### Task 2: Server-side Data Caching (#90)

**Files:**
- Modify: `backend/data/pom.xml`
- Create: `backend/data/src/main/resources/application.properties`
- Modify: `backend/data/src/main/java/io/casehub/pages/data/DataRequest.java`
- Modify: `backend/data/src/main/java/io/casehub/pages/data/DataSetLookup.java`
- Create: `backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java`
- Modify: `backend/data/src/main/java/io/casehub/pages/data/DataResource.java`
- Modify: `backend/data/src/main/java/io/casehub/pages/data/RelayClient.java`
- Create: `backend/data/src/test/java/io/casehub/pages/data/DataCacheServiceTest.java`
- Modify: `packages/pages-data/src/dataset/lookup.ts:5-8`
- Modify: `packages/pages-data/src/dataset/external/types.ts:44-52`

**Interfaces:**
- Consumes: `RelayClient.fetch(DataRequest)`, `DataProvider.query(DataSetLookup)`, `JsonWebToken` (tenant extraction)
- Produces: `DataCacheService.fetchCached(tenantId, request)`, `DataCacheService.queryCached(tenantId, lookup)`, `DataCacheService.invalidate(tenantId, dataSetId)`, `DataCacheService.invalidateAll(tenantId)`, `DELETE /api/dataset/cache/{dataSetId}` endpoint

- [ ] **Step 1: Add Caffeine dependency to pom.xml**

In `backend/data/pom.xml`, add after line 28 (after `quarkus-arc`):

```xml
        <dependency>
            <groupId>com.github.ben-manes.caffeine</groupId>
            <artifactId>caffeine</artifactId>
        </dependency>
```

No version — managed by Quarkus BOM in parent pom.

- [ ] **Step 2: Create application.properties**

Create `backend/data/src/main/resources/application.properties`:

```properties
casehub.pages.data.cache.enabled=true
casehub.pages.data.cache.maximum-size=500
casehub.pages.data.cache.default-ttl-seconds=60
casehub.pages.data.cache.relay-default-ttl-seconds=60
casehub.pages.data.cache.query-default-ttl-seconds=60
```

- [ ] **Step 3: Add refreshTimeSeconds to backend records**

Replace `backend/data/src/main/java/io/casehub/pages/data/DataRequest.java`:

```java
package io.casehub.pages.data;

import java.util.Map;

public record DataRequest(
    String url,
    String method,
    Map<String, String> headers,
    Map<String, String> query,
    Map<String, String> form,
    String body,
    Integer refreshTimeSeconds
) {}
```

Replace `backend/data/src/main/java/io/casehub/pages/data/DataSetLookup.java`:

```java
package io.casehub.pages.data;

import java.util.List;

public record DataSetLookup(String dataSetId, List<DataSetOp> operations, Integer refreshTimeSeconds) {}
```

- [ ] **Step 4: Write failing test for DataCacheService**

Create `backend/data/src/test/java/io/casehub/pages/data/DataCacheServiceTest.java`:

```java
package io.casehub.pages.data;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DataCacheServiceTest {

    private DataCacheService cache;
    private int fetchCount;
    private int queryCount;

    @BeforeEach
    void setUp() {
        cache = new DataCacheService();
        cache.enabled = true;
        cache.maximumSize = 100;
        cache.defaultTtlSeconds = 60;
        cache.relayDefaultTtlSeconds = 60;
        cache.queryDefaultTtlSeconds = 60;
        cache.init();
        fetchCount = 0;
        queryCount = 0;
    }

    @Test
    void cacheHitReturnsSameResult() {
        var request = new DataRequest("https://api.example.com/data", "GET", Map.of(), Map.of(), null, null, null);
        var expected = new FetchResult("cached-data", "application/json");

        var result1 = cache.fetchCached("tenant-1", request, () -> { fetchCount++; return expected; });
        var result2 = cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("different", null); });

        assertThat(result1.data()).isEqualTo("cached-data");
        assertThat(result2.data()).isEqualTo("cached-data");
        assertThat(fetchCount).isEqualTo(1);
    }

    @Test
    void differentTenantsGetSeparateEntries() {
        var request = new DataRequest("https://api.example.com/data", "GET", Map.of(), Map.of(), null, null, null);

        cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("t1", null); });
        cache.fetchCached("tenant-2", request, () -> { fetchCount++; return new FetchResult("t2", null); });

        assertThat(fetchCount).isEqualTo(2);
    }

    @Test
    void queryCacheHit() {
        var lookup = new DataSetLookup("ds-1", List.of(), null);
        var expected = new DataSetResult(List.of(), List.of());

        var result1 = cache.queryCached("tenant-1", lookup, () -> { queryCount++; return expected; });
        var result2 = cache.queryCached("tenant-1", lookup, () -> { queryCount++; return new DataSetResult(List.of(), List.of()); });

        assertThat(result1).isSameAs(expected);
        assertThat(result2).isSameAs(expected);
        assertThat(queryCount).isEqualTo(1);
    }

    @Test
    void invalidateRemovesQueryEntries() {
        var lookup = new DataSetLookup("ds-1", List.of(), null);
        cache.queryCached("tenant-1", lookup, () -> { queryCount++; return new DataSetResult(List.of(), List.of()); });
        assertThat(queryCount).isEqualTo(1);

        cache.invalidate("tenant-1", "ds-1");

        cache.queryCached("tenant-1", lookup, () -> { queryCount++; return new DataSetResult(List.of(), List.of()); });
        assertThat(queryCount).isEqualTo(2);
    }

    @Test
    void invalidateAllClearsTenantEntries() {
        var request = new DataRequest("https://api.example.com/data", "GET", Map.of(), Map.of(), null, null, null);
        cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("data", null); });

        cache.invalidateAll("tenant-1");

        cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("data2", null); });
        assertThat(fetchCount).isEqualTo(2);
    }

    @Test
    void refreshTimeSecondsHintOverridesTtl() throws InterruptedException {
        var lookup = new DataSetLookup("ds-1", List.of(), 1);
        cache.queryCached("tenant-1", lookup, () -> { queryCount++; return new DataSetResult(List.of(), List.of()); });
        assertThat(queryCount).isEqualTo(1);

        Thread.sleep(1500);

        cache.queryCached("tenant-1", lookup, () -> { queryCount++; return new DataSetResult(List.of(), List.of()); });
        assertThat(queryCount).isEqualTo(2);
    }

    @Test
    void disabledCacheAlwaysMisses() {
        cache.enabled = false;
        cache.init();

        var request = new DataRequest("https://api.example.com/data", "GET", Map.of(), Map.of(), null, null, null);
        cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("data", null); });
        cache.fetchCached("tenant-1", request, () -> { fetchCount++; return new FetchResult("data", null); });

        assertThat(fetchCount).isEqualTo(2);
    }
}
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd backend && /opt/homebrew/bin/mvn test -pl data -Dtest=DataCacheServiceTest -Dsurefire.useFile=false`

Expected: FAIL — `DataCacheService` class does not exist.

- [ ] **Step 6: Implement DataCacheService**

Create `backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java`:

```java
package io.casehub.pages.data;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

@ApplicationScoped
public class DataCacheService {

    @ConfigProperty(name = "casehub.pages.data.cache.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "casehub.pages.data.cache.maximum-size", defaultValue = "500")
    int maximumSize;

    @ConfigProperty(name = "casehub.pages.data.cache.default-ttl-seconds", defaultValue = "60")
    long defaultTtlSeconds;

    @ConfigProperty(name = "casehub.pages.data.cache.relay-default-ttl-seconds", defaultValue = "60")
    long relayDefaultTtlSeconds;

    @ConfigProperty(name = "casehub.pages.data.cache.query-default-ttl-seconds", defaultValue = "60")
    long queryDefaultTtlSeconds;

    private Cache<CacheKey, CacheEntry> cache;

    record CacheKey(String tenantId, String type, String hash) {}

    record CacheEntry(Object value, long ttlNanos) {}

    @PostConstruct
    void init() {
        if (!enabled) {
            cache = null;
            return;
        }
        cache = Caffeine.newBuilder()
            .maximumSize(maximumSize)
            .expireAfterWrite(new Expiry<CacheKey, CacheEntry>() {
                @Override
                public long expireAfterCreate(CacheKey key, CacheEntry entry, long currentTime) {
                    return entry.ttlNanos();
                }

                @Override
                public long expireAfterUpdate(CacheKey key, CacheEntry entry, long currentTime, long currentDuration) {
                    return entry.ttlNanos();
                }

                @Override
                public long expireAfterRead(CacheKey key, CacheEntry entry, long currentTime, long currentDuration) {
                    return currentDuration;
                }
            })
            .recordStats()
            .build();
    }

    public FetchResult fetchCached(String tenantId, DataRequest request, Supplier<FetchResult> loader) {
        if (cache == null) {
            return loader.get();
        }
        long ttl = resolveTtl("relay", request.refreshTimeSeconds(), relayDefaultTtlSeconds);
        var key = new CacheKey(tenantId, "relay", hashRelay(request));
        var entry = cache.get(key, k -> new CacheEntry(loader.get(), ttl));
        return (FetchResult) entry.value();
    }

    public DataSetResult queryCached(String tenantId, DataSetLookup lookup, Supplier<DataSetResult> loader) {
        if (cache == null) {
            return loader.get();
        }
        long ttl = resolveTtl("query", lookup.refreshTimeSeconds(), queryDefaultTtlSeconds);
        var key = new CacheKey(tenantId, "query", hashQuery(lookup));
        var entry = cache.get(key, k -> new CacheEntry(loader.get(), ttl));
        return (DataSetResult) entry.value();
    }

    public void invalidate(String tenantId, String dataSetId) {
        if (cache == null) return;
        cache.asMap().keySet().removeIf(k ->
            k.tenantId().equals(tenantId) && k.type().equals("query") && k.hash().startsWith(dataSetId + "|"));
    }

    public void invalidateAll(String tenantId) {
        if (cache == null) return;
        cache.asMap().keySet().removeIf(k -> k.tenantId().equals(tenantId));
    }

    private long resolveTtl(String type, Integer hintSeconds, long typeDefaultSeconds) {
        long seconds = (hintSeconds != null && hintSeconds > 0) ? hintSeconds : typeDefaultSeconds;
        if (seconds <= 0) seconds = defaultTtlSeconds;
        return TimeUnit.SECONDS.toNanos(seconds);
    }

    private String hashRelay(DataRequest r) {
        return sha256(
            (r.url() != null ? r.url() : "") + "|" +
            (r.method() != null ? r.method() : "GET") + "|" +
            sorted(r.headers()) + "|" +
            sorted(r.query()) + "|" +
            (r.body() != null ? r.body() : "")
        );
    }

    private String hashQuery(DataSetLookup l) {
        return l.dataSetId() + "|" + sha256(
            l.dataSetId() + "|" + (l.operations() != null ? l.operations().toString() : "")
        );
    }

    private static String sorted(Map<String, String> map) {
        if (map == null || map.isEmpty()) return "";
        return new TreeMap<>(map).toString();
    }

    private static String sha256(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            var hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            var sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && /opt/homebrew/bin/mvn test -pl data -Dtest=DataCacheServiceTest -Dsurefire.useFile=false`

Expected: ALL PASS

- [ ] **Step 8: Update DataResource to delegate to DataCacheService**

Replace `backend/data/src/main/java/io/casehub/pages/data/DataResource.java`:

```java
package io.casehub.pages.data;

import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Map;

@Path("/api/dataset")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DataResource {

    @Inject
    JsonWebToken jwt;

    @ConfigProperty(name = "casehub.pages.data.tenant-claim", defaultValue = "tenant_id")
    String tenantClaim;

    @Inject
    RelayClient relayClient;

    @Inject
    @Any
    Instance<DataProvider> providers;

    @Inject
    DataCacheService cacheService;

    @POST
    @Path("/fetch")
    public Response fetch(DataRequest request) {
        String tenantId = extractTenant();
        if (tenantId == null) {
            return missingTenantResponse();
        }

        FetchResult result = cacheService.fetchCached(tenantId, request, () -> {
            relayClient.validateTarget(request.url());
            return relayClient.fetch(request);
        });
        return Response.ok(result).build();
    }

    @POST
    @Path("/query")
    public Response query(DataSetLookup lookup) {
        String tenantId = extractTenant();
        if (tenantId == null) {
            return missingTenantResponse();
        }

        DataProvider provider = resolveProvider(lookup.dataSetId());
        if (provider == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", "No provider found for dataset: " + lookup.dataSetId()))
                .build();
        }

        DataSetResult result = cacheService.queryCached(tenantId, lookup, () -> provider.query(lookup));
        return Response.ok(result).build();
    }

    @DELETE
    @Path("/cache/{dataSetId}")
    public Response invalidateCache(@PathParam("dataSetId") String dataSetId) {
        String tenantId = extractTenant();
        if (tenantId == null) {
            return missingTenantResponse();
        }
        cacheService.invalidate(tenantId, dataSetId);
        return Response.noContent().build();
    }

    private DataProvider resolveProvider(String dataSetId) {
        for (DataProvider p : providers) {
            if (p.canHandle(dataSetId)) {
                return p;
            }
        }
        return null;
    }

    private String extractTenant() {
        Object claim = jwt.getClaim(tenantClaim);
        return claim != null ? claim.toString() : null;
    }

    private Response missingTenantResponse() {
        return Response.status(Response.Status.UNAUTHORIZED)
            .entity(Map.of("error", "Missing claim: " + tenantClaim))
            .build();
    }
}
```

- [ ] **Step 9: Add refreshTimeSeconds to frontend types**

In `packages/pages-data/src/dataset/lookup.ts`, add the field:

```typescript
export interface DataSetLookup {
  readonly dataSetId: DataSetId;
  readonly operations: readonly DataSetOp[];
  readonly refreshTimeSeconds?: number;
}
```

In `packages/pages-data/src/dataset/external/types.ts`, add to `DataRequest` (after `signal`):

```typescript
  readonly refreshTimeSeconds?: number;
```

- [ ] **Step 10: Run full backend test suite**

Run: `cd backend && /opt/homebrew/bin/mvn test -pl data -Dsurefire.useFile=false`

Expected: ALL PASS

- [ ] **Step 11: Run full frontend test suite**

Run: `yarn workspace @casehubio/pages-data run test`

Expected: ALL PASS — `refreshTimeSeconds` is optional so existing code is unaffected

- [ ] **Step 12: Commit**

```
git add backend/data/ packages/pages-data/src/dataset/lookup.ts packages/pages-data/src/dataset/external/types.ts
git commit -m "feat: add Caffeine data caching with per-entry TTL (#90)

DataCacheService wraps relay and query calls with a programmatic
Caffeine cache. Cache key includes tenantId for isolation.
TTL derived from refreshTimeSeconds hint, per-dataset config,
or global default. Invalidation endpoint at DELETE /api/dataset/cache/{id}.

Refs #90"
```

---

### Task 3: Consolidate Push Loops (#60)

**Files:**
- Modify: `packages/pages-runtime/src/data-pipeline.ts`
- Modify: `packages/pages-runtime/src/site.ts`
- Modify: `packages/pages-runtime/src/data-pipeline.test.ts` (if exists)

**Interfaces:**
- Consumes: `DataSetManager.onChanged` callback, `ComponentRegistry`, `pushData()` (internal)
- Produces: `DataPipeline.refreshDataSet(dataSetId)`, `DataPipeline.refreshAll()`

- [ ] **Step 1: Write failing test for refreshDataSet**

In `packages/pages-runtime/src/data-pipeline.test.ts` (or create it), add:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDataPipeline } from "./data-pipeline.js";
import type { DataPipeline, VizTarget } from "./data-pipeline.js";
import { createDataSetManager } from "@casehubio/pages-data/dist/dataset/manager.js";
import type { DataSetManager } from "@casehubio/pages-data/dist/dataset/manager.js";
import { dataSetId, ColumnType } from "@casehubio/pages-data/dist/dataset/types.js";
import type { TypedDataSet } from "@casehubio/pages-data/dist/dataset/types.js";
import { createTypedRow } from "@casehubio/pages-data/dist/dataset/conversion.js";
import { createFilterState } from "./cross-filter.js";
import { createDataScopeRegistry } from "./data-scope-registry.js";
import { createComponentViewState } from "./component-view-state.js";
import type { ComponentRegistry, ComponentEntry } from "./registry.js";

function makeDataset(): TypedDataSet {
  const columns = [{ id: "col1" as any, name: "col1", type: ColumnType.NUMBER }];
  return { columns, rows: [createTypedRow([{ type: ColumnType.NUMBER, value: 42 }], columns)] };
}

function makeTarget(): VizTarget {
  return { dataSet: undefined, totalRows: 0, theme: "", error: "", activeSort: undefined, activePage: undefined };
}

describe("refreshDataSet", () => {
  it("pushes data to all components subscribing to the given dataSetId", () => {
    const dsId = dataSetId("test-ds");
    const manager = createDataSetManager();
    const registry: ComponentRegistry = new Map();
    const pipeline = createDataPipeline(manager, { lookup: () => undefined } as any, registry, createFilterState(), createDataScopeRegistry(), createComponentViewState());

    const target1 = makeTarget();
    const target2 = makeTarget();
    const target3 = makeTarget();

    registry.set("comp-1", { vizElement: target1, originalLookup: { dataSetId: dsId, operations: [] }, pagePath: "", component: { type: "test", props: {} } } as any);
    registry.set("comp-2", { vizElement: target2, originalLookup: { dataSetId: dsId, operations: [] }, pagePath: "", component: { type: "test", props: {} } } as any);
    registry.set("comp-3", { vizElement: target3, originalLookup: { dataSetId: dataSetId("other-ds"), operations: [] }, pagePath: "", component: { type: "test", props: {} } } as any);

    manager.apply(dsId, { type: "snapshot", dataset: makeDataset() });

    pipeline.refreshDataSet(dsId);

    expect(target1.dataSet).toBeDefined();
    expect(target2.dataSet).toBeDefined();
    expect(target3.dataSet).toBeUndefined();
  });
});

describe("refreshAll", () => {
  it("pushes data to all registered components", () => {
    const dsId1 = dataSetId("ds-1");
    const dsId2 = dataSetId("ds-2");
    const manager = createDataSetManager();
    const registry: ComponentRegistry = new Map();
    const pipeline = createDataPipeline(manager, { lookup: () => undefined } as any, registry, createFilterState(), createDataScopeRegistry(), createComponentViewState());

    const target1 = makeTarget();
    const target2 = makeTarget();

    registry.set("comp-1", { vizElement: target1, originalLookup: { dataSetId: dsId1, operations: [] }, pagePath: "", component: { type: "test", props: {} } } as any);
    registry.set("comp-2", { vizElement: target2, originalLookup: { dataSetId: dsId2, operations: [] }, pagePath: "", component: { type: "test", props: {} } } as any);

    manager.apply(dsId1, { type: "snapshot", dataset: makeDataset() });
    manager.apply(dsId2, { type: "snapshot", dataset: makeDataset() });

    pipeline.refreshAll();

    expect(target1.dataSet).toBeDefined();
    expect(target2.dataSet).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/pages-runtime run test -- --run src/data-pipeline.test.ts`

Expected: FAIL — `refreshDataSet` and `refreshAll` do not exist on `DataPipeline`

- [ ] **Step 3: Add refreshDataSet and refreshAll to DataPipeline**

In `packages/pages-runtime/src/data-pipeline.ts`, add to the `DataPipeline` interface (after `handleDataRequest`):

```typescript
  refreshDataSet(dataSetId: DataSetId): void;
  refreshAll(): void;
```

In the `createDataPipeline` return object (after `handleDataRequest` implementation, before the closing `};`), add:

```typescript
    refreshDataSet(dataSetId: DataSetId): void {
      for (const [compId, entry] of registry) {
        if (entry.originalLookup?.dataSetId === dataSetId && entry.vizElement) {
          const filterGroup = (entry.component.props as Record<string, unknown> | undefined)
            ?.filter as { group?: string } | undefined;
          pushData(entry.vizElement, entry.originalLookup, entry.pagePath, filterGroup?.group, compId);
        }
      }
    },

    refreshAll(): void {
      for (const [compId, entry] of registry) {
        if (entry.vizElement && entry.originalLookup) {
          const filterGroup = (entry.component.props as Record<string, unknown> | undefined)
            ?.filter as { group?: string } | undefined;
          pushData(entry.vizElement, entry.originalLookup, entry.pagePath, filterGroup?.group, compId);
        }
      }
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @casehubio/pages-runtime run test -- --run src/data-pipeline.test.ts`

Expected: PASS

- [ ] **Step 5: Wire onChanged in site.ts**

In `packages/pages-runtime/src/site.ts`, replace the `onChanged` callback (around line 139-141):

```typescript
  const manager = createDataSetManager({
    onChanged: (id, dataset) => {
      contextManager.updateDataset(id, dataset);
      pipeline.refreshDataSet(id);
    },
  });
```

- [ ] **Step 6: Remove 6 push loops from data-pipeline.ts**

Remove the manual push loops at these locations (all in `data-pipeline.ts`):

1. **Lines 168-175** (push source callback) — remove the `for` loop after `manager.apply()`. Keep only `manager.apply(lookup.dataSetId, event);`

2. **Lines 476-483** (parameterised URL `.then()`) — remove the `for` loop. Keep `pendingResolutions.delete()` and `abortControllers.delete()`.

3. **Lines 524-527** (initial resolution `.then()`) — remove `pushData(target, lookup, ...)`. Keep `pendingResolutions.delete()` and `scheduleRefresh()`.

4. **Lines 548-555** (server-query refresh) — remove the `for` loop inside the `.then()`.

5. **Lines 586-598** (generator refresh) — remove the `for` loop after `manager.apply()`. Keep `manager.apply(dataSetId, event);`.

6. **Lines 614-625** (URL refresh) — remove the `for` loop inside the `.then()`.

- [ ] **Step 7: Replace 6 push loops in site.ts with one-liners**

Replace the push loops at these locations:

1. **Post-save (around line 385-390)**: Replace the `for` loop with `pipeline.refreshDataSet(scope.dataset);`

2. **Record create (around line 707-711)**: Replace the `for` loop with `pipeline.refreshDataSet(scope.dataset);`

3. **Record delete (around line 748-752)**: Replace the `for` loop with `pipeline.refreshDataSet(scope.dataset);`

4. **Action complete (around line 791-797)**: Replace the nested loop with:
   ```typescript
   for (const dsId of refresh) {
     pipeline.refreshDataSet(dsId as any);
   }
   ```

5. **Popstate (around line 973-978)**: Replace the `for` loop with `pipeline.refreshAll();`

6. **Record navigate (around line 677-681)**: Replace the `for` loop with `pipeline.refreshAll();`

- [ ] **Step 8: Run full runtime test suite**

Run: `yarn workspace @casehubio/pages-runtime run test`

Expected: ALL PASS

- [ ] **Step 9: Commit**

```
git add packages/pages-runtime/src/data-pipeline.ts packages/pages-runtime/src/site.ts packages/pages-runtime/src/data-pipeline.test.ts
git commit -m "refactor: consolidate 14 push loops via onChanged + refreshDataSet/refreshAll (#60)

DataSetManager.onChanged now auto-pushes to subscribing components.
DataPipeline gains refreshDataSet(id) and refreshAll() methods.
Eliminates 6 manual push loops in data-pipeline.ts (handled by onChanged)
and replaces 6 in site.ts with one-liners. Filter handlers unchanged.

Closes #60"
```

---

### Task 4: CSP Compliance — Replace new Function() with JSONata (#16)

**Files:**
- Modify: `packages/pages-viz/src/base/cell-extract.ts`
- Modify: `packages/pages-viz/src/base/cell-extract.test.ts`
- Modify: `packages/pages-viz/src/charts/option-pipeline.ts`
- Modify: `packages/pages-viz/src/charts/option-pipeline.test.ts`
- Modify: `packages/pages-viz/src/base/PagesChartElement.ts:84-87,91-103`
- Modify: `packages/pages-viz/src/charts/PagesBarChart.ts:25`
- Modify: `packages/pages-viz/src/charts/PagesLineChart.ts:25`
- Modify: `packages/pages-viz/src/charts/PagesAreaChart.ts:25`
- Modify: `packages/pages-viz/src/charts/PagesPieChart.ts:23`
- Modify: `packages/pages-viz/src/charts/PagesScatterChart.ts:24`
- Modify: `packages/pages-viz/src/charts/PagesBubbleChart.ts:26`
- Modify: `packages/pages-viz/src/charts/PagesTimeseries.ts:26`
- Modify: `packages/pages-viz/src/charts/PagesMap.ts:68`
- Modify: `packages/pages-viz/src/components/PagesMetric.ts:56`
- Modify: `packages/pages-viz/src/components/PagesTable.ts:688,777`
- Modify: `ARC42STORIES.MD`

**Interfaces:**
- Consumes: `compileOrCached()` from `@casehubio/pages-data/dist/expression/jsonata-bridge.js`
- Produces: `applyCellExpression(raw, expression): Promise<string | number | Date | null>` (was sync), `datasetToSource(dataset, propsColumns?): Promise<(string | number | Date | null)[][]>` (was sync)

- [ ] **Step 1: Write failing tests for async applyCellExpression**

In `packages/pages-viz/src/base/cell-extract.test.ts`, add after the existing tests:

```typescript
import { applyCellExpression, resolveColumnExpression } from "./cell-extract.js";

describe("applyCellExpression", () => {
  it("returns null for null input", async () => {
    expect(await applyCellExpression(null, "value * 2")).toBeNull();
  });

  it("evaluates arithmetic expression", async () => {
    expect(await applyCellExpression(10, "value * 2")).toBe(20);
  });

  it("preserves number type", async () => {
    const result = await applyCellExpression(42, "value + 1");
    expect(result).toBe(43);
    expect(typeof result).toBe("number");
  });

  it("evaluates string function", async () => {
    expect(await applyCellExpression("hello", "$uppercase(value)")).toBe("HELLO");
  });

  it("evaluates $round", async () => {
    expect(await applyCellExpression(3.7, "$round(value)")).toBe(4);
  });

  it("evaluates $formatNumber", async () => {
    expect(await applyCellExpression(3.14159, '$formatNumber(value, "0.00")')).toBe("3.14");
  });

  it("evaluates ternary conditional", async () => {
    expect(await applyCellExpression(150, 'value > 100 ? "high" : "low"')).toBe("high");
    expect(await applyCellExpression(50, 'value > 100 ? "high" : "low"')).toBe("low");
  });

  it("evaluates $replace", async () => {
    expect(await applyCellExpression("hello world", '$replace(value, "world", "there")')).toBe("hello there");
  });

  it("evaluates $substring", async () => {
    expect(await applyCellExpression("2024-01-15T12:00:00Z", "$substring(value, 0, 10)")).toBe("2024-01-15");
  });

  it("evaluates $floor for integer conversion", async () => {
    expect(await applyCellExpression(2048, "$floor(value / 1024)")).toBe(2);
  });

  it("evaluates string concatenation with &", async () => {
    expect(await applyCellExpression(42, 'value & " MB"')).toBe("42 MB");
  });

  it("falls back to raw value on syntax error", async () => {
    expect(await applyCellExpression(42, "invalid syntax !!!")).toBe(42);
  });

  it("falls back to raw value on evaluation error", async () => {
    expect(await applyCellExpression("text", "$floor(value)")).toBe("text");
  });

  it("coerces boolean to string", async () => {
    expect(await applyCellExpression(5, "value > 3")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/pages-viz run test -- --run src/base/cell-extract.test.ts`

Expected: FAIL — `applyCellExpression` is synchronous, tests call with `await`

- [ ] **Step 3: Replace cell-extract.ts**

Replace the full contents of `packages/pages-viz/src/base/cell-extract.ts`:

```typescript
import type { CellValue, Column, ColumnSettings } from "@casehubio/pages-data/dist/dataset/types.js";
import { compileOrCached } from "@casehubio/pages-data/dist/expression/jsonata-bridge.js";

export function cellToRaw(cell: CellValue): string | number | Date | null {
  if (cell.type === "NULL") return null;
  return cell.value;
}

export function resolveColumnName(
  column: Column,
  propsColumns?: readonly ColumnSettings[],
): string {
  const override = propsColumns?.find((c) => c.id === column.id);
  return override?.name ?? column.settings?.name ?? column.name;
}

export async function applyCellExpression(
  raw: string | number | Date | null,
  expression: string,
): Promise<string | number | Date | null> {
  if (raw === null) return null;
  try {
    const compiled = compileOrCached(expression);
    const result: unknown = await compiled.evaluate({ value: raw });
    if (result === undefined || result === null) return null;
    if (typeof result === "number") return result;
    if (result instanceof Date) return result;
    if (typeof result === "string") return result;
    if (typeof result === "boolean") return String(result);
    return null;
  } catch {
    return raw;
  }
}

export function resolveColumnExpression(
  columnId: string,
  propsColumns?: readonly ColumnSettings[],
): string | undefined {
  return propsColumns?.find((c) => c.id === columnId)?.expression;
}
```

- [ ] **Step 4: Run cell-extract tests**

Run: `yarn workspace @casehubio/pages-viz run test -- --run src/base/cell-extract.test.ts`

Expected: ALL PASS

- [ ] **Step 5: Make datasetToSource async**

Replace `packages/pages-viz/src/charts/option-pipeline.ts` function `datasetToSource`:

```typescript
export async function datasetToSource(
  dataset: TypedDataSet,
  propsColumns?: readonly ColumnSettings[],
): Promise<(string | number | Date | null)[][]> {
  const expressions = dataset.columns.map((c) => resolveColumnExpression(c.id, propsColumns));
  const dataRows = await Promise.all(
    dataset.rows.map(async (row) =>
      Promise.all(
        dataset.columns.map(async (c, i) => {
          const cell = row.cells[i];
          if (!cell) return null;
          const raw = cellToRaw(cell);
          return expressions[i] ? applyCellExpression(raw, expressions[i]) : raw;
        }),
      ),
    ),
  );
  return [
    dataset.columns.map((c) => resolveColumnName(c, propsColumns)),
    ...dataRows,
  ];
}
```

Update the export in `packages/pages-viz/src/index.ts` — no change needed (re-export works for async).

- [ ] **Step 6: Update option-pipeline.test.ts for async**

In `packages/pages-viz/src/charts/option-pipeline.test.ts`, update every `datasetToSource` call to use `await`:

Every `const result = datasetToSource(...)` becomes `const result = await datasetToSource(...)`.
Every `expect(result[0]).toEqual(...)` stays the same.
Every `it(` block callback that uses `datasetToSource` needs the `async` keyword.

- [ ] **Step 7: Make PagesChartElement.buildOption async**

In `packages/pages-viz/src/base/PagesChartElement.ts`:

Change the abstract method (line 84-87):
```typescript
  abstract buildOption(
    props: P,
    dataset: TypedDataSet,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
```

Change `render` (line 91-103) to handle async buildOption:
```typescript
  private _renderGen = 0;

  protected override render(
    container: HTMLDivElement,
    props: P,
    dataset: TypedDataSet,
  ): void {
    const gen = ++this._renderGen;
    const chart = this.ensureChart(container);
    const result = this.buildOption(props, dataset);

    const apply = (option: Record<string, unknown>): void => {
      if (this._renderGen !== gen) return;
      chart.setOption(option, true);
      if (this._selectedValue !== undefined && this._selectedDataIndex !== undefined) {
        this.syncHighlight(chart, undefined, this._selectedDataIndex);
      }
    };

    if (result instanceof Promise) {
      void result.then(apply);
    } else {
      apply(result);
    }
  }
```

- [ ] **Step 8: Update all 8 chart components**

In each chart component, add `async` to `buildOption` and `await` to `datasetToSource`:

**PagesBarChart.ts** — change `override buildOption(` to `override async buildOption(` and `const source = datasetToSource(` to `const source = await datasetToSource(`

**PagesLineChart.ts** — same pattern
**PagesAreaChart.ts** — same pattern
**PagesPieChart.ts** — same pattern
**PagesScatterChart.ts** — same pattern
**PagesBubbleChart.ts** — same pattern
**PagesTimeseries.ts** — same pattern
**PagesMap.ts** — same pattern

- [ ] **Step 9: Update PagesMetric for async applyCellExpression**

In `packages/pages-viz/src/components/PagesMetric.ts`, the `render` method (line 36) needs to handle async expression evaluation. Change:

```typescript
  protected override render(
    container: HTMLDivElement,
    props: MetricProps,
    dataset: TypedDataSet,
  ): void {
```

The expression evaluation happens at line 56: `if (expr) raw = applyCellExpression(raw, expr);`

Since `render` is called from the sync `update()` method, use the fire-and-forget pattern:

Extract the expression evaluation into an async helper. Replace the `render` method to handle this:

At line 55-56, replace:
```typescript
    const expr = resolveColumnExpression(colId, props.columns);
    if (expr) raw = applyCellExpression(raw, expr);
    const value = raw === null ? "" : String(raw);
```

With:
```typescript
    const expr = resolveColumnExpression(colId, props.columns);
    if (expr) {
      void applyCellExpression(raw, expr).then(result => {
        this.renderWithValue(container, props, dataset, result === null ? "" : String(result));
      });
      return;
    }
    const value = raw === null ? "" : String(raw);
```

And extract the rendering logic below into a `renderWithValue` method.

- [ ] **Step 10: Update PagesTable for async applyCellExpression**

In `packages/pages-viz/src/components/PagesTable.ts`, lines 688 and 777 use `applyCellExpression`. These are inside cell rendering loops. Wrap each in an async IIFE that updates the cell content after resolution:

At line 688: `if (expr) raw = applyCellExpression(raw, expr);`
Change to:
```typescript
    if (expr) {
      void applyCellExpression(raw, expr).then(result => {
        td.textContent = result === null ? "" : String(result);
      });
    }
```

Apply the same pattern at line 777.

- [ ] **Step 11: Update ARC42STORIES.MD**

Update `ARC42STORIES.MD` per the spec:

**§8 Crosscutting Concepts** — find the column expressions row and update:
```
| Column expressions | `cell-extract.ts` evaluates per-cell expressions via JSONata (`compileOrCached` from `jsonata-bridge.ts`). Sandboxed AST evaluation, CSP-safe. Replaces `new Function()` (#16) |
```

**§12 Risks and Technical Debt** — find the `new Function()` row and update:
```
| ~~`new Function()` requires CSP `unsafe-eval`~~ | Resolved (#16) | Column expressions migrated to JSONata AST evaluation. No `unsafe-eval` required |
```

- [ ] **Step 12: Run full viz test suite**

Run: `yarn workspace @casehubio/pages-viz run test`

Expected: ALL PASS

- [ ] **Step 13: Run full build**

Run: `yarn build:packages`

Expected: BUILD SUCCESS — no type errors

- [ ] **Step 14: Commit**

```
git add packages/pages-viz/ ARC42STORIES.MD
git commit -m "fix: replace new Function() with JSONata for CSP compliance (#16)

applyCellExpression now uses compileOrCached() from jsonata-bridge.ts
instead of new Function(). datasetToSource becomes async. All chart
components, PagesTable, and PagesMetric updated for async expressions.
Expression syntax changes from JavaScript to JSONata (breaking change).

Closes #16"
```

- [ ] **Step 15: Update example YAML files**

Scan all `.yaml` files in `examples/` for column expressions using JavaScript syntax. For each file with a `columns:` section containing `expression:` values, convert from JavaScript to JSONata using the conversion table in the spec. Common patterns:

- `value.replace(...)` → `$replace(value, ...)`
- `value.split(",")[0]` → `$split(value, ",")[0]`
- `value.substring(0, N)` → `$substring(value, 0, N)`
- `parseInt(value / N)` → `$floor(value / N)`
- `value + " suffix"` → `value & " suffix"`

Run: `grep -rn "expression:" examples/ --include="*.yaml" --include="*.yml"`

Update each file, then commit:

```
git add examples/
git commit -m "chore: migrate example YAML expressions from JavaScript to JSONata (#16)

Updates column expressions in example dashboards to use JSONata
syntax following the new Function() → JSONata migration.

Refs #16"
```
