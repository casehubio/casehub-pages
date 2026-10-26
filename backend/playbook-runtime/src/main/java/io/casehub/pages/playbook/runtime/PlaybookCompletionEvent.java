package io.casehub.pages.playbook.runtime;

public record PlaybookCompletionEvent(
    String playbookName,
    String triggerSource,
    boolean faulted
) {}
