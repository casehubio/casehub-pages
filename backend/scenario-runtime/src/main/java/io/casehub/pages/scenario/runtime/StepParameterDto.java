package io.casehub.pages.scenario.runtime;

import java.util.List;

public record StepParameterDto(
    String type,
    boolean required,
    String defaultValue,
    List<String> allowedValues,
    String format,
    String description
) {}
