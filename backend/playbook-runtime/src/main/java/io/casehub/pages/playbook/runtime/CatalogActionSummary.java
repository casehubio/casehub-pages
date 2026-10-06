package io.casehub.pages.playbook.runtime;

public record CatalogActionSummary(
    String name,
    String description,
    String invokeKind,
    String source,
    int inputCount,
    int outputCount
) {}
