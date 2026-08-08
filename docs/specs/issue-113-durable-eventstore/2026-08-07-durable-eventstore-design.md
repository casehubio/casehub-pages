# Durable EventStore Implementations Design

**Issue:** casehubio/casehub-pages#113
**Date:** 2026-08-07
**Status:** Approved

## Problem

The push protocol's `EventStore` SPI has a single implementation: `InMemoryEventStore`, a bounded ring buffer. Events are lost on server restart. Apps that need durable event replay across restarts need persistent implementations backed by PostgreSQL or Redis.

## Scope

1. SPI changes to `EventStore` and `StoredEvent` (breaking — pre-release, cost is zero)
2. `casehub-pages-push-store-jdbc` — PostgreSQL-backed EventStore (Tier 2)
3. `casehub-pages-push-store-redis` — Redis Streams-backed EventStore (Tier 3)
4. Both capacity-based and time-based retention

## SPI Changes

### StoredEvent — add timestamp

```java
public record StoredEvent(String topic, String payloadJson, long seq, Instant createdAt) {
    public StoredEvent {
        Objects.requireNonNull(topic, "topic");
        Objects.requireNonNull(payloadJson, "payloadJson");
        Objects.requireNonNull(createdAt, "createdAt");
    }
}
```

### EventStore.replay() — add limit parameter

```java
List<StoredEvent> replay(String topic, long sinceSeq, int limit);
```

Returns at most `limit` events with `seq > sinceSeq`, ordered by seq ascending. `limit` must be > 0 (throws `IllegalArgumentException` otherwise). Callers paginate by advancing `sinceSeq` to the last returned event's seq and calling again until empty.

### InMemoryEventStore — update to match

- `append()` captures `Instant.now()` in the `StoredEvent`
- `replay()` applies `.limit(limit)` to the stream filter
- Ring buffer eviction unchanged

### Ripple

`EventBroadcaster` calls `append()` only — unaffected by new `createdAt` field. Does not call `replay()`.

Internal callers of `replay()` that need updating:
- `EventStoreOverrideTest` in push-runtime (calls `replay()` indirectly via the stub)
- `BroadcastIntegrationTest` in push-runtime (verifies replay after broadcast)
- `PushProducersTest` in push-runtime (may verify EventStore behavior)

External callers: consuming apps' WebSocket endpoints add a limit argument (e.g., 10_000).

## Module Structure

| Module | Artifact | CDI Tier | Annotation |
|--------|----------|----------|------------|
| `backend/push-store-jdbc/` | `casehub-pages-push-store-jdbc` | Tier 2 | `@ApplicationScoped` |
| `backend/push-store-redis/` | `casehub-pages-push-store-redis` | Tier 3 | `@Alternative @Priority(1)` |

### CDI Resolution

| Classpath | Active EventStore |
|-----------|-------------------|
| Neither store module | InMemoryEventStore (`@DefaultBean` in push-runtime) |
| JDBC only | JdbcEventStore |
| Redis only | RedisEventStore |
| Both | RedisEventStore (Tier 3 > Tier 2) |

Per `persistence-backend-cdi-priority.md` — additive classpath activation, no consumer-side configuration.

### Implementation classes (not producers)

```java
// push-store-jdbc
@ApplicationScoped
public class JdbcEventStore implements EventStore { ... }

// push-store-redis
@Alternative @Priority(1)
@ApplicationScoped
public class RedisEventStore implements EventStore { ... }
```

### Dependencies

| Module | Compile | Provided | Test |
|--------|---------|----------|------|
| push-store-jdbc | `casehub-pages-push`, `quarkus-arc`, `quarkus-scheduler` | `quarkus-agroal` | `quarkus-junit5`, `quarkus-jdbc-postgresql`, `assertj` |
| push-store-redis | `casehub-pages-push`, `quarkus-arc`, `quarkus-redis-client`, `quarkus-scheduler` | — | `quarkus-junit5`, `assertj` |

Both include `jandex-maven-plugin` (configured in parent `pluginManagement`).

### Parent POM changes

