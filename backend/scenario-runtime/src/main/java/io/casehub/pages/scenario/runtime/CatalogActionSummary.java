package io.casehub.pages.scenario.runtime;

public record CatalogActionSummary(
    String name,
    String description,
    String invokeKind,
    String source,
    int inputCount,
    int outputCount
) {}
