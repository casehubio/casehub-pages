package io.casehub.pages.mcp;

import io.casehub.pages.push.PushRequest;
import io.casehub.pages.scenario.runtime.ScenarioOrchestrator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class ScenarioResolverTest {

    private ScenarioOrchestrator orchestrator;
    private ScenarioResolver resolver;

    @BeforeEach
    void setUp() {
        var sent = new ArrayList<String>();
        orchestrator = new ScenarioOrchestrator((connId, msg) -> sent.add(msg));
        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click", "ready")));
        orchestrator.onExecutorRegister("conn-2",
            new PushRequest.ExecutorRegister("2", "helpdesk",
                List.of("create-ticket", "verify-ticket")));

        resolver = new ScenarioResolver();
        try {
            var field = ScenarioResolver.class.getDeclaredField("orchestrator");
            field.setAccessible(true);
            field.set(resolver, orchestrator);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void submitStartsScenarioAndReturnsState() {
        var yaml = """
            scenario: mcp-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        var state = resolver.submit(yaml);
        assertThat(state.scenario()).isEqualTo("mcp-test");
        assertThat(state.progress()).isEqualTo(0.0);
    }

    @Test
    void statusReturnsCurrentState() {
        var state = resolver.status();
        assertThat(state.scenario()).isNull();

        resolver.submit("""
            scenario: status-test
            steps:
              - label: "Ready"
                target: browser
                commands:
                  - action: ready
            """);

        state = resolver.status();
        assertThat(state.scenario()).isEqualTo("status-test");
    }

    @Test
    void pauseAndResumeToggleState() {
        resolver.submit("""
            scenario: pause-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """);

        var paused = resolver.pause();
        assertThat(paused.paused()).isTrue();

        var resumed = resolver.resume();
        assertThat(resumed.paused()).isFalse();
    }

    @Test
    void speedChangesState() {
        resolver.submit("""
            scenario: speed-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """);

        var state = resolver.speed(2.0);
        assertThat(state.speed()).isEqualTo(2.0);
    }

    @Test
    void runToWithUnknownLabelThrows() {
        resolver.submit("""
            scenario: runTo-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """);

        assertThatThrownBy(() -> resolver.runTo("nonexistent"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not found");
    }

    @Test
    void stepSendsControlMessage() {
        resolver.submit("""
            scenario: step-test
            steps:
              - label: "A"
                target: browser
                commands:
                  - action: ready
              - label: "B"
                target: browser
                commands:
                  - action: ready
            """);

        resolver.pause();
        var state = resolver.step();
        assertThat(state.scenario()).isEqualTo("step-test");
    }
}
