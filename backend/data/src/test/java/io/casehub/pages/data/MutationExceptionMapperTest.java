package io.casehub.pages.data;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MutationExceptionMapperTest {

    private final MutationExceptionMapper mapper = new MutationExceptionMapper();

    @Test
    void validationErrorReturns422() {
        var ex = new MutationException("VALIDATION_ERROR", "missing required field: name");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(422);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("VALIDATION_ERROR");
        assertThat(entity.get("error")).isEqualTo("missing required field: name");
    }

    @Test
    void versionConflictReturns409() {
        var ex = new MutationException("VERSION_CONFLICT", "expected 3, found 5");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(409);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("VERSION_CONFLICT");
    }

    @Test
    void slugConflictReturns409() {
        var ex = new MutationException("SLUG_CONFLICT", "slug already exists");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(409);
    }

    @Test
    void refDeleteBlockedReturns409() {
        var ex = new MutationException("REF_DELETE_BLOCKED", "document is referenced");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(409);
    }

    @Test
    void notFoundReturns404() {
        var ex = new MutationException("NOT_FOUND", "document not found");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(404);
    }

    @Test
    void unknownCodeReturns500() {
        var ex = new MutationException("UNKNOWN", "something broke");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(500);
    }

    @Test
    void causeChainPreserved() {
        var cause = new RuntimeException("root cause");
        var ex = new MutationException("NOT_FOUND", "gone", cause);
        assertThat(ex.getCause()).isSameAs(cause);
        assertThat(ex.code()).isEqualTo("NOT_FOUND");
    }

    @Test
    void schemaViolationWithViolationsReturns422WithStructuredBody() {
        var violations = java.util.List.of(
                new FieldViolation("name", "minLength", Map.of("min", 5), "must be at least 5 characters"),
                new FieldViolation("name", "pattern", Map.of("pattern", "^[A-Z]"), "must match pattern")
                                          );
        var ex       = new SchemaViolationException("name: minLength; name: pattern", violations);
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(422);
        @SuppressWarnings("unchecked")
        var entity = (java.util.LinkedHashMap<String, Object>) response.getEntity();
        assertThat(entity.get("error")).isEqualTo("VALIDATION_FAILED");
        @SuppressWarnings("unchecked")
        var violationsList = (java.util.List<Map<String, Object>>) entity.get("violations");
        assertThat(violationsList).hasSize(2);
        assertThat(violationsList.get(0).get("field")).isEqualTo("name");
        assertThat(violationsList.get(0).get("constraint")).isEqualTo("minLength");
    }

    @Test
    void schemaViolationWithoutViolationsReturns400() {
        var ex       = new SchemaViolationException("Field 'name' expected type 'string'");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(400);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("SCHEMA_VIOLATION");
    }
}
