package io.casehub.pages.playbook.runtime;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ActivationLogTest {

    private static ActivationRecord record(String playbook, ActivationOutcome outcome) {
        return new ActivationRecord(java.util.UUID.randomUUID().toString(),
                playbook, "cloud-event", "io.casehub.test",
                Map.of(), Instant.now(), outcome);
    }

    @Test
    void recordsAndRetrieves() {
        var log = new ActivationLog(100);
        log.record(record("a", ActivationOutcome.STARTED));
        assertThat(log.recent(10)).hasSize(1);
    }

    @Test
    void recentReturnsNewestFirst() {
        var log = new ActivationLog(100);
        log.record(record("first", ActivationOutcome.STARTED));
        log.record(record("second", ActivationOutcome.SKIPPED));
        var recent = log.recent(10);
        assertThat(recent.get(0).playbookName()).isEqualTo("second");
        assertThat(recent.get(1).playbookName()).isEqualTo("first");
    }

    @Test
    void respectsMaxSize() {
        var log = new ActivationLog(2);
        log.record(record("a", ActivationOutcome.STARTED));
        log.record(record("b", ActivationOutcome.STARTED));
        log.record(record("c", ActivationOutcome.STARTED));
        assertThat(log.recent(10)).hasSize(2);
    }

    @Test
    void filtersForPlaybook() {
        var log = new ActivationLog(100);
        log.record(record("alpha", ActivationOutcome.STARTED));
        log.record(record("beta", ActivationOutcome.STARTED));
        log.record(record("alpha", ActivationOutcome.SKIPPED));
        assertThat(log.forPlaybook("alpha", 10)).hasSize(2);
        assertThat(log.forPlaybook("beta", 10)).hasSize(1);
    }

    @Test
    void limitRestricts() {
        var log = new ActivationLog(100);
        log.record(record("a", ActivationOutcome.STARTED));
        log.record(record("a", ActivationOutcome.STARTED));
        log.record(record("a", ActivationOutcome.STARTED));
        assertThat(log.recent(2)).hasSize(2);
    }
}
