# Push Runtime CDI Integration Design

**Issue:** casehubio/casehub-pages#136
**Date:** 2026-07-08
**Status:** Draft

## Problem

`casehub-pages-push` is a pure Java SDK (jackson-core only). Quarkus endpoints that want to broadcast events must manually wire the constructor:

```java
new EventBroadcaster(eventStore, topicRegistry, sessions::sendText)
```

A CDI-aware module lets endpoints `@Inject EventBroadcaster` directly.

## Scope Decision

The generic pub/sub core (TopicRegistry, EventStore, EventBroadcaster) stays in pages. Investigation of platform's existing broadcasting infrastructure (work's `WorkItemEventBroadcaster` with local + Postgres impls, qhorus's `ChannelActivityBroadcaster` + `MessageObserver`, platform's `NotificationSseResource`) confirmed these are server-side CDI-event-driven fixed-filter SSE broadcasters — a different pattern from pages-push's client-driven WebSocket pub/sub with wildcard topic routing and sequence-numbered replay. No overlap, no platform consumer for these primitives.

## Design

### New Module: `backend/push-runtime/`

**Artifact:** `casehub-pages-push-runtime`

**POM:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>io.casehub</groupId>
        <artifactId>casehub-pages-backend</artifactId>
        <version>0.2-SNAPSHOT</version>
    </parent>

    <artifactId>casehub-pages-push-runtime</artifactId>
    <packaging>jar</packaging>
    <name>CaseHub Pages Push Runtime</name>

    <dependencies>
        <dependency>
            <groupId>io.casehub</groupId>
            <artifactId>casehub-pages-push</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-arc</artifactId>
        </dependency>
        <dependency>
            <groupId>org.eclipse.microprofile.config</groupId>
            <artifactId>microprofile-config-api</artifactId>
            <scope>provided</scope>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.assertj</groupId>
            <artifactId>assertj-core</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>io.smallrye</groupId>
                <artifactId>jandex-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

**Production code:** Single producer class.

```java
package io.casehub.pages.push.runtime;

@ApplicationScoped
public class PushProducers {

    @Produces
    @ApplicationScoped
    TopicRegistry topicRegistry() {
        return new TopicRegistry();
    }

    @Produces
    @ApplicationScoped
    @DefaultBean
    EventStore eventStore(
            @ConfigProperty(name = "casehub.pages.push.max-events-per-topic",
                            defaultValue = "1000") int maxEventsPerTopic) {
        return new InMemoryEventStore(maxEventsPerTopic);
    }

    @Produces
    @ApplicationScoped
    EventBroadcaster eventBroadcaster(EventStore eventStore,
                                       TopicRegistry topicRegistry,
                                       SessionSender sessionSender) {
        return new EventBroadcaster(eventStore, topicRegistry, sessionSender);
    }
}
```

### Consumer Contract

**Beans provided** — the module makes three beans available for `@Inject`:

| Bean | Purpose |
|---|---|
| `TopicRegistry` | Connection management — `listen(connId, topics)`, `unlisten(connId, topics)`, `removeConnection(connId)`. The consumer's WebSocket endpoint wires incoming `PushRequest` operations to these methods. |
| `EventStore` | Event replay — `replay(topic, sinceSeq)` for reconnect catch-up. Also `topics()` for wildcard+replay integration. |
| `EventBroadcaster` | Publish — `broadcast(topic, payloadJson)` stores the event and delivers to all matching connections. |

**Consumer obligation** — the consumer must provide a `SessionSender` bean:

```java
@ApplicationScoped
public class MyWebSocketEndpoint {

    @Produces
    @ApplicationScoped
    SessionSender sessionSender() {
        return (connectionId, message) -> {
            // send via WebSocket session map
        };
    }
}
```

Missing `SessionSender` produces a clear Quarkus build-time error (unsatisfied dependency). This is the gateway pattern — the consumer provides the transport bridge.

### EventStore Override

