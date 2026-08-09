# WebSocket Robustness — Design Spec

**Date:** 2026-06-29
**Issues:** #61 (single-subscriber fallback), #62 (duplicate subscribe + append validation), #56 (incremental reconnect), #57 (server relay), #58 (authentication)
**Branch:** issue-56-websocket-robustness

## Problem

Five issues from the #52 WebSocket implementation review share a common scope: the WebSocket connection lifecycle. Two are bugs in existing code (#61, #62). Three are features that extend the connection model (#56, #58, #57). All five touch `websocket-source.ts`, `websocket-pool.ts`, or `data-pipeline.ts`.

### Bug fixes

1. **#61 — Single-subscriber fallback.** Messages without a `dataset` field are silently dropped. The spec (§4 of the reactive-dataset-events design) states they should route to the sole subscriber in the non-multiplexed case. Root cause: `processMessage()` looks up `wireNameToId.get(undefined)` which returns undefined, triggering the early-return guard.

2. **#62 — Two sub-issues:**
   - **Duplicate subscribe messages.** When `handleDataRequest` is called before the first snapshot arrives, `subscribe()` is called again for the same dataSetId. It overwrites the subscription (functionally benign) but sends a duplicate upstream subscribe message.
   - **Append schema validation.** The `apply()` append path in `manager.ts` concatenates rows unconditionally. If appended rows have a different cell count than the existing column schema, the dataset becomes silently inconsistent. Errors surface at render time, not mutation time.

### Features

3. **#56 — Incremental reconnect.** On reconnect, the server sends a full snapshot. For large datasets, this transfers unnecessary data. An optional `since` parameter on the subscribe message lets the server replay only events after the client's last known position.

4. **#58 — Authentication.** The browser WebSocket API does not support custom headers. Auth must use query parameters. Connection auth is a deployment concern (site-level config), not a per-dataset concern.

5. **#57 — Server relay.** In environments where the browser cannot connect directly to the WebSocket server (firewall, CORS, network segmentation), a backend proxy relays the connection. Equivalent to the existing HTTP `ServerRelayProvider` pattern.

## 1. DataProviderConfig Extension

File: `packages/pages-data/src/dataset/external/types.ts`

### New types

```typescript
interface WebSocketAuthConfig {
  readonly type: "query-param";
  readonly paramName?: string;  // defaults to "token"
  readonly token: string;
}
```

### DataProviderConfig change

```typescript
interface DataProviderConfig {
  readonly defaultProvider?: "browser" | "server-relay";
  readonly corsProxy?: { readonly url: string; readonly enabled: boolean };
  readonly serverRelay?: { readonly endpoint: string };
  readonly webSocket?: {
    readonly relay?: { readonly endpoint: string };
    readonly auth?: WebSocketAuthConfig;
  };
}
```

Auth and relay are deployment concerns — they apply to all WebSocket connections from the same site, not per-dataset. `DataProviderConfig` is the right home. The `webSocket` sub-object keeps HTTP and WebSocket config cleanly separated.

## 2. WireMessage Extension

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

```typescript
interface WireMessage {
  dataset?: string;
  type?: string;
  seq?: string;          // server-provided event sequence for incremental reconnect
  columns?: Column[];
  rows?: (string | null)[][];
  row?: (string | null)[];
  key?: string;
}
```

`seq` is a string, not a number — sequence values could be timestamps, UUIDs, or opaque cursors. The source stores and echoes them without parsing.

## 3. WebSocketSource Config

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

### New config interface

```typescript
interface WebSocketSourceConfig {
  readonly relay?: { readonly endpoint: string };
  readonly auth?: WebSocketAuthConfig;
}
```

### Signature change

```typescript
export function createWebSocketSource(
  baseUrl: string,
  config?: WebSocketSourceConfig,
  WSConstructor: typeof WebSocket = WebSocket,
): WebSocketSource
```

### Connection URL construction

New function inside the closure:

```typescript
function buildConnectionUrl(): string {
  let url = new URL(baseUrl);

  if (config?.relay) {
    url = new URL(config.relay.endpoint);
    url.searchParams.set("target", baseUrl);
  }

  if (config?.auth?.type === "query-param") {
    url.searchParams.set(config.auth.paramName ?? "token", config.auth.token);
  }

  return url.toString();
}
```

Uses the `URL` API for proper parameter handling — string concatenation breaks when the relay endpoint already contains query parameters. `URLSearchParams.set()` handles `?`/`&` separators correctly regardless of existing parameters.

