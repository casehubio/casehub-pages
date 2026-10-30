package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.SchemaViolationException;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.OptionalInt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@QuarkusTest
class SchemaValidationTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    JsonDataProvider provider;

    @Test
    void create_validates_against_schema() {
        DataContext ctx = new DataContext("schema-test");
        ObjectNode doc = MAPPER.createObjectNode()
            .put("title", "Valid Ticket")
            .put("priority", "high");

        String id = provider.create(ctx, "tickets", doc, "title");
        assertThat(id).isNotBlank();
    }

    @Test
    void create_rejects_invalid_enum_value() {
        DataContext ctx = new DataContext("schema-test-enum");
        ObjectNode doc = MAPPER.createObjectNode()
            .put("title", "Bad Priority")
            .put("priority", "extreme");

        assertThatThrownBy(() -> provider.create(ctx, "tickets", doc, "title"))
            .isInstanceOf(SchemaViolationException.class)
            .hasMessageContaining("priority");
    }

    @Test
    void create_applies_defaults() {
        DataContext ctx = new DataContext("schema-test-defaults");
        ObjectNode doc = MAPPER.createObjectNode()
            .put("name", "Agent Smith")
            .put("email", "smith@test.com");

        String id = provider.create(ctx, "agents", doc, "name");
        var loaded = provider.get(ctx, "agents", id).orElseThrow();
        assertThat(loaded.get("active").asBoolean()).isTrue();
    }

    @Test
    void update_validates_against_schema() {
        DataContext ctx = new DataContext("schema-test-update");
        ObjectNode doc = MAPPER.createObjectNode()
            .put("title", "Update Test")
            .put("priority", "low");
        String id = provider.create(ctx, "tickets", doc, "title");

        ObjectNode badPatch = MAPPER.createObjectNode().put("priority", "extreme");
        assertThatThrownBy(() ->
            provider.update(ctx, "tickets", id, badPatch, OptionalInt.empty()))
            .isInstanceOf(SchemaViolationException.class);
    }

    @Test
    void create_allows_unregistered_collections() {
        DataContext ctx = new DataContext("schema-test-unreg");
        ObjectNode doc = MAPPER.createObjectNode().put("data", "anything");

        String id = provider.create(ctx, "unregistered-collection", doc, "data");
        assertThat(id).isNotBlank();
    }
}
