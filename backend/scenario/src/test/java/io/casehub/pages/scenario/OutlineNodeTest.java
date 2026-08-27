package io.casehub.pages.scenario;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class OutlineNodeTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void leafNodeHasEmptyChildren() throws Exception {
        var node = new OutlineNode("Step 1", "browser");
        String json = mapper.writeValueAsString(node);
        var tree = mapper.readTree(json);
        assertThat(tree.get("label").asText()).isEqualTo("Step 1");
        assertThat(tree.get("target").asText()).isEqualTo("browser");
        assertThat(tree.get("children")).isEmpty();
    }

    @Test
    void leafNodeWithAction() throws Exception {
        var node = new OutlineNode("Step 1", "browser", "spotlight");
        String json = mapper.writeValueAsString(node);
        var tree = mapper.readTree(json);
        assertThat(tree.get("label").asText()).isEqualTo("Step 1");
        assertThat(tree.get("action").asText()).isEqualTo("spotlight");
        assertThat(tree.get("children")).isEmpty();
    }

    @Test
    void leafNodeWithoutActionSerializesNull() throws Exception {
        var node = new OutlineNode("Step 1", "browser");
        String json = mapper.writeValueAsString(node);
        var tree = mapper.readTree(json);
        assertThat(tree.get("action").isNull()).isTrue();
    }

    @Test
    void branchNodeHasNullTarget() throws Exception {
        var node = new OutlineNode("Chapter 1", List.of(
            new OutlineNode("Section 1", List.of(
                new OutlineNode("Step 1", "browser")
            ))
        ));
        String json = mapper.writeValueAsString(node);
        var tree = mapper.readTree(json);
        assertThat(tree.get("label").asText()).isEqualTo("Chapter 1");
        assertThat(tree.get("target").isNull()).isTrue();
        assertThat(tree.get("children")).hasSize(1);
        assertThat(tree.get("children").get(0).get("children").get(0).get("target").asText())
            .isEqualTo("browser");
    }
}
