package io.casehub.pages.scenario;

import io.casehub.pages.scenario.CallGraphValidator.ScriptRef;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CallGraphValidatorTest {

    @Test
    void validate_noCalls_passes() {
        assertThatCode(() -> CallGraphValidator.validate("root",
                name -> Optional.of(new ScriptRef(name, List.of()))))
                .doesNotThrowAnyException();
    }

    @Test
    void validate_linearChain_passes() {
        assertThatCode(() -> CallGraphValidator.validate("root", name -> switch (name) {
            case "root" -> Optional.of(new ScriptRef("root", List.of("A")));
            case "A" -> Optional.of(new ScriptRef("A", List.of("B")));
            case "B" -> Optional.of(new ScriptRef("B", List.of()));
            default -> Optional.empty();
        })).doesNotThrowAnyException();
    }

    @Test
    void validate_cycle_throws() {
        assertThatThrownBy(() -> CallGraphValidator.validate("root", name -> switch (name) {
            case "root" -> Optional.of(new ScriptRef("root", List.of("A")));
            case "A" -> Optional.of(new ScriptRef("A", List.of("B")));
            case "B" -> Optional.of(new ScriptRef("B", List.of("root")));
            default -> Optional.empty();
        })).isInstanceOf(IllegalArgumentException.class)
           .hasMessageContaining("root")
           .hasMessageContaining("A")
           .hasMessageContaining("B");
    }

    @Test
    void validate_selfCycle_throws() {
        assertThatThrownBy(() -> CallGraphValidator.validate("loop", name ->
                Optional.of(new ScriptRef("loop", List.of("loop")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("loop");
    }

    @Test
    void validate_diamondNoCycle_passes() {
        // root → A, root → B, A → C, B → C (diamond, not a cycle)
        assertThatCode(() -> CallGraphValidator.validate("root", name -> switch (name) {
            case "root" -> Optional.of(new ScriptRef("root", List.of("A", "B")));
            case "A" -> Optional.of(new ScriptRef("A", List.of("C")));
            case "B" -> Optional.of(new ScriptRef("B", List.of("C")));
            case "C" -> Optional.of(new ScriptRef("C", List.of()));
            default -> Optional.empty();
        })).doesNotThrowAnyException();
    }

    @Test
    void validate_unresolvedScript_ignored() {
        assertThatCode(() -> CallGraphValidator.validate("root",
                name -> "root".equals(name)
                        ? Optional.of(new ScriptRef("root", List.of("missing")))
                        : Optional.empty()))
                .doesNotThrowAnyException();
    }
}
