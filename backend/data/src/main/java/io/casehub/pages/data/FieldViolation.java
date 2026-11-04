package io.casehub.pages.data;

import java.util.Map;

public record FieldViolation(
    String field,
    String constraint,
    Map<String, Object> params,
    String message
) {
    public FieldViolation {
        params = params != null ? Map.copyOf(params) : Map.of();
    }
}
