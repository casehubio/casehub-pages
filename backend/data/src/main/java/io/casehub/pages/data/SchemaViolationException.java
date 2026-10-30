package io.casehub.pages.data;

public class SchemaViolationException extends MutationException {

    public SchemaViolationException(String message) {
        super("SCHEMA_VIOLATION", message);
    }
}
