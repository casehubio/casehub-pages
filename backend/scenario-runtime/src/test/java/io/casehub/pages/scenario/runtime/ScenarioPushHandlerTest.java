package io.casehub.pages.scenario.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.TopicRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ScenarioPushHandlerTest {

    private ScenarioOrchestrator orchestrator;
    private ScenarioPushHandler handler;

    @BeforeEach
    void setUp() {
        var broadcaster = new EventBroadcaster(
            new InMemoryEventStore(10), new TopicRegistry(),
            (id, msg) -> {}, obj -> "{}");
        orchestrator = new ScenarioOrchestrator((id, msg) -> {}, broadcaster);
        handler = new ScenarioPushHandler(orchestrator);
    }

    @Test
    void handlesExecutorRegister() {
        var reg = new PushRequest.ExecutorRegister("1", "helpdesk",
            List.of("create-ticket"));
        assertThat(handler.handles(reg)).isTrue();
    }

    @Test
    void handlesStepResult() {
        var result = new PushRequest.StepResult("1", "s-1", "step-1",
            true, null, Map.of());
        assertThat(handler.handles(result)).isTrue();
    }

    @Test
    void doesNotHandleListen() {
        var listen = new PushRequest.Listen("1", List.of("topic"),
            Map.of());
        assertThat(handler.handles(listen)).isFalse();
    }

    @Test
    void handleDelegatesExecutorRegisterToOrchestrator() {
        var reg = new PushRequest.ExecutorRegister("1", "browser",
            List.of("click"));
        handler.handle("conn-1", reg);

        var yaml = """
            scenario: test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        assertThatCode(() -> orchestrator.start(yaml))
            .doesNotThrowAnyException();
    }

    @Test
    void handleDelegatesStepResultToOrchestrator() {
        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser",
                List.of("click")));
        var yaml = """
            scenario: test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        orchestrator.start(yaml);

        var result = new PushRequest.StepResult("2",
            orchestrator.sessionId(), "Click",
            true, null, Map.of());
        handler.handle("conn-1", result);

        assertThat(orchestrator.state().progress()).isEqualTo(1.0);
    }
}
