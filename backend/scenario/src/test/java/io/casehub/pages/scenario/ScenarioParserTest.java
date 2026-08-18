package io.casehub.pages.scenario;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScenarioParserTest {

    @Test
    void parsesHelpdeskIntakeScenario() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));

        assertThat(scenario.scenario()).isEqualTo("helpdesk-intake");
        assertThat(scenario.steps()).hasSize(7);
    }

    @Test
    void parsesNavigateStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(0);

        assertThat(step.action()).isEqualTo("navigate");
        assertThat(step.value()).isEqualTo("/helpdesk/intake");
        assertThat(step.target()).isNull();
    }

    @Test
    void parsesFillStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(1);

        assertThat(step.action()).isEqualTo("fill");
        assertThat(step.target()).isNotNull();
        assertThat(step.target().role()).isEqualTo("textbox");
        assertThat(step.target().name()).isEqualTo("Customer Name");
        assertThat(step.value()).isEqualTo("Alice Chen");
    }

    @Test
    void parsesSelectStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(3);

        assertThat(step.action()).isEqualTo("select");
        assertThat(step.target().role()).isEqualTo("combobox");
        assertThat(step.target().name()).isEqualTo("Priority");
        assertThat(step.value()).isEqualTo("High");
    }

    @Test
    void parsesClickStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(4);

        assertThat(step.action()).isEqualTo("click");
        assertThat(step.target().role()).isEqualTo("button");
        assertThat(step.target().name()).isEqualTo("Submit");
        assertThat(step.value()).isNull();
    }

    @Test
    void parsesAssertStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(5);

        assertThat(step.action()).isEqualTo("assert");
        assertThat(step.target().role()).isEqualTo("alert");
        assertThat(step.target().name()).isEqualTo("Submission confirmation");
        assertThat(step.state()).containsEntry("aria-hidden", false);
    }

    @Test
    void parsesWaitStep() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        ScenarioStep step = scenario.steps().get(6);

        assertThat(step.action()).isEqualTo("wait");
        assertThat(step.target().role()).isEqualTo("button");
        assertThat(step.target().name()).isEqualTo("Submit");
        assertThat(step.state()).containsEntry("aria-busy", false);
        assertThat(step.timeout()).isEqualTo(5000);
    }

    @Test
    void parsesWithinScoping() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("scoped-delete.yaml"));
        ScenarioStep step = scenario.steps().get(0);

        assertThat(step.action()).isEqualTo("click");
        assertThat(step.target().role()).isEqualTo("button");
        assertThat(step.target().name()).isEqualTo("Delete");
        assertThat(step.target().within()).isNotNull();
        assertThat(step.target().within().role()).isEqualTo("row");
        assertThat(step.target().within().name()).isEqualTo("Case #42");
        assertThat(step.target().within().within()).isNull();
    }

    @Test
    void rejectsMissingScenarioName() {
        assertThatThrownBy(() -> ScenarioParser.parse("steps:\n  - navigate: /foo"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("scenario");
    }

    @Test
    void rejectsMissingSteps() {
        assertThatThrownBy(() -> ScenarioParser.parse("scenario: test"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("steps");
    }

    @Test
    void rejectsUnknownAction() {
        String yaml = "scenario: test\nsteps:\n  - hover:\n      role: button\n      name: X";
        assertThatThrownBy(() -> ScenarioParser.parse(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("hover");
    }

    @Test
    void stepsListIsImmutable() throws IOException {
        Scenario scenario = ScenarioParser.parse(fixture("helpdesk-intake.yaml"));
        assertThatThrownBy(() -> scenario.steps().add(
            new ScenarioStep("click", null, null, null, null)))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    private static String fixture(String name) throws IOException {
        try (InputStream is = ScenarioParserTest.class.getResourceAsStream("/scenarios/" + name)) {
            if (is == null) throw new IOException("Fixture not found: " + name);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