Ordering: relay first (changes host/path), auth second (appends token to whichever endpoint we're connecting to). When using a relay, the token authenticates with the relay — the relay handles upstream auth via server-side config.

`connect()` changes to: `ws = new WSConstructor(buildConnectionUrl());`

### Signature migration

The `config` parameter is inserted between `baseUrl` and `WSConstructor`. This is a breaking change — all existing callsites that pass `WSConstructor` as the second argument must be updated:

- 14 test callsites in `websocket-source.test.ts`: `createWebSocketSource(url, MockWebSocket)` → `createWebSocketSource(url, undefined, MockWebSocket)`
- 1 callsite in `websocket-pool.ts`: `createWebSocketSource(baseUrl, WS)` → `createWebSocketSource(baseUrl, config, WS)`
- Pool test callsites via `createWebSocketPool(MockWebSocket)` are unaffected (pool signature unchanged)

TypeScript catches all of these at compile time.

## 4. WebSocketPool Config

File: `packages/pages-data/src/dataset/external/sources/websocket-pool.ts`

### Lazy configuration

The pool is created eagerly at pipeline construction, but `DataProviderConfig` arrives later via `setResolverCtx()`. The pool accepts config lazily via `configure()`:

```typescript
export interface WebSocketPool {
  configure(config: WebSocketSourceConfig): void;
  acquire(baseUrl: string): WebSocketSource;
  releaseAll(): void;
}

export function createWebSocketPool(
  WS: typeof WebSocket = WebSocket,
): WebSocketPool {
  const sources = new Map<string, WebSocketSource>();
  let config: WebSocketSourceConfig | undefined;

  return {
    configure(cfg: WebSocketSourceConfig): void {
      config = cfg;
    },

    acquire(baseUrl: string): WebSocketSource {
      let source = sources.get(baseUrl);
      if (source === undefined) {
        source = createWebSocketSource(baseUrl, config, WS);
        sources.set(baseUrl, source);
      }
      return source;
    },

    releaseAll(): void {
      for (const source of sources.values()) {
        source.close();
      }
      sources.clear();
    },
  };
}
```

Pool keying uses the original upstream `baseUrl`, not the relay-rewritten URL. Two datasets sharing the same upstream server share one connection, even through a relay.

### Pipeline integration

`data-pipeline.ts` `setResolverCtx` calls `pool.configure()`:

```typescript
setResolverCtx(ctx: ResolverContext): void {
  resolverCtx = ctx;
  if (ctx.providerConfig.webSocket) {
    pool.configure(ctx.providerConfig.webSocket);
  }
},
```

The `acquire()` call in `handleDataRequest` loses its second parameter (the pool no longer takes `def`):

```typescript
const source = pool.acquire(baseUrl.toString());
```

## 5. Bug Fix: Single-Subscriber Fallback (#61)

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

In `processMessage()`, when no `dataset` field is present and there is exactly one subscriber, fall back to that subscriber:

```typescript
function processMessage(msg: WireMessage): void {
  const wireName = msg.dataset;
  let dataSetId = wireName !== undefined ? wireNameToId.get(wireName) : undefined;

  if (dataSetId === undefined) {
    if (wireName === undefined && subscriptions.size === 1) {
      dataSetId = subscriptions.keys().next().value;
    } else {
      return;
    }
  }

  const subscription = subscriptions.get(dataSetId);
  // ... rest unchanged
}
```

The fallback is conditioned on `wireName === undefined` (message has no `dataset` field), NOT on lookup failure. A message with a `dataset` field that doesn't match any subscription is an unsubscribed broadcast — silent skip is correct. Conflating the two would route unsubscribed events to the wrong listener.

The explicit `wireName !== undefined` check (not truthy) treats empty string `""` as a present-but-empty field, not as absent. An empty `dataset` field is malformed, not "no dataset."

The `else return` covers: zero subscribers (nothing to route to), 2+ subscribers with no dataset field (ambiguous), and unrecognized dataset names (unsubscribed broadcast). All are silent drops.

## 6. Bug Fix: Duplicate Subscribe Guard (#62a)

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

Early-return in `subscribe()` when the dataSetId is already subscribed:

```typescript
subscribe(dataSetId, def, listener): void {
  if (subscriptions.has(dataSetId)) return;
  // ... existing code
}
```

The definition and listener are stable across re-renders — `resolveDataSetDef()` returns the same parsed definition, and duplicate listeners produce identical behavior. The guard prevents duplicate upstream subscribe messages.

## 7. Bug Fix: Append Column-Count Validation (#62b)

File: `packages/pages-data/src/dataset/manager.ts`

Reject the entire append event if any row has a column-count mismatch:

```typescript
case "append": {
  const existing = this.datasets.get(id);
  if (existing === undefined) return;
  const colCount = existing.columns.length;
  if (event.rows.some(row => row.cells.length !== colCount)) {
    console.warn(
      `[DataSetManager] append rejected: row cell count mismatch (expected ${String(colCount)})`,
    );
    return;
  }
  const combined = [...existing.rows, ...event.rows];
  const trimmed = event.maxRows !== undefined && event.maxRows >= 0
    ? combined.slice(-event.maxRows)
    : combined;
  const result: TypedDataSet = { columns: existing.columns, rows: trimmed };
  this.datasets.set(id, result);
  this.options?.onChanged?.(id, result);
  break;
}
```

Reject-all, not filter. A schema violation in one row means the event's data is suspect. Partial application of a corrupt event creates worse inconsistency than rejecting it.

## 8. Incremental Reconnect (#56)

File: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

### State tracking

Connection-scoped `lastSeq`:

```typescript
let lastSeq: string | undefined;
```

Updated in `processMessage()` inside each handled case branch, after a successful `subscription.listener()` call:

```typescript
case "snapshot": {
  // ... validation, tabulation ...
  subscription.listener({ type: "snapshot", dataset });
  if (msg.seq !== undefined) lastSeq = msg.seq;
  break;
}
case "append": {
  // ... validation, tabulation ...
  subscription.listener(event);
  if (msg.seq !== undefined) lastSeq = msg.seq;
  break;
}
// ... same for replace, remove
```

The update is NOT placed after the switch or after the try-catch. Placement matters:
- Inside each case after the listener: advances only on successful dispatch (correct)
- After the switch: would advance on `default` (unknown event type — incorrect, skips unprocessable events)
- After the try-catch: would advance even after listener errors (incorrect, loses events on error)

### Reconnect subscribe messages

In `ws.onopen`, include `since` when resubscribing after a reconnect:

```typescript
ws.onopen = () => {
  reconnectAttempt = 0;
  for (const [id] of subscriptions) {
    const wireName = idToWireName.get(id);
    if (wireName) {
      const msg: Record<string, string> = { type: "subscribe", dataset: wireName };
      if (lastSeq !== undefined) {
        msg.since = lastSeq;
      }
      ws?.send(JSON.stringify(msg));
    }
  }
};
```

### Why connection-scoped

Events from different datasets are interleaved on a multiplexed connection. A connection-level sequence reflects the server's event ordering across all datasets. Per-dataset sequences would require the server to maintain separate cursors per dataset — an assumption we shouldn't make.

### Server contract assumptions

ASSUMPTION: The server maintains a single monotonic event sequence across all datasets on a connection, not per-dataset sequences. The `since` value in a subscribe message refers to this global sequence.

ASSUMPTION: Server event sequences are persistent across connections and monotonically increasing. A `since` value from a prior connection is valid on a new connection to the same server.

ASSUMPTION: Servers that include `seq` on any event type SHOULD include it on all event types, including snapshots sent on reconnect. Inconsistent `seq` inclusion (e.g., present on append events but absent on snapshots) causes `lastSeq` to stall at the last event that included `seq`. If the server later stops including `seq` entirely, the stale `lastSeq` triggers duplicate event replay on reconnect.

The `since` value is sent per-subscribe (not as a connection-level handshake) for backwards compatibility — servers that don't understand `since` ignore it as an unknown field. A connection-level `resume` message would require explicit server support for a new message type.

### Graceful degradation

If the server never sends `seq`, `lastSeq` stays undefined, `since` is never included, and the server sends a full snapshot on reconnect — identical to current behavior. Zero breaking change.

### Reset semantics

- **`close()` resets `lastSeq`** — explicit close means the client is done; next use starts fresh.
- **`handleClose()` does NOT reset `lastSeq`** — reconnect needs the last position to resume.

## 9. WebSocket Authentication (#58)

### Mechanism

Query-parameter token, applied in `buildConnectionUrl()` (§3).

### Security considerations

Query-parameter tokens are visible in server access logs, proxy/CDN logs, and network debugging tools. This is an inherent limitation of the browser WebSocket API, which does not support custom headers.

Tokens used with query-parameter auth MUST be short-lived. Short-lived tokens are not just an optimization — they are a security necessity given query-parameter transport. The `token` field value should never be a long-lived secret.

### Token expiry

Handled by existing close-code policy. Server rejects expired tokens by closing with a 4000+ application code. The source does NOT reconnect on 4000+ — correct behavior. Token refresh is an application-tier concern (page reload after re-auth).

### Error visibility

When the server permanently closes the connection (4000+ close code), the source logs a warning but there is no mechanism to notify the consuming component. Components continue displaying stale data. This is a known limitation tracked in #70.

Note: HTTP data sources already have error propagation — the pipeline's `.catch()` sets `target.error`, which components can display. The gap is specific to push-based sources (WebSocket) where the `DataSetEventListener` interface has no error channel and the pipeline's WebSocket integration has no error callback after the initial subscribe.

### Configuration surface

`providerConfig.webSocket.auth` is set programmatically via `SiteOptions`, not parsed directly from YAML. The YAML examples below show the configuration structure for documentation; token values are provided by the host application at runtime.

```yaml
settings:
  providerConfig:
    webSocket:
      auth:
        type: query-param
        token: "short-lived-token-value"
```

Flows through `SiteOptions.providerConfig` → `DataProviderConfig.webSocket.auth` → pool → source.

## 10. WebSocket Server Relay (#57)

### Mechanism

URL rewriting in `buildConnectionUrl()` (§3). The relay is a transparent bidirectional WebSocket proxy.

### Relay protocol contract

A compliant relay server must:

1. Accept WebSocket connections at the configured endpoint
2. Read the `target` query parameter — the upstream WebSocket URL to proxy
3. Open a connection to the target
4. Forward all messages bidirectionally without modification
5. Forward close frames — when either side closes, close the other
6. Authenticate clients independently from upstream auth

### Config interaction with auth

When both relay and auth are configured, the auth token authenticates with the relay. The relay authenticates with the upstream via server-side config. Browser-side code never carries upstream credentials.

### Configuration surface

```yaml
settings:
  providerConfig:
    webSocket:
      relay:
        endpoint: "wss://backend.example.com/ws-relay"
      auth:
        type: query-param
        token: "short-lived-relay-token"
```

## 11. File Map

### Modified files

| File | Change |
|------|--------|
| `packages/pages-data/src/dataset/external/types.ts` | Add `WebSocketAuthConfig`, `webSocket` to `DataProviderConfig` |
| `packages/pages-data/src/dataset/external/sources/websocket-source.ts` | Add `WebSocketSourceConfig`, `buildConnectionUrl()`, `seq` tracking, single-subscriber fallback, duplicate subscribe guard |
| `packages/pages-data/src/dataset/external/sources/websocket-pool.ts` | Add `configure()`, remove `def` from `acquire()` |
| `packages/pages-data/src/dataset/manager.ts` | Append column-count validation |
| `packages/pages-runtime/src/data-pipeline.ts` | Pass config to pool via `configure()`, simplify `acquire()` call |
| `packages/pages-data/src/dataset/external/index.ts` | Export `WebSocketSourceConfig`, `WebSocketAuthConfig` |

### Test files

| File | Tests |
|------|-------|
| `websocket-source.test.ts` | Single-subscriber fallback, duplicate subscribe guard, seq tracking, auth URL, relay URL, combined relay+auth URL |
| `websocket-pool.test.ts` | configure() propagation, acquire after configure |
| `manager.test.ts` (or existing manager tests) | Append column-count rejection |

### Unchanged

- `schema.ts` — no new YAML fields on dataset definitions
- `resolver.ts` — no changes to resolve flow
- `provider-factory.ts` — WebSocket doesn't use providers
- `events.ts` — event model unchanged
- All existing providers, components, viz layer

## 12. Out of Scope

- **Token refresh** — application-tier concern, not transport-layer
- **WebSocket subprotocol auth** — niche, no demand
- **Cookie-based auth** — cross-origin limitations make this unreliable
- **Auth handshake protocol** — requires server cooperation; can be added as a new `WebSocketAuthConfig.type` later without design changes
- **Per-dataset auth** — all datasets on the same connection share auth; per-dataset overrides would require splitting connections, which contradicts the pool's multiplexing model
- **Relay server implementation** — this spec defines the client-side contract; the Quarkus relay endpoint is a separate concern
- **Error propagation for push sources** — #70 tracks extending the pipeline's error model to push-based sources. HTTP already propagates errors via `target.error`; the gap is WebSocket-specific (the `DataSetEventListener` has no error channel)
- **Subscription lifecycle management** — #71 tracks unsubscribe-on-unmount for component lifecycle. Current SPA architecture keeps all subscriptions alive until site disposal; this is intentional but should be revisited if page transition with unmounting is added
- **Web architecture document** — #63 tracks the broader need for a PLATFORM.md equivalent for the frontend tier