`@DefaultBean` on the `EventStore` producer means any consumer-provided `@ApplicationScoped EventStore` automatically displaces the default `InMemoryEventStore`. A future JDBC-backed EventStore would simply provide its own bean — no configuration flags or exclusions needed.

`@DefaultBean` is intentionally absent from `TopicRegistry` and `EventBroadcaster`. `TopicRegistry` is a `final class` with no SPI interface — the trie-based routing is the implementation, not an abstraction over interchangeable strategies. `EventBroadcaster` is a concrete coordinator; customisation of transport behaviour belongs in `SessionSender` (the transport bridge), not in replacing the broadcast orchestration.

### Configuration

| Property | Default | Description |
|---|---|---|
| `casehub.pages.push.max-events-per-topic` | `1000` | Bounded ring buffer capacity per topic in the default InMemoryEventStore (must be ≥ 1) |

### Module Structure

```
backend/push-runtime/
  pom.xml
  src/main/java/io/casehub/pages/push/runtime/
    PushProducers.java
  src/test/java/io/casehub/pages/push/runtime/
    TestPushConfig.java
    PushProducersTest.java
    BroadcastIntegrationTest.java
```

### Parent POM Changes

Add to `backend/pom.xml`:

1. **Modules list:** add `<module>push-runtime</module>`
2. **`dependencyManagement`:** add both artifacts (neither is currently managed):

```xml
<dependency>
    <groupId>io.casehub</groupId>
    <artifactId>casehub-pages-push</artifactId>
    <version>${project.version}</version>
</dependency>
<dependency>
    <groupId>io.casehub</groupId>
    <artifactId>casehub-pages-push-runtime</artifactId>
    <version>${project.version}</version>
</dependency>
```

## Test Plan

### Test Infrastructure

`TestPushConfig` — an `@ApplicationScoped` bean in `src/test/java` that satisfies the `SessionSender` consumer obligation for the test container. Produces a message-capturing `SessionSender` and exposes the captured messages for assertions. Follows the pattern established by `data-sql`'s `TestSchemaInitializer`.

```java
@ApplicationScoped
public class TestPushConfig {
    private final List<SentMessage> sent = new CopyOnWriteArrayList<>();

    @Produces
    @ApplicationScoped
    SessionSender sessionSender() {
        return (connectionId, message) -> sent.add(new SentMessage(connectionId, message));
    }

    public List<SentMessage> sent() { return List.copyOf(sent); }
    public void clear() { sent.clear(); }

    public record SentMessage(String connectionId, String message) {}
}
```

### PushProducersTest (@QuarkusTest)

1. **All beans resolvable** — inject `EventBroadcaster`, `TopicRegistry`, `EventStore`, verify non-null
2. **Default EventStore capacity** — verify InMemoryEventStore is created with default capacity (1000)
3. **Custom capacity via config** — set `casehub.pages.push.max-events-per-topic=50`, verify bounded at 50 events
4. **EventStore override** — separate `@QuarkusTest` class with a `@QuarkusTestProfile` that activates an alternative `@ApplicationScoped EventStore` producer, verify the `@DefaultBean` default is displaced

### BroadcastIntegrationTest (@QuarkusTest)

5. **Broadcast delivers to subscribed connections** — register connections via TopicRegistry, broadcast, verify `TestPushConfig.sent()` contains the wire messages
6. **Broadcast with no connections succeeds** — broadcast to an empty topic, verify no error and event is stored
7. **Wildcard subscription delivery** — register a wildcard listener, broadcast to a matching concrete topic, verify delivery via `TestPushConfig.sent()`
8. **Replay after broadcast** — broadcast events, verify EventStore contains them with correct sequence numbers
9. **Broadcast rejects wildcard topic** — attempt to broadcast to a wildcard topic, verify IllegalArgumentException

## What This Does NOT Cover

- Cross-node distribution (no Postgres LISTEN/NOTIFY — pages-push is single-node) — tracked as #147
- WebSocket endpoint implementation (consumer responsibility)
- PushRequest handling (listen/unlisten protocol parsing — consumer wires this to TopicRegistry)
- REST adapter module (no HTTP endpoints exposed by this module)
