package io.casehub.pages.scenario;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class NarrativeContentSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void inlineSerializesToTypeDiscriminator() throws Exception {
        NarrativeContent content = new NarrativeContent.Inline("Hello world");
        String json = mapper.writeValueAsString(content);
        var tree = mapper.readTree(json);
        assertThat(tree.get("type").asText()).isEqualTo("inline");
        assertThat(tree.get("markdown").asText()).isEqualTo("Hello world");
    }

    @Test
    void templateSerializesWithType() throws Exception {
        NarrativeContent content = new NarrativeContent.Template("docs/intro.md", "overview", Map.of());
        String json = mapper.writeValueAsString(content);
        var tree = mapper.readTree(json);
        assertThat(tree.get("type").asText()).isEqualTo("template");
        assertThat(tree.get("path").asText()).isEqualTo("docs/intro.md");
        assertThat(tree.get("section").asText()).isEqualTo("overview");
    }

    @Test
    void slideSerializesWithType() throws Exception {
        NarrativeContent content = new NarrativeContent.Slide("slide-3");
        String json = mapper.writeValueAsString(content);
        var tree = mapper.readTree(json);
        assertThat(tree.get("type").asText()).isEqualTo("slide");
    }

    @Test
    void inlineDeserializesFromTypeDiscriminator() throws Exception {
        String json = """
            {"type":"inline","markdown":"Hello world"}
            """;
        NarrativeContent content = mapper.readValue(json, NarrativeContent.class);
        assertThat(content).isInstanceOf(NarrativeContent.Inline.class);
        assertThat(((NarrativeContent.Inline) content).markdown()).isEqualTo("Hello world");
    }
}
