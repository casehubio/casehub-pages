package io.casehub.pages.playbook.runtime;

import java.time.Instant;
import java.util.Map;

public record ActivationRecord(
    String id,
    String playbookName,
    String triggerType,
    String triggerDetail,
    Map<String, Object> eventData,
    Instant activatedAt,
    ActivationOutcome outcome
) {}
