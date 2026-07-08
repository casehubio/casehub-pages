# Push Runtime CDI Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #136 — feat: CDI/Quarkus integration for EventBroadcaster
**Issue group:** #136

**Goal:** Create a `casehub-pages-push-runtime` module that makes `EventBroadcaster`, `TopicRegistry`, and `EventStore` injectable in Quarkus applications.

**Architecture:** Single producer class (`PushProducers`) creates CDI beans from the pure-Java `casehub-pages-push` SDK types. `@DefaultBean` on `EventStore` allows consumer override. Consumer must provide `SessionSender` (gateway pattern).

**Tech Stack:** Java 21, Quarkus Arc (CDI), MicroProfile Config, JUnit 5 via `quarkus-junit`, AssertJ

## Global Constraints

- `casehub-pages-push` stays pure Java — no CDI annotations added to it
- `casehub-pages-push-runtime` depends on `quarkus-arc` and `casehub-pages-push`
- Package: `io.casehub.pages.push.runtime`
- Config namespace: `casehub.pages.push.*`
- Parent version: `0.2-SNAPSHOT`

---

### Task 1: Module scaffold + PushProducers + CDI wiring tests

**Files:**
- Create: `backend/push-runtime/pom.xml`
- Modify: `backend/pom.xml` (modules list + dependencyManagement)
- Create: `backend/push-runtime/src/main/java/io/casehub/pages/push/runtime/PushProducers.java`
- Create: `backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/TestPushConfig.java`
- Test: `backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/PushProducersTest.java`
- Test: `backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/CustomCapacityTest.java`
- Test: `backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/EventStoreOverrideTest.java`

**Interfaces:**
- Consumes: `io.casehub.pages.push.EventBroadcaster(EventStore, TopicRegistry, SessionSender)`, `io.casehub.pages.push.TopicRegistry()`, `io.casehub.pages.push.InMemoryEventStore(int)`, `io.casehub.pages.push.SessionSender` (functional interface)
- Produces: CDI beans `EventBroadcaster`, `TopicRegistry`, `EventStore` injectable via `@Inject`

- [ ] **Step 1: Create `backend/push-runtime/pom.xml`**

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
            <plugin>
                <groupId>io.quarkus</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>${quarkus.platform.version}</version>
                <extensions>true</extensions>
                <executions>
                    <execution>
                        <goals><goal>build</goal></goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: Update `backend/pom.xml` — add module and dependency management**

Add `<module>push-runtime</module>` to the modules list (after `push`).

Add both push artifacts to `<dependencyManagement>`:

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

- [ ] **Step 3: Build scaffold to verify it compiles**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml -pl push-runtime compile`
Expected: BUILD SUCCESS (empty module, no sources yet)

- [ ] **Step 4: Create test infrastructure — `TestPushConfig.java`**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.SessionSender;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@ApplicationScoped
public class TestPushConfig {

    private final List<SentMessage> sent = new CopyOnWriteArrayList<>();

    @Produces
    @ApplicationScoped
    SessionSender sessionSender() {
        return (connectionId, message) -> sent.add(new SentMessage(connectionId, message));
    }

    public List<SentMessage> sent() {
        return List.copyOf(sent);
    }

    public void clear() {
        sent.clear();
    }

    public record SentMessage(String connectionId, String message) {}
}
```

- [ ] **Step 5: Write failing test — all beans resolvable + default capacity**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class PushProducersTest {

    @Inject EventBroadcaster broadcaster;
    @Inject TopicRegistry topicRegistry;
    @Inject EventStore eventStore;

    @Test
    void all_beans_are_resolvable() {
        assertThat(broadcaster).isNotNull();
        assertThat(topicRegistry).isNotNull();
        assertThat(eventStore).isNotNull();
    }

    @Test
    void default_event_store_is_in_memory_with_capacity_1000() {
        assertThat(eventStore).isInstanceOf(InMemoryEventStore.class);
        for (int i = 0; i < 1001; i++) {
            eventStore.append("capacity-test", "{\"i\":" + i + "}");
        }
        assertThat(eventStore.replay("capacity-test", 0)).hasSize(1000);
    }
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml -pl push-runtime test`
Expected: FAIL — `PushProducers` class does not exist, CDI cannot satisfy dependencies

- [ ] **Step 7: Create `PushProducers.java`**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.SessionSender;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

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

- [ ] **Step 8: Run tests to verify they pass**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml -pl push-runtime test`
Expected: 2 tests PASS

- [ ] **Step 9: Write custom capacity test**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(CustomCapacityTest.Profile.class)
class CustomCapacityTest {

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("casehub.pages.push.max-events-per-topic", "50");
        }
    }

    @Inject EventStore eventStore;

    @Test
    void custom_capacity_is_respected() {
        for (int i = 0; i < 60; i++) {
            eventStore.append("cap-test", "{\"i\":" + i + "}");
        }
        assertThat(eventStore.replay("cap-test", 0)).hasSize(50);
    }
}
```

- [ ] **Step 10: Write EventStore override test**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(EventStoreOverrideTest.Profile.class)
class EventStoreOverrideTest {

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Set<Class<?>> getEnabledAlternatives() {
            return Set.of(AlternativeEventStoreProducer.class);
        }
    }

    @ApplicationScoped
    public static class AlternativeEventStoreProducer {
        @Produces
        @ApplicationScoped
        EventStore eventStore() {
            return new StubEventStore();
        }
    }

    static class StubEventStore implements EventStore {
        @Override
        public long append(String topic, String payloadJson) {
            return -1;
        }

        @Override
        public List<StoredEvent> replay(String topic, long sinceSeq) {
            return List.of();
        }

        @Override
        public Set<String> topics() {
            return Set.of();
        }
    }

    @Inject EventStore eventStore;

    @Test
    void alternative_event_store_displaces_default() {
        assertThat(eventStore).isInstanceOf(StubEventStore.class);
        assertThat(eventStore.append("t", "{}")).isEqualTo(-1);
    }
}
```

