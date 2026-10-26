package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;

import java.time.Instant;

record PendingActivation(
    String playbookName,
    String yaml,
    ActivationTrigger trigger,
    Instant enqueuedAt
) {}
