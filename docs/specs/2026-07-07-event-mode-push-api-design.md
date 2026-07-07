# Event-Mode Push API — Design Spec

**Epic:** #125
**Covers:** #126 (EventBroadcaster), #127 (EventStreamController), #128 (documentation)
**Date:** 2026-07-07
**Branch:** issue-125-event-mode-push-api

## Context

The push wire protocol supports two modes: dataset mode (tabular snapshot/append/replace/remove) and event mode (arbitrary domain events with topic/payload, seq tracking, wildcard matching, replay). Event mode is fully functional but has gaps in server-side convenience, Lit component integration, and discoverability.

The casehub-connectors team built a separate SSE endpoint for notifications because they didn't know `createEventConnection` existed, and the server-side boilerplate to broadcast events is too low-level.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| EventBroadcaster module | `casehub-pages-push` (plain Java) | Preserves zero-Quarkus contract; `SessionSender` functional interface decouples from transport |
| Typed vs raw payloads | Raw `String payloadJson` | Matches existing `EventStore`/`PushMessage` surface; avoids jackson-databind dependency; consumers serialise with their own ObjectMapper |
| Event subscription API | `pages-data` (framework-agnostic `EventStream`) | Follows SSEManager pattern; preserves framework-free data layer (ARC42STORIES §10). Lit `ReactiveController` adapter documented as reference implementation for consumer Lit packages (currently `blocks-ui`). |
| Connection sharing | Factory-created pool with module-level default singleton; per-topic reference counting | Pool keyed by resolved URL; `createEventStreamPool()` factory for test isolation; per-topic subscriber counts prevent cross-controller event loss; `shared: false` opt-out available |
| Buffer size | Default 100, configurable `maxBuffer` | Prevents memory leak on high-volume streams; `stream.latest` available for single-value use cases |
| Documentation | CLAUDE.md inline updates | No standalone doc; makes dual-mode architecture discoverable where developers already look |

## Component 1: EventBroadcaster (#126)

**File:** `backend/push/src/main/java/io/casehub/pages/push/EventBroadcaster.java`

Plain Java class wrapping the three-step broadcast ceremony into a single call.

### API

```java
public class EventBroadcaster {
    private final EventStore eventStore;
    private final TopicRegistry topicRegistry;
    private final SessionSender sessionSender;

    public EventBroadcaster(EventStore eventStore,
                            TopicRegistry topicRegistry,
                            SessionSender sessionSender) {
        this.eventStore = eventStore;
        this.topicRegistry = topicRegistry;
        this.sessionSender = sessionSender;
    }

    public long broadcast(String topic, String payloadJson) {
        if (topic.contains("*")) {
            throw new IllegalArgumentException(
                "broadcast topic must not contain wildcards: " + topic);
        }
        long seq = eventStore.append(topic, payloadJson);
        String wire = PushMessage.event(topic, payloadJson, seq);
        for (String connId : topicRegistry.connections(topic)) {
            try {
                sessionSender.send(connId, wire);
            } catch (Exception e) {
                // Connection likely closed between connections() snapshot and send.
                // Event is persisted in EventStore; replay delivers on reconnect.
            }
        }
        return seq;
    }
}
```

### SessionSender

New functional interface in the push module:

```java
@FunctionalInterface
public interface SessionSender {
    void send(String connectionId, String message);
}
```

WebSocket endpoints provide the implementation (e.g. `sessions.get(connId)::sendText`), keeping EventBroadcaster transport-agnostic and testable without a real socket.

### Return value

Returns `long seq` — the sequence number assigned by EventStore. Callers can use this for ack correlation or logging.

### Testing

Unit test with a mock `SessionSender` that captures sent messages. Verify:
- Sequence assigned by EventStore is used in the wire message
- All connections returned by `TopicRegistry.connections()` receive the message
- Wire message format matches `PushMessage.event()` output
- Broadcast to a topic with zero connections succeeds without error
- Wildcard topic (`notification:**`) throws `IllegalArgumentException`
- Failed send to one connection does not prevent delivery to remaining connections

## Component 2: Event Subscription API (#127)

Two-part design: framework-agnostic `EventStream` in pages-data + Lit `ReactiveController` adapter as reference implementation.