Add to `backend/pom.xml`:
- Modules: `<module>push-store-jdbc</module>`, `<module>push-store-redis</module>`
- Dependency management entries for both artifacts

## JDBC Design

### Schema

```sql
CREATE TABLE IF NOT EXISTS push_topic_seq (
    topic       VARCHAR(255) PRIMARY KEY,
    next_seq    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS push_events (
    topic        VARCHAR(255) NOT NULL,
    seq          BIGINT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (topic, seq)
);
```

No surrogate key — `(topic, seq)` is the natural primary key and the only access pattern. The composite PK doubles as the index for replay queries.

Schema created on startup via `@PostConstruct` with `CREATE TABLE IF NOT EXISTS`. Idempotent. No Flyway dependency.

### Append (single JDBC transaction)

Raw JDBC with `Connection.setAutoCommit(false)`, `commit()`, `rollback()` — no JPA, no `@Transactional`. Steps within one connection:

1. `INSERT INTO push_topic_seq (topic, next_seq) VALUES (?, 1) ON CONFLICT (topic) DO UPDATE SET next_seq = push_topic_seq.next_seq + 1 RETURNING next_seq` → seq
2. `INSERT INTO push_events (topic, seq, payload_json, created_at) VALUES (?, ?, ?, now())`
3. Capacity enforcement: `DELETE FROM push_events WHERE topic = ? AND seq <= ?` where threshold = `seq - maxEventsPerTopic`. Deletes 0 or 1 row in steady state.
4. Commit and return seq

### Replay

```sql
SELECT topic, seq, payload_json, created_at
FROM push_events WHERE topic = ? AND seq > ?
ORDER BY seq ASC LIMIT ?
```

### Topics

```sql
SELECT topic FROM push_topic_seq
```

### Retention

- **Capacity-based:** enforced on every `append()` (step 3). Same semantics as InMemoryEventStore ring buffer.
- **Time-based TTL:** Quarkus `@Scheduled` task at configurable interval (default 1 hour). `DELETE FROM push_events WHERE created_at < now() - interval '...'`. The `push_topic_seq` rows are never deleted — topics remain listed by `topics()` even after all events expire, consistent with InMemoryEventStore semantics where "topics remain listed even after all events are evicted."

### Configuration

```properties
casehub.pages.push.store.jdbc.max-events-per-topic=10000
casehub.pages.push.store.jdbc.ttl=P7D
casehub.pages.push.store.jdbc.cleanup-interval=PT1H
```

## Redis Design

### Key structure

| Key | Type | Purpose |
|-----|------|---------|
| `push:seq:{topic}` | String (counter) | Per-topic monotonic seq via `INCR` |
| `push:events:{topic}` | Stream | Event log with explicit IDs |
| `push:topics` | Set | Topic name registry |

### Append (pipelined, not transactional)

1. `INCR push:seq:{topic}` → seq
2. `SADD push:topics {topic}`
3. `XADD push:events:{topic} <seq>-0 payload <json> createdAt <epochMillis>`
4. `XTRIM push:events:{topic} MAXLEN ~ <maxEventsPerTopic>`

The `~` allows Redis to trim efficiently by removing whole radix tree nodes.

No `MULTI/EXEC` — a crash between INCR and XADD produces a seq gap, which is harmless. The SPI requires monotonicity (no duplicate seq), not contiguity (no gaps). `replay(topic, sinceSeq)` works correctly with gaps.

### Replay

```
XRANGE push:events:{topic} (<sinceSeq>-0 + COUNT <limit>
```

The `(` prefix is exclusive range — matches `seq > sinceSeq`. Seq extracted from stream ID (part before `-0`). `createdAt` parsed from stream entry field.

### Topics

```
SMEMBERS push:topics
```

### Retention

