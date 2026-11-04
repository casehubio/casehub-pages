package io.casehub.pages.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CollectionSchemaTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void validate_accepts_conforming_document() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("title", "string", "priority", "number", "active", "boolean"),
            Map.of("active", true),
            Map.of());

        ObjectNode doc = MAPPER.createObjectNode()
            .put("title", "Test")
            .put("priority", 1)
            .put("active", true);

        schema.validate(doc);
    }

    @Test
    void validate_rejects_wrong_type() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("priority", "number"),
            Map.of(),
            Map.of());

        ObjectNode doc = MAPPER.createObjectNode().put("priority", "not-a-number");

        assertThatThrownBy(() -> schema.validate(doc))
            .isInstanceOf(SchemaViolationException.class)
            .hasMessageContaining("priority");
    }

    @Test
    void validate_allows_unknown_fields() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("title", "string"),
            Map.of(),
            Map.of());

        ObjectNode doc = MAPPER.createObjectNode()
            .put("title", "Test")
            .put("extra", "value");

        schema.validate(doc);
    }

    @Test
    void validate_checks_enum_values() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("status", "enum:open,closed,pending"),
            Map.of(),
            Map.of());

        ObjectNode valid = MAPPER.createObjectNode().put("status", "open");
        schema.validate(valid);

        ObjectNode invalid = MAPPER.createObjectNode().put("status", "invalid");
        assertThatThrownBy(() -> schema.validate(invalid))
            .isInstanceOf(SchemaViolationException.class)
            .hasMessageContaining("status");
    }

    @Test
    void applyDefaults_fills_missing_fields() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("title", "string", "active", "boolean"),
            Map.of("active", true),
            Map.of());

        ObjectNode doc = MAPPER.createObjectNode().put("title", "Test");
        schema.applyDefaults(doc);

        assertThat(doc.get("active").asBoolean()).isTrue();
    }

    @Test
    void refs_tracks_reference_fields() {
        CollectionSchema schema = new CollectionSchema("tickets",
            Map.of("assignee", "ref"),
            Map.of(),
            Map.of("assignee", "agents"));

        assertThat(schema.refs()).containsEntry("assignee", "agents");
    }

    @Test
    void validateToResult_rejects_minLength_violation() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
                "string", false, 5, null, null, null, null, null, null, null, null, null));
        CollectionSchema schema = new CollectionSchema("tickets",
                                                       Map.of("name", "string"), Map.of(), Map.of(), constraints);

        ObjectNode             doc    = MAPPER.createObjectNode().put("name", "ab");
        SchemaValidationResult result = schema.validateToResult(doc);

        assertThat(result.valid()).isFalse();
        assertThat(result.violations()).hasSize(1);
        assertThat(result.violations().get(0).field()).isEqualTo("name");
        assertThat(result.violations().get(0).constraint()).isEqualTo("minLength");
    }

    @Test
    void validateToResult_rejects_required_missing() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
                "string", true, null, null, null, null, null, null, null, null, null, null));
        CollectionSchema schema = new CollectionSchema("tickets",
                                                       Map.of("name", "string"), Map.of(), Map.of(), constraints);

        ObjectNode             doc    = MAPPER.createObjectNode();
        SchemaValidationResult result = schema.validateToResult(doc);

        assertThat(result.valid()).isFalse();
        assertThat(result.violations()).anySatisfy(v ->
                                                           assertThat(v.constraint()).isEqualTo("required"));
    }

    @Test
    void validateToResult_accepts_valid_document() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
                "string", true, 2, 50, null, null, null, null, null, null, null, null));
        CollectionSchema schema = new CollectionSchema("tickets",
                                                       Map.of("name", "string"), Map.of(), Map.of(), constraints);

        ObjectNode             doc    = MAPPER.createObjectNode().put("name", "Valid Name");
        SchemaValidationResult result = schema.validateToResult(doc);

        assertThat(result.valid()).isTrue();
        assertThat(result.violations()).isEmpty();
    }

    @Test
    void validate_throws_with_violations() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
                "string", true, 5, null, null, null, null, null, null, null, null, null));
        CollectionSchema schema = new CollectionSchema("tickets",
                                                       Map.of("name", "string"), Map.of(), Map.of(), constraints);

        ObjectNode doc = MAPPER.createObjectNode().put("name", "ab");

        assertThatThrownBy(() -> schema.validate(doc))
                .isInstanceOf(SchemaViolationException.class)
                .satisfies(e -> {
                    SchemaViolationException sve = (SchemaViolationException) e;
                    assertThat(sve.violations()).isNotEmpty();
                    assertThat(sve.violations().get(0).field()).isEqualTo("name");
                });
    }

    @Test
    void validateToResult_reports_multiple_violations() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
                "string", false, 5, null, "^[A-Z]", null, null, null, null, null, null, null));
        CollectionSchema schema = new CollectionSchema("tickets",
                                                       Map.of("name", "string"), Map.of(), Map.of(), constraints);

        ObjectNode             doc    = MAPPER.createObjectNode().put("name", "ab");
        SchemaValidationResult result = schema.validateToResult(doc);

        assertThat(result.valid()).isFalse();
        assertThat(result.violations().size()).isGreaterThanOrEqualTo(2);
    }
}
