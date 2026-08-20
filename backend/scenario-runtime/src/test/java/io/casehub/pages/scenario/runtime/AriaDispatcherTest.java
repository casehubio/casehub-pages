package io.casehub.pages.scenario.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.TopicRegistry;
import io.casehub.pages.scenario.AriaTarget;
import io.casehub.pages.scenario.ScenarioStep;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AriaDispatcherTest {

    private AtomicReference<String> capturedTopic;
    private AtomicReference<Object> capturedPayload;
    private AriaDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        capturedTopic = new AtomicReference<>();
        capturedPayload = new AtomicReference<>();
        var broadcaster = new EventBroadcaster(
                new InMemoryEventStore(100),
                new TopicRegistry(),
                (connId, msg) -> {},
                obj -> "{}") {
            @Override
            public <T> long broadcast(String topic, T event) {
                capturedTopic.set(topic);
                capturedPayload.set(event);
                return 1L;
            }
        };
        dispatcher = new AriaDispatcher(broadcaster, 500);
    }

    @Test
    void sendBroadcastsOnScenarioExecTopic() {
        var step = new ScenarioStep.AriaStep(
                "click-btn", "click",
                new AriaTarget("button", "Submit"),
                null, null, null);

        Thread.ofVirtual().start(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            var payload = capturedPayload.get();
            if (payload instanceof AriaDispatcher.CommandPayload cmd) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), true, null));
            }
        });

        dispatcher.send(step);
        assertThat(capturedTopic.get()).isEqualTo("scenario:exec");
    }

    @Test
    void sendCorrelatesResponseById() {
        var step = new ScenarioStep.AriaStep(
                "click-btn", "click",
                new AriaTarget("button", "Submit"),
                null, null, null);

        Thread.ofVirtual().start(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            var payload = capturedPayload.get();
            if (payload instanceof AriaDispatcher.CommandPayload cmd) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), true, null,
                                Map.of("clicked", "true")));
            }
        });

        var result = dispatcher.send(step);
        assertThat(result.ok()).isTrue();
        assertThat(result.result()).containsEntry("clicked", "true");
    }

    @Test
    void sendTimesOutWhenNoResponse() {
        var step = new ScenarioStep.AriaStep(
                "click-btn", "click",
                new AriaTarget("button", "Submit"),
                null, null, null);

        assertThatThrownBy(() -> dispatcher.send(step))
                .isInstanceOf(AriaCommandException.class)
                .hasMessageContaining("timed out");
    }

    @Test
    void sendPropagatesBrowserError() {
        var step = new ScenarioStep.AriaStep(
                "click-btn", "click",
                new AriaTarget("button", "Submit"),
                null, null, null);

        Thread.ofVirtual().start(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            var payload = capturedPayload.get();
            if (payload instanceof AriaDispatcher.CommandPayload cmd) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), false, "Element not found"));
            }
        });

        assertThatThrownBy(() -> dispatcher.send(step))
                .isInstanceOf(AriaCommandException.class)
                .hasMessageContaining("Element not found");
    }

    @Test
    void onCommandResultIgnoresUnknownId() {
        dispatcher.onCommandResult(
                new PushRequest.CommandResult("unknown-id", true, null));
        assertThat(dispatcher.pendingCount()).isZero();
    }

    @Test
    void navigateWaitsForReadyProbe() {
        var step = new ScenarioStep.AriaStep(
                "nav", "navigate", null, "/helpdesk/intake", null, null);

        Thread.ofVirtual().start(() -> {
            try { Thread.sleep(30); } catch (InterruptedException ignored) {}
            // Respond to navigate
            var navPayload = capturedPayload.get();
            if (navPayload instanceof AriaDispatcher.CommandPayload cmd) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), true, null));
            }
            // Wait for ready probe, then respond
            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            var probePayload = capturedPayload.get();
            if (probePayload instanceof AriaDispatcher.CommandPayload cmd
                    && "ready".equals(cmd.action())) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), true, null));
            }
        });

        var result = dispatcher.send(step);
        assertThat(result.ok()).isTrue();
    }

    @Test
    void sendBatchReturnsOneResult() {
        var steps = List.of(
                new ScenarioStep.AriaStep(null, "click",
                        new AriaTarget("button", "A"), null, null, null),
                new ScenarioStep.AriaStep(null, "fill",
                        new AriaTarget("textbox", "Name"), "Alice", null, null));

        Thread.ofVirtual().start(() -> {
            try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            var payload = capturedPayload.get();
            if (payload instanceof AriaDispatcher.CommandPayload cmd) {
                dispatcher.onCommandResult(
                        new PushRequest.CommandResult(cmd.id(), true, null));
            }
        });

        var result = dispatcher.sendBatch(steps);
        assertThat(result.ok()).isTrue();
    }
}
