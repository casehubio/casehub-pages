package io.casehub.pages.scenario;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScenarioCompilerCallTest {

    private final Function<String, Optional<String>> registry = name -> {
        String resource = "scenarios/" + name + ".yaml";
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(resource)) {
            if (is == null) return Optional.empty();
            return Optional.of(new String(is.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            return Optional.empty();
        }
    };

    @Test
    void compile_callInlinesCalleeSteps() {
        var compiled = ScenarioCompiler.compile(
                fixture("caller-script.yaml"), Map.of(), registry);
        assertThat(compiled.steps()).extracting(HierarchicalStep::label)
                .containsSequence("Navigate to users",
                        "callee-create-user.Fill name",
                        "callee-create-user.Select role",
                        "callee-create-user.Submit",
                        "Verify done");
    }

    @Test
    void compile_callPassesParams() {
        var compiled = ScenarioCompiler.compile(
                fixture("caller-script.yaml"), Map.of(), registry);
        var fillNameStep = compiled.steps().stream()
                .filter(s -> s.label().equals("callee-create-user.Fill name"))
                .findFirst().orElseThrow();
        assertThat(fillNameStep.commands().get(0).value()).isEqualTo("Alice");
    }

    @Test
    void compile_callUsesCalleeDefaults() {
        var compiled = ScenarioCompiler.compile("""
                scenario: default-test
                steps:
                  - label: "Create user"
                    target: browser
                    commands:
                      - action: call
                        script: callee-create-user
                        params:
                          userName: "Bob"
                """, Map.of(), registry);
        var selectRoleStep = compiled.steps().stream()
                .filter(s -> s.label().equals("callee-create-user.Select role"))
                .findFirst().orElseThrow();
        assertThat(selectRoleStep.commands().get(0).value()).isEqualTo("Viewer");
    }

    @Test
    void compile_callReplacesCallStep() {
        var compiled = ScenarioCompiler.compile(
                fixture("caller-script.yaml"), Map.of(), registry);
        assertThat(compiled.steps().stream()
                .noneMatch(s -> s.commands().stream()
                        .anyMatch(c -> "call".equals(c.action())))).isTrue();
    }

    @Test
    void compile_cyclicCall_throws() {
        assertThatThrownBy(() -> ScenarioCompiler.compile(
                fixture("cyclic-a.yaml"), Map.of(), registry))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cycle");
    }

    @Test
    void compile_withoutResolver_ignoresCalls() {
        var compiled = ScenarioCompiler.compile(
                fixture("caller-script.yaml"), Map.of());
        assertThat(compiled.steps()).hasSize(3);
        assertThat(compiled.callRefs()).containsExactly("callee-create-user");
    }

    private static String fixture(String name) {
        try (InputStream is = ScenarioCompilerCallTest.class.getClassLoader()
                .getResourceAsStream("scenarios/" + name)) {
            if (is == null) throw new IllegalArgumentException("Missing fixture: " + name);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
