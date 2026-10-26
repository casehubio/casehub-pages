package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;
import io.casehub.pages.playbook.ActivationTrigger.RetriggerPolicy;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TriggerIndexTest {

    @Test
    void matchesByCloudEventType() {
        var trigger = new ActivationTrigger.CloudEventTrigger(
                "io.casehub.ras.situation", Map.of(), null,
                RetriggerPolicy.SKIP, 10);
        var index = TriggerIndex.builder()
                .add("fraud-response", trigger, "yaml-content")
                .build();

        assertThat(index.matchCloudEvent("io.casehub.ras.situation")).hasSize(1);
        assertThat(index.matchCloudEvent("io.casehub.ras.situation").get(0).playbookName())
                .isEqualTo("fraud-response");
    }

    @Test
    void noMatchForDifferentEventType() {
        var trigger = new ActivationTrigger.CloudEventTrigger(
                "io.casehub.ras.situation", Map.of(), null,
                RetriggerPolicy.SKIP, 10);
        var index = TriggerIndex.builder()
                .add("fraud-response", trigger, "yaml")
                .build();

        assertThat(index.matchCloudEvent("io.casehub.other")).isEmpty();
    }

    @Test
    void multipleBindingsForSameEventType() {
        var t1 = new ActivationTrigger.CloudEventTrigger(
                "io.casehub.ras.situation", Map.of("type", "fraud"), null,
                RetriggerPolicy.SKIP, 10);
        var t2 = new ActivationTrigger.CloudEventTrigger(
                "io.casehub.ras.situation", Map.of("type", "compliance"), null,
                RetriggerPolicy.QUEUE, 5);
        var index = TriggerIndex.builder()
                .add("fraud-response", t1, "yaml1")
                .add("compliance-check", t2, "yaml2")
                .build();

        assertThat(index.matchCloudEvent("io.casehub.ras.situation")).hasSize(2);
    }

    @Test
    void cronBindingsReturned() {
        var trigger = new ActivationTrigger.ScheduledTrigger(
                "0 0 */4 * * ?", RetriggerPolicy.SKIP, 10);
        var index = TriggerIndex.builder()
                .addCron("daily-check", trigger, "yaml")
                .build();

        assertThat(index.cronBindings()).hasSize(1);
        assertThat(index.cronBindings().get(0).playbookName()).isEqualTo("daily-check");
    }

    @Test
    void emptyIndexReturnsEmptyResults() {
        var index = TriggerIndex.builder().build();
        assertThat(index.matchCloudEvent("any")).isEmpty();
        assertThat(index.cronBindings()).isEmpty();
    }
}