- **Capacity-based:** `XTRIM MAXLEN ~` on every append. The `~` makes trimming approximate (Redis removes whole radix tree nodes) — the stream may temporarily exceed maxEventsPerTopic by a small margin. This is intentional for performance.
- **Time-based TTL:** `XTRIM MINID` is incompatible with seq-based stream IDs (it interprets IDs as millisecond timestamps). Instead, the `@Scheduled` cleanup iterates each topic's stream with `XRANGE push:events:{topic} - + COUNT 100`, checks the `createdAt` field against the TTL threshold, and deletes expired entries with `XDEL`. Repeats until a non-expired entry is found (entries are ordered by seq, and createdAt is monotonically increasing in practice). Topic set entries are never removed — topics persist in `push:topics` even after all events expire.

### Operational requirements

- **Redis 6.2+** required for exclusive XRANGE prefix (`(` syntax).
- **Memory policy:** Redis must be configured with `noeviction` or an LRU policy that excludes push keys. Eviction of `push:seq:{topic}` keys would reset sequence counters, causing duplicate seq numbers and violating the monotonicity invariant.

### Redis client

`quarkus-redis-client` provides `@Inject RedisDataSource` — blocking API matching the synchronous EventStore SPI.

### Configuration

```properties
casehub.pages.push.store.redis.max-events-per-topic=10000
casehub.pages.push.store.redis.ttl=P7D
casehub.pages.push.store.redis.cleanup-interval=PT1H
casehub.pages.push.store.redis.key-prefix=push
```

## Test Plan

### SPI tests (push module — update existing)

| Test | What it verifies |
|------|------------------|
| All existing `InMemoryEventStoreTest` cases | Updated: `limit` param on `replay()`, `createdAt` non-null |
| `replay_respects_limit` | Append 10 events, replay with limit=3, verify 3 returned |
| `stored_event_has_created_at` | `createdAt` close to `Instant.now()` |

### JDBC tests (`@QuarkusTest` with DevServices PostgreSQL)

| Test | What it verifies |
|------|------------------|
| `append_assigns_monotonic_seq` | Seq 1, 2, 3 on same topic |
| `append_per_topic_isolation` | Independent seq counters per topic |
| `replay_returns_events_after_sinceSeq` | Correct filtering |
| `replay_respects_limit` | Returns at most N events |
| `replay_empty_topic` | Empty list, no error |
| `topics_returns_all_with_events` | Tracks topic names via counter table |
| `bounded_capacity_eviction` | Events beyond max pruned |
| `ttl_retention` | Scheduled cleanup removes expired events |
| `schema_creation_idempotent` | Two startups against same DB, no errors |
| `concurrent_append_thread_safety` | 10 threads x 100 appends — monotonic, no gaps |
| `stored_event_has_timestamp` | `createdAt` populated from DB |

### Redis tests (`@QuarkusTest` with DevServices Redis)

Same behavioral tests as JDBC, plus:

| Test | What it verifies |
|------|------------------|
| `stream_id_maps_to_seq` | Stream entry ID `<seq>-0` round-trips correctly |
| `xtrim_enforces_capacity` | Stream length stays bounded |
| `topic_set_tracks_all_topics` | `SMEMBERS` returns all topics |

### CDI integration tests

| Test | What it verifies |
|------|------------------|
| `jdbc_displaces_default` | `@Inject EventStore` resolves to `JdbcEventStore` |
| `redis_displaces_jdbc` | With both on classpath, resolves to `RedisEventStore` |

## Module layout

```
backend/push-store-jdbc/
  pom.xml
  src/main/java/io/casehub/pages/push/store/jdbc/
    JdbcEventStore.java
    JdbcEventStoreRetention.java
  src/test/java/io/casehub/pages/push/store/jdbc/
    JdbcEventStoreTest.java
    JdbcCdiIntegrationTest.java

backend/push-store-redis/
  pom.xml
  src/main/java/io/casehub/pages/push/store/redis/
    RedisEventStore.java
    RedisEventStoreRetention.java
  src/test/java/io/casehub/pages/push/store/redis/
    RedisEventStoreTest.java
    RedisCdiIntegrationTest.java
```

## What This Does NOT Cover

- Cross-node event distribution (#147) — blocked by this issue, not part of it
- WebSocket endpoint implementation — consumer responsibility
- Schema migration tooling (Flyway) — pre-release, startup DDL is sufficient