- [ ] **Step 11: Run all tests to verify they pass**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml -pl push-runtime test`
Expected: 4 tests PASS across 3 test classes

- [ ] **Step 12: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add backend/push-runtime/ backend/pom.xml
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: add casehub-pages-push-runtime CDI module with producer tests

Refs #136"
```

---

### Task 2: Broadcast integration tests

**Files:**
- Test: `backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/BroadcastIntegrationTest.java`

**Interfaces:**
- Consumes: CDI beans from Task 1 (`EventBroadcaster`, `TopicRegistry`, `EventStore`), `TestPushConfig` from Task 1

- [ ] **Step 1: Write broadcast integration tests**

```java
package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@QuarkusTest
class BroadcastIntegrationTest {

    @Inject EventBroadcaster broadcaster;
    @Inject TopicRegistry topicRegistry;
    @Inject EventStore eventStore;
    @Inject TestPushConfig testConfig;

    @BeforeEach
    void setUp() {
        testConfig.clear();
    }

    @Test
    void broadcast_delivers_to_subscribed_connections() {
        topicRegistry.listen("conn-1", List.of("debate:abc"));
        topicRegistry.listen("conn-2", List.of("debate:abc"));

        broadcaster.broadcast("debate:abc", "{\"text\":\"hello\"}");

        assertThat(testConfig.sent()).hasSize(2);
        for (var msg : testConfig.sent()) {
            assertThat(msg.message()).contains("\"op\":\"event\"");
            assertThat(msg.message()).contains("\"topic\":\"debate:abc\"");
            assertThat(msg.message()).contains("\"seq\":1");
        }
    }

    @Test
    void broadcast_with_no_connections_succeeds() {
        long seq = broadcaster.broadcast("nobody:listens", "{\"x\":1}");

        assertThat(seq).isEqualTo(1);
        assertThat(testConfig.sent()).isEmpty();
        assertThat(eventStore.replay("nobody:listens", 0)).hasSize(1);
    }

    @Test
    void wildcard_subscription_receives_broadcast() {
        topicRegistry.listen("wc-conn", List.of("metrics:*:cpu"));

        broadcaster.broadcast("metrics:server1:cpu", "{\"load\":0.5}");

        assertThat(testConfig.sent()).hasSize(1);
        assertThat(testConfig.sent().getFirst().connectionId()).isEqualTo("wc-conn");
        assertThat(testConfig.sent().getFirst().message()).contains("\"topic\":\"metrics:server1:cpu\"");
    }

    @Test
    void broadcast_events_are_replayable_from_store() {
        broadcaster.broadcast("t", "{\"v\":1}");
        broadcaster.broadcast("t", "{\"v\":2}");

        List<StoredEvent> replayed = eventStore.replay("t", 0);
        assertThat(replayed).hasSize(2);
        assertThat(replayed.get(0).seq()).isEqualTo(1);
        assertThat(replayed.get(1).seq()).isEqualTo(2);
        assertThat(replayed.get(0).payloadJson()).isEqualTo("{\"v\":1}");
    }

    @Test
    void broadcast_rejects_wildcard_topic() {
        assertThatThrownBy(() -> broadcaster.broadcast("notification:**", "{}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("wildcard");
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml -pl push-runtime test`
Expected: 9 tests PASS across 4 test classes

- [ ] **Step 3: Run full backend build to verify no cross-module issues**

Run: `/opt/homebrew/bin/mvn -f backend/pom.xml clean install`
Expected: BUILD SUCCESS — all 7 modules build (auth, layout, layout-sqlite, data, data-sql, push, push-runtime)

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add backend/push-runtime/src/test/java/io/casehub/pages/push/runtime/BroadcastIntegrationTest.java
git -C /Users/mdproctor/claude/casehub/pages commit -m "test: broadcast integration tests for push-runtime CDI wiring

Refs #136"
```
