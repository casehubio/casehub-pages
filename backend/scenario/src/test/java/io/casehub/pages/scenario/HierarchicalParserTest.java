package io.casehub.pages.scenario;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class HierarchicalParserTest {

    @Test
    void parseFlatSteps() {
        var yaml = """
            scenario: quick-test
            steps:
              - label: "Do thing"
                target: browser
                commands:
                  - action: click
                    target: {role: button, name: Submit}
            """;
        var scenario = HierarchicalParser.parse(yaml);
        assertThat(scenario.scenario()).isEqualTo("quick-test");
        assertThat(scenario.steps()).hasSize(1);
        assertThat(scenario.chapters()).isNull();
        assertThat(scenario.sections()).isNull();
        var step = scenario.steps().getFirst();
        assertThat(step.label()).isEqualTo("Do thing");
        assertThat(step.target()).isEqualTo("browser");
        assertThat(step.commands()).hasSize(1);
        assertThat(step.commands().getFirst().action()).isEqualTo("click");
    }

    @Test
    void parseSections() {
        var yaml = """
            scenario: sectioned
            sections:
              - label: "Setup"
                steps:
                  - label: "Create ticket"
                    target: helpdesk
                    commands:
                      - action: create-ticket
                        data: {subject: Test}
            """;
        var scenario = HierarchicalParser.parse(yaml);
        assertThat(scenario.sections()).hasSize(1);
        assertThat(scenario.sections().getFirst().label()).isEqualTo("Setup");
        assertThat(scenario.sections().getFirst().steps()).hasSize(1);
    }

    @Test
    void parseChapters() {
        var yaml = """
            scenario: full-demo
            speed: 0.5
            on-error: pause
            chapters:
              - label: "Customer Reports"
                sections:
                  - label: "Send message"
                    steps:
                      - label: "Submit form"
                        target: browser
                        commands:
                          - action: fill
                            target: {role: textbox, name: Subject}
                            value: "Laptop broken"
                          - action: click
                            target: {role: button, name: Submit}
              - label: "Resolution"
                sections:
                  - label: "Specialist fixes"
                    steps:
                      - label: "Resolve"
                        target: helpdesk
                        commands:
                          - action: resolve-ticket
                            data: {resolution: "Fixed"}
            """;
        var scenario = HierarchicalParser.parse(yaml);
        assertThat(scenario.speed()).isEqualTo(0.5);
        assertThat(scenario.onError()).isEqualTo("pause");
        assertThat(scenario.chapters()).hasSize(2);
        assertThat(scenario.chapters().getFirst().label()).isEqualTo("Customer Reports");
        assertThat(scenario.allSteps().count()).isEqualTo(2);
    }

    @Test
    void parseTrigger() {
        var yaml = """
            scenario: triggered
            steps:
              - label: "First"
                name: first-step
                target: helpdesk
                commands:
                  - action: create-ticket
              - label: "Second"
                target: helpdesk
                trigger: {after: first-step, delay: 2000}
                commands:
                  - action: verify-ticket
                    await: {match: {status: TRIAGED}}
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var second = scenario.steps().get(1);
        assertThat(second.trigger()).isInstanceOf(Trigger.AfterTrigger.class);
        var trigger = (Trigger.AfterTrigger) second.trigger();
        assertThat(trigger.step()).isEqualTo("first-step");
        assertThat(trigger.delayMs()).isEqualTo(2000);
    }

    @Test
    void parseCommandWithAwait() {
        var yaml = """
            scenario: awaiting
            steps:
              - label: "Verify"
                target: helpdesk
                commands:
                  - action: verify-ticket
                    await:
                      match: {status: TRIAGED, category: HARDWARE}
                      timeout: 5000
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var cmd = scenario.steps().getFirst().commands().getFirst();
        assertThat(cmd.await()).isNotNull();
        assertThat(cmd.await().match()).containsEntry("status", "TRIAGED");
    }

    @Test
    void parseAriaTarget() {
        var yaml = """
            scenario: aria-test
            steps:
              - label: "Click nested"
                target: browser
                commands:
                  - action: click
                    target:
                      role: button
                      name: Submit
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var cmd = scenario.steps().getFirst().commands().getFirst();
        assertThat(cmd.target()).isNotNull();
        assertThat(cmd.target().role()).isEqualTo("button");
        assertThat(cmd.target().name()).isEqualTo("Submit");
    }

    @Test
    void parseDataSection() {
        var yaml = """
            scenario: with-data
            data:
              classifications:
                - match: "laptop"
                  category: HARDWARE
            steps:
              - label: "Seed"
                target: helpdesk
                commands:
                  - action: seed
            """;
        var scenario = HierarchicalParser.parse(yaml);
        assertThat(scenario.data()).containsKey("classifications");
    }

    @Test
    void defaultSpeedIsOne() {
        var yaml = """
            scenario: defaults
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """;
        var scenario = HierarchicalParser.parse(yaml);
        assertThat(scenario.speed()).isEqualTo(1.0);
    }

    @Test
    void parseTimeTrigger() {
        var yaml = """
            scenario: timed
            steps:
              - label: "Delayed"
                target: browser
                trigger: {at: 5000}
                commands:
                  - action: ready
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var step = scenario.steps().getFirst();
        assertThat(step.trigger()).isInstanceOf(Trigger.TimeTrigger.class);
        assertThat(((Trigger.TimeTrigger) step.trigger()).atMs()).isEqualTo(5000);
    }

    @Test
    void parseDataTrigger() {
        var yaml = """
            scenario: data-triggered
            steps:
              - label: "Wait for data"
                target: browser
                trigger:
                  when:
                    endpoint: "/api/status"
                    match: {ready: true}
                    poll: 500
                commands:
                  - action: ready
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var step = scenario.steps().getFirst();
        assertThat(step.trigger()).isInstanceOf(Trigger.DataTrigger.class);
        var trigger = (Trigger.DataTrigger) step.trigger();
        assertThat(trigger.endpoint()).isEqualTo("/api/status");
        assertThat(trigger.match()).containsEntry("ready", true);
        assertThat(trigger.pollMs()).isEqualTo(500);
    }

    @Test
    void parseCommandWithValue() {
        var yaml = """
            scenario: fill-test
            steps:
              - label: "Fill field"
                target: browser
                commands:
                  - action: fill
                    target: {role: textbox, name: Subject}
                    value: "Laptop broken"
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var cmd = scenario.steps().getFirst().commands().getFirst();
        assertThat(cmd.action()).isEqualTo("fill");
        assertThat(cmd.value()).isEqualTo("Laptop broken");
        assertThat(cmd.target().role()).isEqualTo("textbox");
    }

    @Test
    void parseStepWithActor() {
        var yaml = """
            scenario: actor-test
            steps:
              - label: "Admin action"
                target: helpdesk
                actor: hw-specialist
                commands:
                  - action: resolve-ticket
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var step = scenario.steps().getFirst();
        assertThat(step.actor()).isEqualTo("hw-specialist");
    }

    @Test
    void parseNavigateCommand() {
        var yaml = """
            scenario: nav-test
            steps:
              - label: "Go to support"
                target: browser
                commands:
                  - action: navigate
                    value: "#support"
            """;
        var scenario = HierarchicalParser.parse(yaml);
        var cmd = scenario.steps().getFirst().commands().getFirst();
        assertThat(cmd.action()).isEqualTo("navigate");
        assertThat(cmd.value()).isEqualTo("#support");
    }

    @Test
    void rejectsEmptyScenarioName() {
        var yaml = """
            scenario: ""
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """;
        assertThatThrownBy(() -> HierarchicalParser.parse(yaml))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsMissingScenarioName() {
        var yaml = """
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """;
        assertThatThrownBy(() -> HierarchicalParser.parse(yaml))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsMutuallyExclusiveTopLevelKeys() {
        var yaml = """
            scenario: bad
            chapters:
              - label: "Ch"
                sections:
                  - label: "Sec"
                    steps:
                      - label: "S"
                        target: browser
                        commands:
                          - action: ready
            steps:
              - label: "Direct"
                target: browser
                commands:
                  - action: ready
            """;
        assertThatThrownBy(() -> HierarchicalParser.parse(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("mutually exclusive");
    }
}
