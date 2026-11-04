package io.casehub.pages.data;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JsonSchemaBuilderTest {

    @Test
    void buildsSchemaWithStringConstraints() {
        var constraints = Map.of("name", new CollectionSchema.FieldConstraints(
            "string", true, 2, 50, "^[A-Z]", null, null, null, null, null, null, null));
        ObjectNode schema = JsonSchemaBuilder.buildSchema(constraints);

        assertThat(schema.path("type").asText()).isEqualTo("object");
        assertThat(schema.path("required").toString()).contains("name");
        ObjectNode nameProps = (ObjectNode) schema.path("properties").path("name");
        assertThat(nameProps.path("type").asText()).isEqualTo("string");
        assertThat(nameProps.path("minLength").asInt()).isEqualTo(2);
        assertThat(nameProps.path("maxLength").asInt()).isEqualTo(50);
        assertThat(nameProps.path("pattern").asText()).isEqualTo("^[A-Z]");
    }

    @Test
    void buildsSchemaWithNumericConstraints() {
        var constraints = Map.of("age", new CollectionSchema.FieldConstraints(
            "number", false, null, null, null, 0, 150, null, null, null, null, null));
        ObjectNode schema = JsonSchemaBuilder.buildSchema(constraints);

        ObjectNode ageProps = (ObjectNode) schema.path("properties").path("age");
        assertThat(ageProps.path("type").asText()).isEqualTo("number");
        assertThat(ageProps.path("minimum").asInt()).isEqualTo(0);
        assertThat(ageProps.path("maximum").asInt()).isEqualTo(150);
    }

    @Test
    void buildsSchemaWithEnumConstraints() {
        var constraints = Map.of("status", new CollectionSchema.FieldConstraints(
            "string", false, null, null, null, null, null, null, null, null,
            List.of("OPEN", "CLOSED"), null));
        ObjectNode schema = JsonSchemaBuilder.buildSchema(constraints);

        ObjectNode statusProps = (ObjectNode) schema.path("properties").path("status");
        assertThat(statusProps.path("enum").toString()).contains("OPEN", "CLOSED");
    }

    @Test
    void omitsNullConstraints() {
        var constraints = Map.of("desc", CollectionSchema.FieldConstraints.typeOnly("string"));
        ObjectNode schema = JsonSchemaBuilder.buildSchema(constraints);

        ObjectNode descProps = (ObjectNode) schema.path("properties").path("desc");
        assertThat(descProps.has("minLength")).isFalse();
        assertThat(descProps.has("pattern")).isFalse();
        assertThat(schema.path("required").isEmpty()).isTrue();
    }
}
