package io.casehub.pages.playbook;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

class StepOutcomeTest {

    @Test
    void okFactoryCreatesSuccessfulOutcome() {
        StepOutcome outcome = StepOutcome.ok("step1", Map.of("key", "value"));
        assertThat(outcome.success()).isTrue();
        assertThat(outcome.stepName()).isEqualTo("step1");
        assertThat(outcome.result()).containsEntry("key", "value");
        assertThat(outcome.error()).isNull();
    }

    @Test
    void failFactoryCreatesFailedOutcome() {
        StepOutcome outcome = StepOutcome.fail("step2", "something broke");
        assertThat(outcome.success()).isFalse();
        assertThat(outcome.stepName()).isEqualTo("step2");
        assertThat(outcome.result()).isEmpty();
        assertThat(outcome.error()).isEqualTo("something broke");
    }
}
