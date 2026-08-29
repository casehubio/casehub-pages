package io.casehub.pages.scenario;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScenarioCompilerTest {

    @Test
    void compile_resolvesParams() {
        var compiled = ScenarioCompiler.compile(
                fixture("parameterized-onboard.yaml"),
                Map.of("projectName", "Acme"));
        var firstStep = compiled.steps().get(0);
        assertThat(firstStep.commands().get(0).value()).isEqualTo("Acme");
    }

    @Test
    void compile_missingRequiredParam_throws() {
        assertThatThrownBy(() -> ScenarioCompiler.compile(
                fixture("parameterized-onboard.yaml"), Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("projectName");
    }

    @Test
    void compile_whenFalse_excludesStep() {
        var compiled = ScenarioCompiler.compile(
                fixture("parameterized-onboard.yaml"),
                Map.of("projectName", "Acme", "enableCI", "false"));
        assertThat(compiled.steps()).hasSize(1);
        assertThat(compiled.steps().get(0).label()).isEqualTo("Create project");
    }

    @Test
    void compile_whenTrue_includesStep() {
        var compiled = ScenarioCompiler.compile(
                fixture("parameterized-onboard.yaml"),
                Map.of("projectName", "Acme", "enableCI", "true"));
        assertThat(compiled.steps()).hasSize(2);
    }

    @Test
    void compile_whenDefault_usesParamDefault() {
        var compiled = ScenarioCompiler.compile(
                fixture("parameterized-onboard.yaml"),
                Map.of("projectName", "Acme"));
        // enableCI defaults to true, so both steps should be included
        assertThat(compiled.steps()).hasSize(2);
    }

    @Test
    void compile_forEachCsv_stampsPerRow() {
        var compiled = ScenarioCompiler.compile(
                fixture("foreach-csv-inline.yaml"), Map.of());
        // 2 rows × 2 forEach steps, minus 1 excluded by when (Bob is not admin)
        // create-member.Alice, create-member.Bob, grant-admin.Alice
        assertThat(compiled.steps()).hasSize(3);
    }

    @Test
    void compile_forEachCsv_resolvesColumnValues() {
        var compiled = ScenarioCompiler.compile(
                fixture("foreach-csv-inline.yaml"), Map.of());
        var aliceStep = compiled.steps().get(0);
        assertThat(aliceStep.commands().get(0).value()).isEqualTo("Alice");
    }

    @Test
    void compile_forEachCsv_stampedLabelsContainRowValue() {
        var compiled = ScenarioCompiler.compile(
                fixture("foreach-csv-inline.yaml"), Map.of());
        assertThat(compiled.steps()).extracting(HierarchicalStep::label)
                .containsExactly("Create member", "Create member", "Grant admin");
    }

    @Test
    void compile_extractsCallRefs() {
        var compiled = ScenarioCompiler.compile("""
                scenario: caller-test
                steps:
                  - label: "Setup"
                    target: browser
                    commands:
                      - action: call
                        script: create-user
                      - action: click
                        target: {role: button, name: Go}
                  - label: "Teardown"
                    target: browser
                    commands:
                      - action: call
                        script: cleanup
                """, Map.of());
        assertThat(compiled.callRefs()).containsExactly("create-user", "cleanup");
    }

    @Test
    void compile_noParams_noForEach_passesThrough() {
        var compiled = ScenarioCompiler.compile("""
                scenario: simple
                steps:
                  - label: "Click"
                    target: browser
                    commands:
                      - action: click
                        target: {role: button, name: Submit}
                """, Map.of());
        assertThat(compiled.steps()).hasSize(1);
        assertThat(compiled.steps().get(0).label()).isEqualTo("Click");
        assertThat(compiled.callRefs()).isEmpty();
    }

    @Test
    void compile_iterationGroup_expandsSimpleValues() {
        var compiled = ScenarioCompiler.compile("""
                scenario: regions-test
                iterations:
                  regions:
                    as: region
                    in: ["us-east", "eu-west"]
                steps:
                  - label: "Deploy"
                    target: browser
                    forEach: regions
                    commands:
                      - action: navigate
                        value: "#dashboard/${each.region}"
                """, Map.of());
        assertThat(compiled.steps()).hasSize(2);
        assertThat(compiled.steps().get(0).commands().get(0).value())
                .isEqualTo("#dashboard/us-east");
        assertThat(compiled.steps().get(1).commands().get(0).value())
                .isEqualTo("#dashboard/eu-west");
    }

    private static String fixture(String name) {
        try (InputStream is = ScenarioCompilerTest.class.getClassLoader()
                .getResourceAsStream("scenarios/" + name)) {
            if (is == null) throw new IllegalArgumentException("Missing fixture: " + name);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
