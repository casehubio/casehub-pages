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
}
