package io.casehub.pages.playbook;

import java.util.Map;

public sealed interface ActivationTrigger {

    RetriggerPolicy retriggerPolicy();
    int maxQueued();

    record CloudEventTrigger(
        String eventType,
        Map<String, String> filter,
        String source,
        RetriggerPolicy retriggerPolicy,
        int maxQueued
    ) implements ActivationTrigger {
        public CloudEventTrigger {
            if (eventType == null || eventType.isBlank())
                throw new IllegalArgumentException("eventType required");
            filter = filter != null ? Map.copyOf(filter) : Map.of();
        }
    }

    record ScheduledTrigger(
        String cron,
        RetriggerPolicy retriggerPolicy,
        int maxQueued
    ) implements ActivationTrigger {
        public ScheduledTrigger {
            if (cron == null || cron.isBlank())
                throw new IllegalArgumentException("cron expression required");
        }
    }

    enum RetriggerPolicy { SKIP, QUEUE }
}
