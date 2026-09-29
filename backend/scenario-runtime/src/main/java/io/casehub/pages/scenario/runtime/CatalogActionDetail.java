package io.casehub.pages.scenario.runtime;

import java.util.Map;

public record CatalogActionDetail(
    String name,
    String description,
    String invokeKind,
    String source,
    Map<String, StepParameterDto> inputs,
    Map<String, StepParameterDto> outputs,
    InvokeBindingSummary invoke
) {}
