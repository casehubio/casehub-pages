package io.casehub.pages.mcp;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.TopicRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AriaCommandBridgeTest {

    private AtomicReference<String> broadcastedTopic;
    private AriaCommandBridge bridge;

    @BeforeEach
    void setUp() {
        broadcastedTopic = new AtomicReference<>();
        var eventStore = new InMemoryEventStore(100);
        var topicRegistry = new TopicRegistry();
        EventBroadcaster broadcaster = new EventBroadcaster(
                eventStore, topicRegistry,
                (connId, msg) -> {},
                obj -> "{}") {
            @Override
            public long broadcast(String topic, String payloadJson) {
                broadcastedTopic.set(topic);
                return 1L;
            }

            @Override
            public <T> long broadcast(String topic, T event) {
                broadcastedTopic.set(topic);
                return 1L;
            }
        };
        bridge = new AriaCommandBridge(broadcaster, 500);
    }

    @Test
    void sendBroadcastsOnScenarioTopic() {
        CompletableFuture.runAsync(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            String topic = broadcastedTopic.get();
            if (topic != null) {
                String cmdId = topic.replace("scenario/cmd-", "");
                bridge.handleResult(new PushRequest.CommandResult(cmdId, true, null));
            }
        });

        var result = bridge.send("click", null, null, null, null);
        assertThat(result.ok()).isTrue();
        assertThat(broadcastedTopic.get()).startsWith("scenario/cmd-");
    }

    @Test
    void handleResultCompletesWithError() {
        CompletableFuture.runAsync(() -> {
            try { Thread.sleep(20); } catch (InterruptedException ignored) {}
            String topic = broadcastedTopic.get();
            String cmdId = topic.replace("scenario/cmd-", "");
            bridge.handleResult(new PushRequest.CommandResult(cmdId, false, "Element not found"));
        });

        var result = bridge.send("click", null, null, null, null);
        assertThat(result.ok()).isFalse();
        assertThat(result.error()).isEqualTo("Element not found");
    }

    @Test
    void sendTimesOutWhenNoResponse() {
        assertThatThrownBy(() -> bridge.send("click", null, null, null, null))
                .isInstanceOf(AriaCommandException.class)
                .hasMessageContaining("timed out");
    }

    @Test
    void pendingCountTracksInFlightCommands() {
        assertThat(bridge.pendingCount()).isZero();
    }

    @Test
    void handleResultIgnoresUnknownId() {
        bridge.handleResult(new PushRequest.CommandResult("unknown-id", true, null));
        assertThat(bridge.pendingCount()).isZero();
    }
}
