package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MergeStrategyTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void shallow_replaces_top_level_fields() {
        ObjectNode existing = MAPPER.createObjectNode().put("a", 1).put("b", 2);
        ObjectNode patch = MAPPER.createObjectNode().put("b", 3).put("c", 4);

        JsonNode result = MergeStrategy.SHALLOW.merge(existing, patch);

        assertThat(result.get("a").asInt()).isEqualTo(1);
        assertThat(result.get("b").asInt()).isEqualTo(3);
        assertThat(result.get("c").asInt()).isEqualTo(4);
    }

    @Test
    void shallow_replaces_nested_objects_wholesale() {
        ObjectNode nested = MAPPER.createObjectNode().put("x", 1).put("y", 2);
        ObjectNode existing = MAPPER.createObjectNode();
        existing.set("nested", nested);

        ObjectNode patchNested = MAPPER.createObjectNode().put("z", 3);
        ObjectNode patch = MAPPER.createObjectNode();
        patch.set("nested", patchNested);

        JsonNode result = MergeStrategy.SHALLOW.merge(existing, patch);

        assertThat(result.get("nested").has("x")).isFalse();
        assertThat(result.get("nested").get("z").asInt()).isEqualTo(3);
    }

    @Test
    void deep_merges_nested_objects_recursively() {
        ObjectNode nested = MAPPER.createObjectNode().put("x", 1).put("y", 2);
        ObjectNode existing = MAPPER.createObjectNode();
        existing.set("nested", nested);

        ObjectNode patchNested = MAPPER.createObjectNode().put("y", 3).put("z", 4);
        ObjectNode patch = MAPPER.createObjectNode();
        patch.set("nested", patchNested);

        JsonNode result = MergeStrategy.DEEP.merge(existing, patch);

        assertThat(result.get("nested").get("x").asInt()).isEqualTo(1);
        assertThat(result.get("nested").get("y").asInt()).isEqualTo(3);
        assertThat(result.get("nested").get("z").asInt()).isEqualTo(4);
    }

    @Test
    void deep_replaces_arrays_wholesale() {
        ObjectNode existing = MAPPER.createObjectNode();
        existing.putArray("tags").add("a").add("b");

        ObjectNode patch = MAPPER.createObjectNode();
        patch.putArray("tags").add("c");

        JsonNode result = MergeStrategy.DEEP.merge(existing, patch);

        assertThat(result.get("tags")).hasSize(1);
        assertThat(result.get("tags").get(0).asText()).isEqualTo("c");
    }

    @Test
    void rfc7396_null_deletes_field() {
        ObjectNode existing = MAPPER.createObjectNode().put("a", 1).put("b", 2);
        ObjectNode patch = MAPPER.createObjectNode().put("a", 10);
        patch.putNull("b");

        JsonNode result = MergeStrategy.RFC_7396.merge(existing, patch);

        assertThat(result.get("a").asInt()).isEqualTo(10);
        assertThat(result.has("b")).isFalse();
    }

    @Test
    void rfc7396_adds_new_fields() {
        ObjectNode existing = MAPPER.createObjectNode().put("a", 1);
        ObjectNode patch = MAPPER.createObjectNode().put("b", 2);

        JsonNode result = MergeStrategy.RFC_7396.merge(existing, patch);

        assertThat(result.get("a").asInt()).isEqualTo(1);
        assertThat(result.get("b").asInt()).isEqualTo(2);
    }
}
