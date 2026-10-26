package io.casehub.pages.playbook;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ActivationTriggerParserTest {

    @Test
    void parsesCloudEventTrigger() {
        var yaml = """
                playbook: fraud-response
                triggers:
                  - type: cloud-event
                    event-type: io.casehub.ras.situation
                    filter:
                      situationType: fraud-detected
                      severity: critical
                    on-retrigger: skip
                steps:
                  - navigate: /dashboard
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals(1, envelope.triggers().size());

        var trigger = (ActivationTrigger.CloudEventTrigger) envelope.triggers().get(0);
        assertEquals("io.casehub.ras.situation", trigger.eventType());
        assertEquals("fraud-detected", trigger.filter().get("situationType"));
        assertEquals("critical", trigger.filter().get("severity"));
        assertEquals(ActivationTrigger.RetriggerPolicy.SKIP, trigger.retriggerPolicy());
        assertEquals(10, trigger.maxQueued());
    }

    @Test
    void parsesScheduledTrigger() {
        var yaml = """
                playbook: daily-check
                triggers:
                  - type: scheduled
                    cron: "0 0 */4 * * ?"
                    on-retrigger: queue
                    max-queued: 3
                steps:
                  - navigate: /reports
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals(1, envelope.triggers().size());

        var trigger = (ActivationTrigger.ScheduledTrigger) envelope.triggers().get(0);
        assertEquals("0 0 */4 * * ?", trigger.cron());
        assertEquals(ActivationTrigger.RetriggerPolicy.QUEUE, trigger.retriggerPolicy());
        assertEquals(3, trigger.maxQueued());
    }

    @Test
    void parsesMultipleTriggers() {
        var yaml = """
                playbook: multi
                triggers:
                  - type: cloud-event
                    event-type: io.casehub.ras.situation
                    filter:
                      situationType: fraud
                  - type: scheduled
                    cron: "0 0 8 * * ?"
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertEquals(2, envelope.triggers().size());
        assertInstanceOf(ActivationTrigger.CloudEventTrigger.class, envelope.triggers().get(0));
        assertInstanceOf(ActivationTrigger.ScheduledTrigger.class, envelope.triggers().get(1));
    }

    @Test
    void defaultsToEmptyTriggersWhenKeyAbsent() {
        var yaml = """
                playbook: manual-only
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        assertTrue(envelope.triggers().isEmpty());
    }

    @Test
    void defaultRetriggerPolicyIsSkip() {
        var yaml = """
                playbook: default-policy
                triggers:
                  - type: cloud-event
                    event-type: io.casehub.test
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        var trigger = (ActivationTrigger.CloudEventTrigger) envelope.triggers().get(0);
        assertEquals(ActivationTrigger.RetriggerPolicy.SKIP, trigger.retriggerPolicy());
        assertEquals(10, trigger.maxQueued());
    }

    @Test
    void parsesCloudEventSourceFilter() {
        var yaml = """
                playbook: source-filtered
                triggers:
                  - type: cloud-event
                    event-type: io.casehub.trade
                    source: /trading/engine
                steps:
                  - navigate: /home
                """;
        var envelope = PlaybookContentParser.parse(yaml);
        var trigger = (ActivationTrigger.CloudEventTrigger) envelope.triggers().get(0);
        assertEquals("/trading/engine", trigger.source());
    }

    @Test
    void rejectsUnknownTriggerType() {
        var yaml = """
                playbook: bad
                triggers:
                  - type: webhook
                steps:
                  - navigate: /home
                """;
        assertThrows(IllegalArgumentException.class, () -> PlaybookContentParser.parse(yaml));
    }
}
