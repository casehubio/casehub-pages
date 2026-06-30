# Push Source Abstraction — Design Spec

**Date:** 2026-06-30
**Branch:** issue-81-trailing-s-xs-batch
**Covers:** #81, #82, #83, #72, #73, #74, #63, #70, #71

## Problem

The data pipeline was designed for pull (HTTP) sources. Push sources (WebSocket) were added as a special case hardcoded in `data-pipeline.ts:237-258` — no abstract push source, no error channel, no lifecycle management. Adding SSE as another special case would compound the problem.

Three issues share a root cause: the absence of a `PushSource` abstraction.

- **#70 Error propagation:** `DataSetEventListener = (event: DataSetEvent) => void` has no error channel. When a WebSocket connection permanently fails (auth expired, server-rejected 4000+), there is no mechanism to notify consuming components. Components display stale data indefinitely.
- **#71 Subscription lifecycle:** `subscribe()` is called in `handleDataRequest()` but `unsubscribe()` is never called except via `releaseAll()` in `dispose()`. There is no component unmount detection.
- **#74 SSE source type:** Without a shared abstraction, SSE would duplicate the entire WebSocket pattern — subscribe/unsubscribe, message processing, error handling, pool management.

Six remaining issues are either trivial wiring (#81, #82) or documentation (#83, #73, #63) plus test gaps (#72).

## Design

### §1 PushSource Interface

New file: `packages/pages-data/src/dataset/external/sources/push-source.ts`

```typescript
export interface PushSourceError {
  readonly message: string;
  readonly permanent: boolean;
}

export interface PushSource {
  /**
   * Register a listener for dataset events from this source.
   * MAY send upstream communication (WebSocket sends a subscribe message;
   * SSE is receive-only — no upstream message possible).
   * Implementations that support upstream communication re-subscribe
   * automatically on reconnection.
   */
  subscribe(
    dataSetId: DataSetId,
    def: ExternalDataSetDef,
    listener: DataSetEventListener,
    onError: (error: PushSourceError) => void,
  ): void;
  unsubscribe(dataSetId: DataSetId): void;
  close(): void;
}

export interface PushSourceConfig {
  readonly relay?: { readonly endpoint: string };
  readonly auth?: { readonly type: "query-param"; readonly paramName?: string; readonly token: string };
  readonly eventTarget?: HTMLElement;
}
```

**Decisions:**

- `onError` is required. Every push subscription must handle errors explicitly.
- `permanent: boolean` distinguishes transient (reconnecting, corrupt message) from fatal (auth expired, server-rejected 4000+). The pipeline sets `target.error` only on permanent errors.
- Error is a separate callback, not a `DataSetEvent` variant. Data events mutate datasets (`manager.apply`). Errors signal source health (`target.error`). They go to different consumers — mixing them into one union forces every consumer to filter out a case that doesn't apply.

### §2 WebSocketSource Refactoring

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

- Remove `WebSocketSource` interface — callers use `PushSource` from §1.
- Remove `WebSocketSourceConfig` — replaced by `PushSourceConfig`.
- `subscribe` signature gains required `onError` callback. Stored per-subscription:

```typescript
interface Subscription {
  readonly def: ExternalDataSetDef;
  readonly listener: DataSetEventListener;
  readonly onError: (error: PushSourceError) => void;
}
```

- `handleClose` classifies close codes into three tiers:

```typescript
function handleClose(code: number, reason: string): void {
  if (shouldReconnect(code) && subscriptions.size > 0) {
    // existing backoff logic — no error emitted
  } else if (code >= 4000 && subscriptions.size > 0) {
    // Application errors: permanent, propagate to components
    const message = `Application error (${code}): ${reason}`;
    for (const sub of subscriptions.values()) {
      sub.onError({ message, permanent: true });
    }
  } else if (code >= 1002 && code <= 1015) {
    // Protocol errors (1002, 1003, etc.): bugs, log for developers
    console.warn(`[WebSocketSource] Protocol error (${code}): ${reason}`);
  }
  // Code 1000 (Normal Closure): server closed intentionally — silent
}
```

- `processMessage` try/catch logs AND emits transient error:

```typescript
} catch (error) {
  console.warn("[WebSocketSource] Error processing message:", error);
  const sub = subscriptions.get(dataSetId);
  sub?.onError({
    message: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
    permanent: false,
  });
}
```

- `WebSocketPool.acquire` returns `PushSource` instead of `WebSocketSource`.

**Tests (in `websocket-source.test.ts`):**

1. Append validation warning includes actual cell count (production + test).
2. Relay target with existing query params — assert original query string preserved.
3. Auth test asserts base URL hostname/pathname unchanged.
4. Seq tracking for replace/remove — reconnect sends correct `since`.
5. Auth + reconnect and relay + reconnect interactions — `buildConnectionUrl()` called on every `connect()`.
6. Permanent close (code 4001) emits `onError({ permanent: true })` to all subscribers.
7. Reconnectable close (code 1006) does NOT emit `onError`.
8. `processMessage` error emits `onError({ permanent: false })` AND logs console.warn.
9. Normal close (1000) with no subscribers does not emit.
10. Protocol error close (1002) logs warning, does not emit `onError`.

### §3 Shared Wire Message Processing

Extract `processWireMessage` from WebSocketSource into `push-source.ts`. Both WebSocket and SSE sources call the same function — eliminates ~100 lines of duplication.

```typescript
export function processWireMessage(
  msg: WireMessage,
  subscriptions: Map<DataSetId, Subscription>,
  wireNameToId: Map<string, DataSetId>,
  config?: PushSourceConfig,
  updateSeq?: (seq: string) => void,
): void { ... }
```

The `WireMessage` type and `Subscription` type (including the `onError` field from §2) move to `push-source.ts` as shared types.

`updateSeq` is optional. WebSocket passes a callback that tracks `lastSeq` for reconnection (sends `since` parameter). SSE passes `undefined` — the browser handles reconnection natively via the `Last-Event-ID` header, so application-level seq tracking is unnecessary.

### §4 SSE Source

New file: `packages/pages-data/src/dataset/external/sources/sse-source.ts`

Implements `PushSource` using the browser's `EventSource` API. Same wire message format as WebSocket.

**URL scheme:** `sse://` / `sses://` in dataset definitions, converted to `http://` / `https://` for `EventSource` construction:

```typescript
function sseSchemeToHttp(url: string): string {
  if (url.startsWith("sses://")) return "https://" + url.slice(7);
  if (url.startsWith("sse://")) return "http://" + url.slice(6);
  return url;
}
```

**Auth URL construction:**

```typescript
function buildSseUrl(baseUrl: string, config?: PushSourceConfig): string {
  const url = new URL(sseSchemeToHttp(baseUrl));
  if (config?.auth?.type === "query-param") {
    url.searchParams.set(config.auth.paramName ?? "token", config.auth.token);
  }
  return url.toString();
}
```

**Dual-mode message reception:**

1. Named SSE events (idiomatic) — `event: snapshot`, `event: append`, etc. map directly to op types.
2. Unnamed events (WebSocket-compatible) — JSON data contains the `op` field.

Each listener wraps `JSON.parse` in try/catch — `processWireMessage` receives already-parsed objects and cannot catch parse errors at the caller boundary.

```typescript
for (const op of ["snapshot", "append", "replace", "remove", "event"]) {
  es.addEventListener(op, (e: MessageEvent) => {
    let parsed: unknown;
    try { parsed = JSON.parse(e.data); } catch {
      console.warn("[SseSource] Failed to parse SSE event data:", e.data);
      return;
    }
    processWireMessage({ ...(parsed as WireMessage), op }, subscriptions, wireNameToId, config);
  });
}
es.addEventListener("message", (e: MessageEvent) => {
  let parsed: unknown;
  try { parsed = JSON.parse(e.data); } catch {
    console.warn("[SseSource] Failed to parse SSE message data:", e.data);
    return;
  }
  processWireMessage(parsed as WireMessage, subscriptions, wireNameToId, config);
});
```

Note: SSE does not pass `updateSeq` to `processWireMessage`. The browser handles reconnection natively via the `Last-Event-ID` header — application-level seq tracking is unnecessary for SSE.

**Reconnection:** Built-in to `EventSource`. Browser sends `Last-Event-ID` header on reconnect. Maps to seq tracking — SSE `id` field updates `lastSeq`.

**Error handling:**

```typescript
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) {
    for (const sub of subscriptions.values()) {
      sub.onError({ message: "SSE connection closed permanently", permanent: true });
    }
  }
};
```

**Network failure limitation:** The EventSource API only transitions to `CLOSED` readyState for HTTP-level failures (non-200 status, wrong content-type, explicit `close()`). Network-level failures (DNS, connection refused, TLS errors) leave `readyState === CONNECTING` with indefinite automatic reconnection — the browser never gives up and never signals a permanent failure. This is an API limitation, not a design gap. The SSE source detects HTTP-level permanent failures (auth rejection, server misconfiguration) and relies on the browser's built-in reconnection for transient network issues. Consumers should be aware that SSE error propagation covers HTTP errors but not network-level permanent failures.

**DataProviderConfig extension:**

```typescript
readonly sse?: {
  readonly auth?: { readonly type: "query-param"; readonly paramName?: string; readonly token: string };
};
```

No relay for SSE — standard HTTP, proxies work naturally.

**Schema validation (schema.ts):** Extend the Zod refinement that rejects `refreshTime` on push source URLs to include SSE schemes:

```typescript
d => !d.refreshTime || (
  (d.url !== undefined
    && !d.url.startsWith("ws://") && !d.url.startsWith("wss://")
    && !d.url.startsWith("sse://") && !d.url.startsWith("sses://"))
  || (d.content !== undefined && d.expression !== undefined && d.accumulate === true)
),
{ message: "refreshTime requires a non-push-source url, or content + expression + accumulate" },
```

**Tests (in `sse-source.test.ts`):**

1. Named SSE events dispatch correctly (snapshot, append, replace, remove, event).
2. Unnamed events (WebSocket-compatible format) dispatch correctly.
3. URL scheme conversion (sse:// → http://, sses:// → https://).
4. Auth query param appended to EventSource URL via `buildSseUrl`.
5. Permanent close (readyState CLOSED) emits `onError({ permanent: true })`.
6. Auto-reconnect (readyState CONNECTING on error) does not emit error.
7. Subscribe/unsubscribe lifecycle — last unsubscribe closes EventSource.
8. Malformed JSON in SSE event data logs warning, does not throw.

### §4a Generic Push Pool

New file: `packages/pages-data/src/dataset/external/sources/push-pool.ts`

Both WebSocket and SSE pools implement an identical pattern: `Map<string, PushSource>` + `configure(config)` + `acquire(baseUrl)` + `releaseAll()`. The only difference is the factory function. Extract a generic pool factory:

```typescript
export interface PushPool {
  configure(config: PushSourceConfig): void;
  acquire(baseUrl: string): PushSource;
  releaseAll(): void;
}

export function createPushPool(
  factory: (baseUrl: string, config?: PushSourceConfig) => PushSource,
): PushPool {
  const sources = new Map<string, PushSource>();
  let config: PushSourceConfig | undefined;
  return {
    configure(cfg: PushSourceConfig): void { config = cfg; },
    acquire(baseUrl: string): PushSource {
      let source = sources.get(baseUrl);
      if (!source) {
        source = factory(baseUrl, config);
        sources.set(baseUrl, source);
      }
      return source;
    },
    releaseAll(): void {
      for (const source of sources.values()) source.close();
      sources.clear();
    },
  };
}
```

Usage in data-pipeline.ts:
```typescript
const wsPool = createPushPool((url, cfg) => createWebSocketSource(url, cfg, WebSocket));
const ssePool = createPushPool((url, cfg) => createSseSource(url, cfg));
```

`websocket-pool.ts` is deleted. `WebSocketPool` type is replaced by `PushPool`.

### §5 DataPipeline Encapsulation

File: `packages/pages-runtime/src/data-pipeline.ts`

**Interface change:**

```typescript
export interface DataPipeline {
  handleDataRequest(target: VizTarget, lookup: DataSetLookup, componentId: string): void;
  setResolverCtx(ctx: ResolverContext): void;
  dispose(): void;
}
```

`pendingResolutions`, `refreshTimers`, and `pool` removed from public interface. Cleanup encapsulated in `dispose()`.

**New internal state:**

```typescript
const pushSubscriptions = new Map<DataSetId, PushSource>();
const pushSubscribers = new Map<DataSetId, Set<string>>();
```

**scheduleRefresh guard:** Extend the existing WebSocket guard to include SSE (defense-in-depth alongside schema validation):

```typescript
if (def.url?.startsWith("ws://") || def.url?.startsWith("wss://")
    || def.url?.startsWith("sse://") || def.url?.startsWith("sses://")) return;
```

**Generalized push source routing:**

```typescript
function acquirePushSource(def: ExternalDataSetDef): PushSource | undefined {
  const url = def.url;
  if (!url) return undefined;
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    const baseUrl = new URL(url);
    baseUrl.search = "";
    return wsPool.acquire(baseUrl.toString());
  }
  if (url.startsWith("sse://") || url.startsWith("sses://")) {
    const baseUrl = new URL(url);
    baseUrl.search = "";
    return ssePool.acquire(baseUrl.toString());
  }
  return undefined;
}
```

**Push source subscription with subscriber tracking:**

```typescript
function subscribePushSource(
  lookup: DataSetLookup,
  def: ExternalDataSetDef,
  componentId: string,
): void {
  const source = acquirePushSource(def);
  if (!source) return;

  // Track this component as a subscriber
  let subscribers = pushSubscribers.get(lookup.dataSetId);
  if (!subscribers) {
    subscribers = new Set();
    pushSubscribers.set(lookup.dataSetId, subscribers);
  }
  subscribers.add(componentId);

  // Only subscribe to the source once per dataset
  if (pushSubscriptions.has(lookup.dataSetId)) return;
  pushSubscriptions.set(lookup.dataSetId, source);

  source.subscribe(
    lookup.dataSetId, def,
    (event: DataSetEvent) => {
      manager.apply(lookup.dataSetId, event);
      for (const [compId, compEntry] of registry) {
        if (compEntry.originalLookup?.dataSetId === lookup.dataSetId && compEntry.vizElement) {
          const fg = (compEntry.component.props as Record<string, unknown> | undefined)
            ?.filter as { group?: string } | undefined;
          pushData(compEntry.vizElement, compEntry.originalLookup, compEntry.pagePath, fg?.group, compId);
        }
      }
    },
    (error: PushSourceError) => {
      if (!error.permanent) {
        console.warn(`[DataPipeline] Transient push error for ${String(lookup.dataSetId)}: ${error.message}`);
        return;
      }
      for (const [, compEntry] of registry) {
        if (compEntry.originalLookup?.dataSetId === lookup.dataSetId && compEntry.vizElement) {
          compEntry.vizElement.error = error.message;
        }
      }
    },
  );
}
```

The early-return path (dataset already in manager) handles three cases: existing push subscription (track subscriber), cleaned-up push subscription (re-subscribe), and non-push datasets (schedule refresh only):

```typescript
if (manager.has(lookup.dataSetId)) {
  pushData(target, lookup, entry.pagePath, filterGroup?.group, componentId);
  const def = resolveDataSetDef(lookup.dataSetId, entry.pagePath, scope);
  if (def) {
    if (pushSubscriptions.has(lookup.dataSetId)) {
      // Existing push subscription — just track this component
      let subscribers = pushSubscribers.get(lookup.dataSetId);
      if (!subscribers) { subscribers = new Set(); pushSubscribers.set(lookup.dataSetId, subscribers); }
      subscribers.add(componentId);
    } else if (acquirePushSource(def)) {
      // Push dataset whose subscription was cleaned up by MutationObserver — re-subscribe
      subscribePushSource(lookup, def, componentId);
    }
    scheduleRefresh(def, lookup.dataSetId);
  }
  return;
}
```

**eventTarget injection in setResolverCtx:**

```typescript
setResolverCtx(ctx: ResolverContext): void {
  resolverCtx = ctx;
  wsPool.configure({ ...ctx.providerConfig.webSocket, eventTarget: target });
  ssePool.configure({ ...ctx.providerConfig.sse, eventTarget: target });
}
```

`eventTarget` stays out of `DataProviderConfig` (user-facing config). The pipeline injects it internally from the `target` element. This resolves #81.

**`dispose()` implementation:**

```typescript
dispose(): void {
  // Disconnect MutationObserver before DOM teardown
  if (observer) {
    observer.disconnect();
    observer = undefined;
  }
  // Clear all refresh timers
  for (const timer of refreshTimers.values()) {
    clearInterval(timer);
  }
  refreshTimers.clear();
  // Unsubscribe all push sources and release pools
  for (const [dataSetId, source] of pushSubscriptions) {
    source.unsubscribe(dataSetId);
  }
  pushSubscriptions.clear();
  pushSubscribers.clear();
  wsPool.releaseAll();
  ssePool.releaseAll();
  // Abort pending HTTP resolutions
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();
  pendingResolutions.clear();
}
```

`site.ts:dispose()` replaces direct field access with `pipeline.dispose()`:

```typescript
dispose(): void {
  abortController.abort();
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
  pipeline.dispose();
  for (const timer of saveTimers.values()) {
    clearTimeout(timer);
  }
  saveTimers.clear();
  const sentinels = document.querySelectorAll("[data-param-dataset]");
  for (const sentinel of sentinels) {
    sentinel.remove();
  }
  componentViewState.clear();
  registry.clear();
  target.innerHTML = "";
}
```

**createDataPipeline signature gains `target`:**

```typescript
export function createDataPipeline(
  manager: DataSetManager,
  scope: DataSetScope,
  registry: ComponentRegistry,
  filterState: FilterState,
  dataScopeRegistry: DataScopeRegistry,
  componentViewState: ComponentViewState,
  contextManager?: ContextManager,
  target?: HTMLElement,
): DataPipeline
```

### §6 Subscription Lifecycle via MutationObserver

Internal to `createDataPipeline`. No changes to `PagesElement` or `pages-viz`.

**Why MutationObserver:** When an element is disconnected, it can't dispatch bubbling events (no parent). Dispatching on `document` loses natural scoping to the target element. MutationObserver is scoped, requires zero viz-layer changes, and the runtime controls its own lifecycle.

```typescript
let observer: MutationObserver | undefined;

if (target) {
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        handleSubtreeRemoved(node);
      }
    }
  });
  observer.observe(target, { childList: true, subtree: true });
}

function handleSubtreeRemoved(removed: HTMLElement): void {
  const affected: Array<[string, HTMLElement]> = [];
  for (const [componentId, entry] of registry) {
    const el = entry.vizElement as unknown as HTMLElement | undefined;
    if (!el) continue;
    if (removed !== el && !removed.contains(el)) continue;
    affected.push([componentId, el]);
  }

  if (affected.length === 0) return;

  // Defer — element might be reattached (DOM move)
  queueMicrotask(() => {
    for (const [componentId, el] of affected) {
      if (el.isConnected) continue;
      cleanupComponentSubscriptions(componentId);
    }
  });
}

function cleanupComponentSubscriptions(componentId: string): void {
  for (const [dataSetId, subscribers] of pushSubscribers) {
    if (!subscribers.has(componentId)) continue;
    subscribers.delete(componentId);
    if (subscribers.size === 0) {
      const source = pushSubscriptions.get(dataSetId);
      if (source) {
        source.unsubscribe(dataSetId);
        pushSubscriptions.delete(dataSetId);
      }
      pushSubscribers.delete(dataSetId);
    }
  }
}
```

**Edge cases:**

- `dispose()` disconnects the observer before `target.innerHTML = ""`. No spurious cleanup during teardown.
- DOM moves (detach + reattach): `queueMicrotask` defers the check. If `el.isConnected` by the time the microtask runs, the component was moved, not removed.

### §7 Runtime Event Listener (#82)

In `site.ts`, alongside existing event listeners:

```typescript
target.addEventListener("pages-event", ((e: Event) => {
  const { topic, payload } = (e as CustomEvent<{ topic: string; payload: unknown }>).detail;
  console.debug("[pages-event]", topic, payload);
}), { signal: abortController.signal });
```

Debug-level logging for push source events. `console.debug` is filtered out by default in production browsers but provides observability during development. Middleware (topic routing, rate limiting) can replace the body without touching registration.

### §8 Test Coverage Summary (#72)

Tests are distributed to their corresponding sections (§2, §4) rather than collected as a separate phase. Each section's test plan is implemented alongside the code it covers.

Total new tests: 18 (10 WebSocket in §2, 8 SSE in §4).

### §9 Documentation

**#83 — ARC42STORIES.MD and CASEHUB-PAGES.MD updates**

Apply workbench primitives checklist from the existing spec, plus PushSource abstraction additions:

- ARC42STORIES.MD: §1, §3, §4, §5, §6, §10, §13 — workbench primitives + PushSource + SSE + error propagation + lifecycle management.
- CASEHUB-PAGES.MD: workbench primitives section, registerPanel API, PushSource interface, SSE source type, error propagation model.

**#73 — WebSocket/SSE section in CASEHUB-PAGES.MD**

New section covering:
- WebSocket dataset declaration (ws:// / wss://)
- SSE dataset declaration (sse:// / sses://)
- Wire protocol contract (message format, op types, seq field)
- DataProviderConfig.webSocket and DataProviderConfig.sse
- Incremental reconnect behavior
- Error propagation model

**#63 — Web Architecture document (docs/WEB.md)**

Frontend-tier equivalent of PLATFORM.md:
- Tier position in CaseHub platform hierarchy
- Package architecture (monorepo structure, dependency graph)
- Data flow pipeline (YAML → parse → resolve → layout → render)
- Push source architecture (PushSource interface, pools, lifecycle)
- Event system catalog
- Component model (PagesElement, activation, registry)

Scoped to casehub-pages. References CASEHUB-PAGES.MD for API details.

## Implementation Order

1. **#81 + #82** — Event wiring (XS). Trivial, immediate value.
2. **§1 PushSource interface + §4a Generic push pool** — Foundation types.
3. **§3 Shared processWireMessage** — Extract before refactoring WebSocketSource.
4. **§2 WebSocketSource refactoring + tests** — Implement PushSource, add onError, close code tiers. Tests 1-10 alongside.
5. **§5 DataPipeline encapsulation** — dispose(), push source routing, error propagation, pushSubscribers tracking, eventTarget injection.
6. **§6 MutationObserver lifecycle** — Subscription cleanup on component removal.
7. **§4 SSE source + tests** — Implements PushSource, uses shared processWireMessage, auth URL construction. Tests 1-8 alongside.
8. **§9 Documentation** — #83, #73, #63 reflect final state.

## Breaking Changes

- `DataPipeline` interface: `pool`, `pendingResolutions`, `refreshTimers` removed. `dispose()` added.
- `WebSocketSource` type removed from exports. Callers use `PushSource`.
- `WebSocketSourceConfig` type removed. Callers use `PushSourceConfig`.
- `WebSocketPool` type removed. Replaced by generic `PushPool` from `push-pool.ts`.
- `websocket-pool.ts` deleted. Pool creation via `createPushPool` factory.
- `createWebSocketSource` return type changes to `PushSource`.
- `createDataPipeline` signature gains `target?: HTMLElement` parameter.

All callers are internal to the monorepo. No external consumers.

## After Implementation

- [ ] Update `packages/pages-data/src/dataset/external/index.ts` exports
- [ ] Update `packages/pages-runtime/src/index.ts` exports
- [ ] Run full type check: `yarn typecheck`
- [ ] Run full test suite: `yarn workspaces foreach -Apt run test`
- [ ] Run lint: `yarn lint`
