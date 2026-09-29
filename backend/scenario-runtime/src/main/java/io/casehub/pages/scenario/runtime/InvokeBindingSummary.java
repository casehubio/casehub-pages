package io.casehub.pages.scenario.runtime;

import java.util.Map;

public record InvokeBindingSummary(
    String kind,
    Map<String, String> metadata
) {}
