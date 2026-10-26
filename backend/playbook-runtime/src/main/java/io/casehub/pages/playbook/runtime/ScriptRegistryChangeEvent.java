package io.casehub.pages.playbook.runtime;

public record ScriptRegistryChangeEvent(
    String playbookName,
    ChangeType type
) {
    public enum ChangeType { UPLOADED, DELETED }
}
