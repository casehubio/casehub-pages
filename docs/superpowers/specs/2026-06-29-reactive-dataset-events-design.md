# Reactive Dataset Events — Design Spec

**Date:** 2026-06-29
**Issues:** #36 (accumulate + expression for inline datasets), #52 (WebSocket dataset provider), #53 (WebSocket multiplexing)
**Branch:** issue-36-accumulate-websocket-datasets

## Problem

Three independent issues share a common root: the data pipeline's mutation model is too narrow. The `DataSetManager` has two mutation methods — `register` (full replace) and `accumulate` (prepend + slice) — and the pipeline assumes all data flows through a request-response fetch cycle. This blocks:

1. **Expression generators (#36):** An inline dataset with `content + accumulate + expression` is intended to seed with content and generate new rows via the expression on each refresh. Three bugs conspire to prevent this: the schema forbids `accumulate` and `refreshTime` on content datasets; extraction skips the expression when `content + accumulate`; and the component refresh timer only re-pushes cached data without evaluating the expression.

2. **WebSocket push sources (#52):** WebSocket delivers event-typed messages (`snapshot`, `append`, `replace`, `remove`) over a persistent connection. The `DataProvider.fetch()` interface is request-response and cannot model a push stream. The manager lacks `replace` (update row by key) and `remove` (delete row by key) operations.

3. **Connection multiplexing (#53):** Multiple datasets sharing the same WebSocket base URL should share one connection, with events routed by a `dataset` field.

## Approach: Unified Event Model

The `DataSetManager` mutation interface is replaced by a single `apply(id, event)` method that accepts a discriminated union of four event types. All sources — HTTP resolver, expression generator, WebSocket — produce `DataSetEvent` objects. The manager applies them uniformly.

This is not a speculative abstraction. The event vocabulary matches the WebSocket wire protocol from the chat broadcaster, the existing `register`/`accumulate` methods are already implicit events, and the expression generator naturally produces `append` events. Three concrete producers justify the model.

## 1. DataSetEvent Model

### Type definitions

New file: `packages/pages-data/src/dataset/events.ts`

```typescript
type DataSetEvent =
  | SnapshotEvent
  | AppendEvent
  | ReplaceEvent
  | RemoveEvent;

interface SnapshotEvent {
  readonly type: "snapshot";
  readonly dataset: TypedDataSet;
}

interface AppendEvent {
  readonly type: "append";
  readonly rows: readonly TypedRow[];
  readonly maxRows?: number;
}

interface ReplaceEvent {
  readonly type: "replace";
  readonly keyColumn: ColumnId;
  readonly key: string;
  readonly row: TypedRow;
}

interface RemoveEvent {
  readonly type: "remove";
  readonly keyColumn: ColumnId;
  readonly key: string;
}
```

### DataSetManager changes

`register()` and `accumulate()` are removed. Replaced by:

```typescript
apply(id: DataSetId, event: DataSetEvent): void
```

**Event semantics:**

- **snapshot** — full replacement. `this.datasets.set(id, event.dataset)`. Fires `onChanged`.
- **append** — if the dataset doesn't exist in the manager, log a warning and skip (a `snapshot` must establish the dataset and its column schema before `append` events can be applied). Validate column schema against existing dataset. Append rows to END: `[...existing.rows, ...event.rows]`. If `maxRows` set, trim from START: `slice(-maxRows)`. Fires `onChanged`.
- **replace** — find all rows where `event.keyColumn` cell value matches `event.key`. Replace each with `event.row`. If no rows match, silent no-op (do not fire `onChanged`). If rows match, fire `onChanged`.
- **remove** — filter out all rows where `event.keyColumn` cell value matches `event.key`. If no rows match, silent no-op (do not fire `onChanged`). If rows removed, fire `onChanged`.

**Append ordering change:** The existing `accumulate` prepended rows (`[...new, ...existing]`). This changes to append (`[...existing, ...new]`). Charts sort by axis and are unaffected. Chat/log displays benefit from chronological insertion order. `maxRows` trimming changes from `slice(0, max)` to `slice(-max)` to keep the newest rows.

**Breaking change note:** The row ordering change reverses the storage order of accumulated datasets. Components rendering rows in storage order (tables without explicit sort, lists) would see reversed presentation. This has zero impact on existing dashboards: the schema currently enforces `accumulate requires url` (`schema.ts:53`), and all known accumulate use cases are time-series charts (which sort by axis). No existing dashboard uses `accumulate` with unsorted table rendering.

Query methods (`get`, `has`, `remove`, `lookup`) are unchanged.

## 2. Schema Changes

File: `packages/pages-data/src/dataset/external/schema.ts`

### Restrictions lifted

1. **`accumulate requires url`** — removed entirely. Accumulate is valid with any source.

2. **`refreshTime requires url`** — changed to: `refreshTime` requires a non-WebSocket `url` OR (`content` AND `expression` AND `accumulate`). WebSocket URLs (`ws://`/`wss://`) are excluded — polling and push are mutually exclusive, and `refreshTime` on a WebSocket dataset would silently fire failed HTTP fetches. Bare content datasets without expression still cannot have `refreshTime` (re-parsing the same inline data on a timer is meaningless). Zod refinement: `!d.refreshTime || (!d.url?.startsWith("ws://") && !d.url?.startsWith("wss://"))`.

### New field

3. **`keyColumn`** — optional `ColumnId`. Added to `ExternalDataSetDef` interface and Zod schema. Declares which column is the key for `replace`/`remove` events. This is a definition-level configuration — the WebSocket source reads `def.keyColumn` and populates `event.keyColumn` when constructing events from wire messages. The manager only uses `event.keyColumn` and has no access to definitions.

## 3. Extraction Pipeline Fix (#36)

### Root cause

Three independent blockers prevent expression evaluation for inline datasets:
1. Schema rejects `content + accumulate` (not enforced at runtime, but signals intent)
2. `extraction.ts:214` skips expression when `content + accumulate`
3. `scheduleRefresh` requires `refreshTime` (forbidden for content by schema)

### Fix: separate generation path

New file: `packages/pages-data/src/dataset/external/expression-generator.ts`

```typescript
export async function evaluateGenerator(
  expression: string,
  columns: readonly ExternalColumnDef[] | undefined,
  presetRegistry: PresetRegistry,
): Promise<TypedDataSet>
```

Evaluates the expression against no input data (the expression is a generator, not a transform), tabulates the result, and returns a `TypedDataSet`. No provider, no fetch, no content parsing.

### Two-path flow for content + expression + accumulate + refreshTime

**Initial resolution** (dataset not yet in manager):
- Existing resolver path runs normally
- Content is fetched via `InlineProvider`, parsed, tabulated
- Expression is skipped (line 214 logic stays — correct for initial load)
- Result applied as `{ type: "snapshot", dataset }`

**Refresh resolution** (timer fires, dataset already in manager):
- `scheduleRefresh` detects `content + expression + accumulate`
- Calls `evaluateGenerator(def.expression, def.columns, presetRegistry)` directly
- Result applied as `{ type: "append", rows, maxRows: def.cacheMaxRows }`
- Pushes updated data to all subscribing components

The extraction pipeline (`extraction.ts`) is not modified. The line 214 skip remains correct for its purpose (initial load). The refresh path bypasses extraction entirely.

## 4. WebSocket Source (#52)

### WebSocketSource

New file: `packages/pages-data/src/dataset/external/sources/websocket-source.ts`

Wraps a single WebSocket connection. Parses incoming JSON messages, tabulates raw row data into typed rows, and dispatches `DataSetEvent` objects to listeners by dataset ID.

```typescript
interface WebSocketSource {
  subscribe(dataSetId: DataSetId, def: ExternalDataSetDef, listener: DataSetEventListener): void;
  unsubscribe(dataSetId: DataSetId): void;
  close(): void;
}

type DataSetEventListener = (event: DataSetEvent) => void;
```

`subscribe` accepts the full definition so the source has per-dataset configuration: `def.keyColumn` for constructing replace/remove events, and `def.url` for deriving the wire-protocol dataset name.

### Wire-name routing

The wire protocol's `"dataset"` field may differ from the `DataSetId` (the YAML `uuid`). For example, YAML `uuid: "chat-messages"` with URL `ws://host/ws/chat?dataset=messages` — the wire name is `"messages"`, the DataSetId is `"chat-messages"`.

On `subscribe`, the source:
1. Parses `def.url` to extract the `?dataset=...` query parameter → this is the **wire name**
2. If no `?dataset=` parameter, the wire name defaults to the `DataSetId`
3. Stores a bidirectional mapping: wire name ↔ `DataSetId`
4. Sends the upstream subscribe message using the wire name: `{"type": "subscribe", "dataset": "messages"}`

On incoming messages, the source uses the wire name from the `"dataset"` field to look up the registered `DataSetId` and dispatch to the correct listener.

### Message processing

Each incoming WebSocket message is JSON. Two shapes are supported:

1. **Single event:** `{"dataset": "messages", "type": "append", "rows": [...]}`
2. **Batch (array):** `[{"dataset": "channels", "type": "snapshot", ...}, ...]`

For each event object:
- `dataset` field → wire name → mapped to `DataSetId` for routing
- `type` field → `DataSetEvent` discriminant
- `rows` (snapshot/append) → tabulated via existing `tabulate()` + `toTypedDataSet()`
- `row` (replace) → tabulated as single row
- `key` (replace/remove) → string, combined with `def.keyColumn` (from the subscription's stored definition) to populate `event.keyColumn`

The source constructs typed events: for `replace`/`remove`, it reads `def.keyColumn` from the stored per-dataset definition and sets `event.keyColumn` accordingly. The manager's `apply()` uses `event.keyColumn` directly — it has no access to definitions.

Column schema is established by the first `snapshot` event. Subsequent `append`/`replace` events validate against it. A later `snapshot` (reconnection) replaces the schema.

Events without a `dataset` field route to the sole subscriber (single-dataset, non-multiplexed case).

### Malformed message handling

- **Malformed JSON** (parse failure) — log warning, skip the message. Do not close the connection.
- **Valid JSON with missing or unknown `type` field** — log warning, skip the event.
- **Schema mismatch** (`append`/`replace` column count differs from established schema) — log warning, skip the event. The manager's `apply()` validates and throws; the source catches and logs.
- **Events for unsubscribed dataset IDs** — skip silently (no log; servers may broadcast to all connections).
- **`replace`/`remove` before any `snapshot`** — the dataset doesn't exist in the manager. `replace` is a no-op (no rows to match). `remove` is a no-op. `append` is a no-op (per §1 semantics). Logged as a warning.

### Connection lifecycle

- **Open:** when the first component requests a WebSocket dataset
- **Close:** when all datasets on the connection have zero subscribers. The WebSocket close handshake is asynchronous.
- **Reconnect:** exponential backoff (1s → 2s → 4s → ... capped at 30s). Server sends fresh `snapshot` on reconnect. Backoff resets on successful connection. Reconnection only applies to abnormal closures — see server-initiated close below.
- **Server-initiated close:** the reconnection policy depends on the close code:
  - **1000 (Normal Closure):** server intentionally closed. Do NOT reconnect — the server doesn't want the connection.
  - **1001 (Going Away), 1006 (Abnormal), 1011 (Unexpected Condition):** transient failures. Reconnect with exponential backoff.
  - **4000–4999 (Application-defined):** non-transient errors (auth expired, access denied). Do NOT reconnect. Log the close code and reason.
  - **All others (1002, 1003, etc.):** protocol errors indicating a bug. Do NOT reconnect (would repeat the same error).
- **CLOSING → reacquire:** if a user navigates away and back quickly, `acquire()` may be called while the old connection is still in the CLOSING state. The pool must detect this and create a new connection rather than returning the closing one. Two connections to the same base URL may coexist briefly during the handshake overlap.

### Integration with data-pipeline

`handleDataRequest` detects `ws://`/`wss://` URLs on the dataset definition:

1. Get or create `WebSocketSource` via the connection pool (Section 5)
2. Subscribe the dataset with a listener: `manager.apply(id, event)` + push data to all subscribing components
3. Initial `snapshot` from server populates the manager
4. Subsequent events update incrementally

WebSocket datasets do not use `scheduleRefresh` — the server pushes when data changes.

## 5. WebSocket Multiplexing (#53)

### WebSocketPool

New file: `packages/pages-data/src/dataset/external/sources/websocket-pool.ts`

```typescript
interface WebSocketPool {
  acquire(baseUrl: string, def: ExternalDataSetDef): WebSocketSource;
  releaseAll(): void;
}
```

### Base URL derivation

Two dataset URLs share a connection when they have the same scheme, host, port, and path — differing only in query parameters.

```
ws://localhost:8080/ws/chat?dataset=messages  → key: ws://localhost:8080/ws/chat
ws://localhost:8080/ws/chat?dataset=presence  → key: ws://localhost:8080/ws/chat
ws://localhost:8080/ws/metrics                → key: ws://localhost:8080/ws/metrics
```

Same key → same `WebSocketSource` instance → one connection.

**Connection URL:** The WebSocket connection is opened using the base URL (scheme + host + port + path, no query parameters). Query parameters from individual dataset URLs are NOT included in the connection URL — they are only used to derive the `dataset` field for subscription messages. Subscription is exclusively via upstream JSON messages (`{"type": "subscribe", "dataset": "..."}`).

### Lifecycle

- `acquire()` returns existing source or creates a new one
- Each source tracks subscribed dataset IDs
- `subscribe()` adds listener. Connection opens on first subscriber (or was already open).
- `unsubscribe()` removes listener. Connection closes when zero datasets remain.
- `releaseAll()` closes all connections (called from `site.dispose()`)

### Subscription messages

On subscribe/unsubscribe, the source optionally sends upstream:
```json
{"type": "subscribe", "dataset": "presence"}
{"type": "unsubscribe", "dataset": "presence"}
```
Servers that don't use selective push (like the chat broadcaster) ignore these. The wire format supports it for servers that want it.

## 6. Data Pipeline Integration

### Source routing in `handleDataRequest`

```
1. Dataset already in manager?
   → pushData (unchanged)
   → schedule refresh if applicable

2. Resolve dataset definition from scope

3. Route by source type:
   a. ws:// or wss:// URL
      → pool.acquire → subscribe → listener dispatches events to manager
   b. content + expression + accumulate
      → resolveExternalDataSet (seed) → schedule expression refresh
   c. Everything else
      → resolveExternalDataSet → pushData → scheduleRefresh (existing)
```

### `scheduleRefresh` branching

```
if ws:// or wss:// URL:
  → skip (WebSocket datasets use server push, not polling)
if content + expression + accumulate + refreshTime:
  → evaluateGenerator on interval → manager.apply(id, AppendEvent)
else if url + refreshTime:
  → resolveExternalDataSet on interval (existing)
```

The WebSocket URL guard is defense-in-depth — the §2 schema refinement rejects `refreshTime` on WebSocket definitions at parse time. The runtime check catches any definition that bypasses schema validation (e.g. programmatic construction via `inlineDataset()`).

### Resolver migration

`registerOrAccumulate` in `resolver.ts` becomes:

```typescript
if (def.accumulate && manager.has(def.uuid)) {
  manager.apply(def.uuid, { type: "append", rows: dataset.rows, maxRows: def.cacheMaxRows });
} else {
  manager.apply(def.uuid, { type: "snapshot", dataset });
}
```

The `has()` check is required: per §1, `append` to a non-existent dataset is a no-op. On first resolution, the dataset doesn't exist yet — the existing `accumulate()` method handled this implicitly by treating the first call as a snapshot (`manager.ts:90-94`). The explicit `has()` check preserves this semantic: first load = snapshot (establishes schema), subsequent loads = append (incremental).

The **join route** (`resolver.ts:103`) also calls `register()` directly. This becomes `ctx.manager.apply(def.uuid, { type: "snapshot", dataset })` — join always produces a full dataset replacement.

### Cleanup

`site.dispose()` adds `pool.releaseAll()` alongside the existing timer cleanup. Expression generator timers use the existing `refreshTimers` map.

## 7. File Map

### New files

| File | Purpose |
|------|---------|
| `packages/pages-data/src/dataset/events.ts` | `DataSetEvent` union, event type interfaces |
| `packages/pages-data/src/dataset/external/expression-generator.ts` | `evaluateGenerator()` |
| `packages/pages-data/src/dataset/external/sources/websocket-source.ts` | `WebSocketSource` |
| `packages/pages-data/src/dataset/external/sources/websocket-pool.ts` | `WebSocketPool` |

### Modified files

| File | Change |
|------|--------|
| `packages/pages-data/src/dataset/manager.ts` | Replace `register()`/`accumulate()` with `apply()`. Add replace/remove. Append ordering. |
| `packages/pages-data/src/dataset/external/schema.ts` | Lift restrictions, add `keyColumn` |
| `packages/pages-data/src/dataset/external/types.ts` | Add `keyColumn` to `ExternalDataSetDef` |
| `packages/pages-data/src/dataset/external/resolver.ts` | `registerOrAccumulate` → event dispatch; join route `register()` → `apply(snapshot)` |
| `packages/pages-data/src/dataset/index.ts` | Export events, `evaluateGenerator` |
| `packages/pages-runtime/src/adapters/local-adapter.ts` | `register()` → `apply()`: save uses `ReplaceEvent`, delete uses `RemoveEvent`, create uses `AppendEvent` |
| `packages/pages-runtime/src/data-pipeline.ts` | Source routing, expression refresh, pool lifecycle |
| `packages/pages-runtime/src/site.ts` | Pass presetRegistry, dispose pool |
| `examples/dashboards/Basic Usage/Accumulate Flag.ts` | Add `refreshTime`, remove component refresh |
| `examples/dashboards/Basic Usage/Accumulate Flag.dash.yaml` | Add `refreshTime` to dataset def, remove `refresh` from displayer props |

### Unchanged

- `extraction.ts` — line 214 skip stays, `evaluateGenerator` is separate
- `provider-factory.ts` — WebSocket doesn't use providers
- All existing providers (inline, browser-fetch, cors-proxy, server-relay, post-message)
- Operations (filter, group, sort, join)
- Component layer (pages-viz, pages-component)
- Context wiring

## 8. Out of Scope (filed as issues)

- **#56 — `since` query parameter for incremental reconnect.** The WebSocket source reconnects with a fresh `snapshot` from the server. Incremental reconnect via `since` is an optimization that can be added later without design changes.
- **#57 — Server-side WebSocket relay.** The existing `ServerRelayProvider` proxies HTTP requests through a backend. A WebSocket equivalent is not needed for the chat demo.
- **#58 — WebSocket authentication.** Connection headers, token-based auth. Deferred until a concrete auth requirement surfaces.
