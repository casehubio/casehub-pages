package io.casehub.pages.playbook.runtime;

import java.util.Map;

public record InvokeBindingSummary(
    String kind,
    Map<String, String> metadata
) {}