### Part A: EventStream (pages-data)

**Directory:** `packages/pages-data/src/event-stream/`
**File:** `packages/pages-data/src/event-stream/event-stream.ts`

Framework-agnostic event subscription manager. Follows the `SSEManager` pattern already in pages-data. Zero framework dependencies — pages-data stays framework-free per ARC42STORIES §10.

#### API

```typescript
export class EventStream<T = unknown> {
    readonly latest: T | undefined;
    readonly all: readonly T[];
    readonly status: ConnectionStatus;

    constructor(
        url: string,
        topics: string | string[],
        options?: EventStreamOptions<T>
    );

    connect(): void;
    disconnect(): void;
}

export interface EventStreamOptions<T = unknown> {
    config?: PushSourceConfig;
    maxBuffer?: number;        // default 100
    shared?: boolean;          // default true
    batchEvents?: boolean;     // default false
    parse?: (raw: unknown) => T;  // optional runtime payload validation/transform
    pool?: EventStreamPool;    // default: module-level singleton
    onChange?: () => void;      // called on state updates
}

export interface EventStreamPool { /* opaque */ }
export function createEventStreamPool(): EventStreamPool;
```

#### Connection pool

`createEventStreamPool()` returns an opaque pool. A module-level default singleton is created on import. Tests inject isolated pools via `options.pool`.

Pool entry structure: `Map<string, { conn: EventConnection; refCount: number; eventTarget: EventTarget; topicCounts: Map<string, number> }>`.

- **Acquire** (`connect()`): if pool has entry for URL, increment refCount and increment `topicCounts` for each topic. Call `conn.listen()` only for topics with count going from 0 → 1 (new to the pool). Otherwise create `new EventTarget()`, call `createEventConnection(url, { config: { ...config, eventTarget }, batchEvents })`, store with refCount = 1 and initial topic counts.
- **Release** (`disconnect()`): decrement `topicCounts` for each topic. Call `conn.unlisten()` only for topics whose count reaches 0. Decrement refCount. If refCount reaches 0, call `conn.close()` and remove from pool.
- **Bypass** (`shared: false`): creates a private `EventConnection` with its own `EventTarget`, closes it on disconnect. Not pooled.

Pool key is the resolved URL (after relay/auth config applied via `buildConnectionUrl`).

#### Event reception

1. Pool entry holds a shared `EventTarget` (non-DOM — `new EventTarget()`), passed to `createEventConnection()` via `config.eventTarget`.
2. On `connect()`, EventStream adds a `"pages-event"` listener on the shared `EventTarget`.
3. Listener receives `CustomEvent` with `detail: { topic, payload }`, filters by topic match using `matchesTopic()` from `topic-matching.ts`.
4. On match: if `parse` is provided, call `parse(payload)` — on exception, log warning and drop the event. Push result to `all` (FIFO evict if length > `maxBuffer`), set `latest`, invoke `onChange` callback.
5. On `disconnect()`, EventStream removes its `"pages-event"` listener.

#### Error handling

`conn.listen()` rejection (timeout or server error) is caught and logged as a warning. Listen failures are non-fatal — topics are registered in the connection's `listenRegistrations` Set and will be re-sent on reconnect. The `status` property reflects the connection status (connected/reconnecting/disconnected), not listen acknowledgement.

#### Type widening

`PushSourceConfig.eventTarget` is widened from `HTMLElement` to `EventTarget`. The only consumer of this field (`dispatchWireEvent()` in push-wire.ts) already accepts `EventTarget`. No callers use HTMLElement-specific APIs on it.

### Part B: EventStreamController (Lit adapter — reference implementation)

Thin `ReactiveController` wrapping `EventStream`. Lives in the project's Lit component package (currently `blocks-ui` per the pages-primitives → blocks-ui consolidation in commit 4659c9b).

