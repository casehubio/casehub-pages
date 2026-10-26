package io.casehub.pages.playbook.runtime;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ActivationResourceTest {

    @Test
    void recentReturnsLogEntries() {
        var log = new ActivationLog(100);
        log.record(new ActivationRecord("id-1", "test-playbook",
                "cloud-event", "io.casehub.test", Map.of(),
                Instant.now(), ActivationOutcome.STARTED));

        assertThat(log.recent(50)).hasSize(1);
        assertThat(log.recent(50).get(0).playbookName()).isEqualTo("test-playbook");
    }

    @Test
    void forPlaybookFilters() {
        var log = new ActivationLog(100);
        log.record(new ActivationRecord("id-1", "alpha",
                "cloud-event", "test", Map.of(), Instant.now(), ActivationOutcome.STARTED));
        log.record(new ActivationRecord("id-2", "beta",
                "cloud-event", "test", Map.of(), Instant.now(), ActivationOutcome.STARTED));

        assertThat(log.forPlaybook("alpha", 50)).hasSize(1);
    }
}
