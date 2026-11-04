package io.casehub.pages.data;

import java.util.List;

public class SchemaViolationException extends MutationException {

    private final List<FieldViolation> violations;

    public SchemaViolationException(String message, List<FieldViolation> violations) {
        super("SCHEMA_VIOLATION", message);
        this.violations = List.copyOf(violations);
    }

    public SchemaViolationException(String message) {
        this(message, List.of());
    }

    public List<FieldViolation> violations() {
        return violations;
    }
}
