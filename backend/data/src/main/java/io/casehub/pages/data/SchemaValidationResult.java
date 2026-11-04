package io.casehub.pages.data;

import java.util.List;

public record SchemaValidationResult(
    boolean valid,
    List<FieldViolation> violations
) {
    public SchemaValidationResult {
        violations = List.copyOf(violations);
    }

    public static SchemaValidationResult ok() {
        return new SchemaValidationResult(true, List.of());
    }
}
