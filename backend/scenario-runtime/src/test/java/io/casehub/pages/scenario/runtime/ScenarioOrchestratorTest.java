package io.casehub.pages.scenario.runtime;

import io.casehub.pages.push.PushRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ScenarioOrchestratorTest {

    record SentMessage(String connectionId, String message) {}

    private List<SentMessage> createCapture() {
        return new ArrayList<>();
    }

    @Test
    void startDispatchesSequenceToRegisteredExecutor() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser",
                List.of("click", "fill", "navigate")));

        var yaml = """
            scenario: test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        orchestrator.start(yaml);

        assertThat(sent).isNotEmpty();
        assertThat(sent.getFirst().connectionId()).isEqualTo("conn-1");
        assertThat(sent.getFirst().message()).contains("dispatch-sequence");
    }

    @Test
    void startRequiresRegisteredExecutor() {
        var orchestrator = new ScenarioOrchestrator((c, m) -> {});

        var yaml = """
            scenario: test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        assertThatThrownBy(() -> orchestrator.start(yaml))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("browser");
    }

    @Test
    void stateReflectsScenarioProgress() {
        var orchestrator = new ScenarioOrchestrator((c, m) -> {});

        assertThat(orchestrator.state().scenario()).isNull();

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "helpdesk",
                List.of("create-ticket")));

        var yaml = """
            scenario: progress-test
            steps:
              - label: "Create"
                target: helpdesk
                commands:
                  - action: create-ticket
              - label: "Verify"
                target: helpdesk
                commands:
                  - action: verify-ticket
            """;
        orchestrator.start(yaml);

        var state = orchestrator.state();
        assertThat(state.scenario()).isEqualTo("progress-test");
        assertThat(state.progress()).isEqualTo(0.0);
        assertThat(state.paused()).isFalse();
    }

    @Test
    void stepResultAdvancesProgress() {
        var orchestrator = new ScenarioOrchestrator((c, m) -> {});

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "helpdesk",
                List.of("create-ticket", "verify-ticket")));

        var yaml = """
            scenario: progress-test
            steps:
              - label: "Create"
                target: helpdesk
                commands:
                  - action: create-ticket
              - label: "Verify"
                target: helpdesk
                commands:
                  - action: verify-ticket
            """;
        orchestrator.start(yaml);
        String sessionId = orchestrator.state().scenario() != null
            ? orchestrator.sessionId() : null;
        assertThat(sessionId).isNotNull();

        orchestrator.onStepResult(new PushRequest.StepResult(
            "r1", sessionId, "Create", true, null, Map.of()));

        assertThat(orchestrator.state().progress()).isEqualTo(0.5);

        orchestrator.onStepResult(new PushRequest.StepResult(
            "r2", sessionId, "Verify", true, null, Map.of()));

        assertThat(orchestrator.state().progress()).isEqualTo(1.0);
    }

    @Test
    void pauseSendsControlToAllExecutors() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click")));
        orchestrator.onExecutorRegister("conn-2",
            new PushRequest.ExecutorRegister("2", "helpdesk",
                List.of("create-ticket")));

        var yaml = """
            scenario: control-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
              - label: "Create"
                target: helpdesk
                commands:
                  - action: create-ticket
            """;
        orchestrator.start(yaml);
        sent.clear();

        orchestrator.pause();

        assertThat(sent).hasSize(2);
        assertThat(sent).allSatisfy(s ->
            assertThat(s.message()).contains("executor-control")
                .contains("pause"));
        assertThat(orchestrator.state().paused()).isTrue();
    }

    @Test
    void resumeAfterPause() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click")));

        orchestrator.start("""
            scenario: resume-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """);

        orchestrator.pause();
        assertThat(orchestrator.state().paused()).isTrue();

        sent.clear();
        orchestrator.resume();

        assertThat(orchestrator.state().paused()).isFalse();
        assertThat(sent).anyMatch(s -> s.message().contains("resume"));
    }

    @Test
    void speedChangesSendsControl() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click")));

        orchestrator.start("""
            scenario: speed-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """);
        sent.clear();

        orchestrator.speed(2.0);

        assertThat(orchestrator.state().speed()).isEqualTo(2.0);
        assertThat(sent).anyMatch(s -> s.message().contains("speed")
            && s.message().contains("2.0"));
    }

    @Test
    void multipleExecutorsReceiveCorrectSequences() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-browser",
            new PushRequest.ExecutorRegister("1", "browser",
                List.of("click", "fill")));
        orchestrator.onExecutorRegister("conn-helpdesk",
            new PushRequest.ExecutorRegister("2", "helpdesk",
                List.of("create-ticket")));

        var yaml = """
            scenario: multi-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
              - label: "Create"
                target: helpdesk
                commands:
                  - action: create-ticket
            """;
        orchestrator.start(yaml);

        var browserMessages = sent.stream()
            .filter(s -> "conn-browser".equals(s.connectionId()))
            .filter(s -> s.message().contains("dispatch-sequence"))
            .toList();
        var helpdeskMessages = sent.stream()
            .filter(s -> "conn-helpdesk".equals(s.connectionId()))
            .filter(s -> s.message().contains("dispatch-sequence"))
            .toList();

        assertThat(browserMessages).hasSize(1);
        assertThat(helpdeskMessages).hasSize(1);
        assertThat(browserMessages.getFirst().message()).contains("click");
        assertThat(helpdeskMessages.getFirst().message()).contains("create-ticket");
    }

    @Test
    void stepCommandDispatchesStepControl() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click")));

        orchestrator.start("""
            scenario: step-test
            steps:
              - label: "A"
                target: browser
                commands:
                  - action: click
              - label: "B"
                target: browser
                commands:
                  - action: click
            """);
        orchestrator.pause();
        sent.clear();

        orchestrator.step();

        assertThat(sent).anyMatch(s -> s.message().contains("step"));
    }

    @Test
    void sectionBasedScenarioDispatches() {
        var sent = createCapture();
        var orchestrator = new ScenarioOrchestrator(
            (connId, msg) -> sent.add(new SentMessage(connId, msg)));

        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click")));
        orchestrator.onExecutorRegister("conn-2",
            new PushRequest.ExecutorRegister("2", "helpdesk",
                List.of("create-ticket")));

        var yaml = """
            scenario: section-test
            sections:
              - label: "Submit"
                steps:
                  - label: "Click button"
                    target: browser
                    commands:
                      - action: click
              - label: "Process"
                steps:
                  - label: "Create ticket"
                    target: helpdesk
                    commands:
                      - action: create-ticket
            """;
        orchestrator.start(yaml);

        assertThat(orchestrator.state().scenario()).isEqualTo("section-test");
        var dispatches = sent.stream()
            .filter(s -> s.message().contains("dispatch-sequence"))
            .toList();
        assertThat(dispatches).hasSizeGreaterThanOrEqualTo(1);
    }
}
