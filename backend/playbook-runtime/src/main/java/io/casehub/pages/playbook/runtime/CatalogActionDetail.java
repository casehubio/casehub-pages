package io.casehub.pages.playbook.runtime;

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