```typescript
import { EventStream, type EventStreamOptions } from '@casehubio/pages-data';
import type { ReactiveController, ReactiveControllerHost } from '@lit/reactive-element';

export class EventStreamController<T = unknown> implements ReactiveController {
    private readonly stream: EventStream<T>;

    get latest() { return this.stream.latest; }
    get all() { return this.stream.all; }
    get status() { return this.stream.status; }

    constructor(
        private host: ReactiveControllerHost,
        url: string,
        topics: string | string[],
        options?: EventStreamOptions<T>
    ) {
        this.stream = new EventStream(url, topics, {
            ...options,
            batchEvents: options?.batchEvents ?? true,
            onChange: () => host.requestUpdate(),
        });
        host.addController(this);
    }

    hostConnected() { this.stream.connect(); }
    hostDisconnected() { this.stream.disconnect(); }
}
```

The adapter defaults `batchEvents` to `true` (RAF coalescing aligned with display refresh), overriding EventStream's default of `false`. The `onChange` callback wires to Lit's `requestUpdate()`.

### Usage

```typescript
@customElement('notification-badge')
class NotificationBadge extends LitElement {
    private events = new EventStreamController(this, wsUrl, 'notification:**');

    render() {
        return html`<span class="badge">${this.events.all.length}</span>`;
    }
}
```

### Testing

**EventStream (pages-data):**
- Two EventStreams same URL share one connection via pool, topics additive
- Per-topic reference counting — disconnecting one stream doesn't unlisten shared topics
- EventStream with `shared: false` — isolated connection
- Buffer capping — events beyond maxBuffer evict oldest
- Lifecycle — `disconnect()` cleans up; last stream closes pooled connection
- Reconnection — stream re-listens after connection reconnects
- Topic filtering — only matching events update state
- Parse function — valid payloads pass through, invalid payloads are dropped with warning
- Pool factory — `createEventStreamPool()` isolates test state
- Listen rejection — caught and logged, stream continues operating

**EventStreamController (blocks-ui):**
- Controller delegates to EventStream correctly
- `hostConnected` / `hostDisconnected` map to `connect()` / `disconnect()`
- `host.requestUpdate()` called on state changes

## Component 3: Documentation (#128)

### CLAUDE.md — `@casehubio/pages-data` description

Update to surface dual-mode architecture and the new controller:

```
@casehubio/pages-data — DataSet model, operations engine, JSONata.
  Push wire protocol with two modes:
  - Dataset mode (PushSource, createWebSocketSource) — tabular snapshot/append/replace/remove
  - Event mode (EventConnection, createEventConnection, EventStream) — arbitrary domain
    events with topic/payload, seq tracking, wildcard matching, replay.
    EventStream: framework-agnostic subscription manager with connection pooling,
    topic filtering, and buffering. Lit adapter (EventStreamController) in blocks-ui.
  General-purpose SSEManager (connection pooling, named event support, reconnection).
```

### CLAUDE.md — `casehub-pages-push` backend description

```
casehub-pages-push — Typed wire protocol SDK: PushMessage (server->client builders),
  PushRequest (sealed client->server parser with ack/error correlation),
  EventBroadcaster (single-call broadcast: append + route + send),
  TopicRegistry (wildcard-aware connection tracking),
  EventStore SPI + InMemoryEventStore (bounded per-topic event replay). jackson-core only, no Quarkus.
```

### CLAUDE.md — Data flow

Add event-mode flow:

```
Dataset mode: YAML -> pages-ui (parse) -> pages-data (resolve) -> pages-component (layout)
  -> pages-viz (render) -> pages-filter/pages-sort events -> back to data layer
Event mode: Server -> EventBroadcaster -> WebSocket -> EventConnection
  -> EventStream -> onChange callback (or EventStreamController -> Lit re-render)
```

## Scope

### In scope
- EventBroadcaster class + SessionSender interface + unit tests
- EventStream class + connection pool + pool factory + unit tests
- EventStreamController Lit adapter (reference implementation for blocks-ui)
- `PushSourceConfig.eventTarget` type widening from `HTMLElement` to `EventTarget`
- CLAUDE.md documentation updates

### Out of scope
- Changing dataset/tabular mode
- Client-to-server application messaging over WebSocket
- Migrating existing SSE consumers
- CDI/Quarkus integration for EventBroadcaster (GitHub issue to be filed — follow-up to #126)
- Typed payload serialisation (GitHub issue to be filed — follow-up to #126)
