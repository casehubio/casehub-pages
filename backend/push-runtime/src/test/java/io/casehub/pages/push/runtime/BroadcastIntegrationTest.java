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
