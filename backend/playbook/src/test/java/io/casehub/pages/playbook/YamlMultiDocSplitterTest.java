package io.casehub.pages.playbook;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class YamlMultiDocSplitterTest {

    @Test
    void singleDocReturnsNoFrontMatter() {
        var yaml = """
                playbook: demo
                steps:
                  - navigate: /home
                """;
        var result = YamlMultiDocSplitter.split(yaml);
        assertNull(result.frontMatter());
        assertEquals("demo", result.content().path("playbook").asText());
        assertTrue(result.content().has("steps"));
    }

    @Test
    void multiDocWithPlaybookHeaderExtractsFrontMatter() {
        var yaml = """
                playbook: "1.0"
                schema: client
                name: helpdesk-intake
                ---
                playbook: helpdesk-intake
                steps:
                  - navigate: /intake
                """;
        var result = YamlMultiDocSplitter.split(yaml);
        assertNotNull(result.frontMatter());
        assertEquals("1.0", result.frontMatter().version());
        assertEquals("client", result.frontMatter().schema());
        assertEquals("helpdesk-intake", result.frontMatter().name());
        assertEquals("helpdesk-intake", result.content().path("playbook").asText());
        assertTrue(result.content().has("steps"));
    }

    @Test
    void multiDocWithoutPlaybookKeyTreatsFirstAsContent() {
        var yaml = """
                playbook: demo
                description: A demo script
                ---
                steps:
                  - navigate: /home
                """;
        var result = YamlMultiDocSplitter.split(yaml);
        assertNull(result.frontMatter());
        assertEquals("demo", result.content().path("playbook").asText());
    }

    @Test
    void frontMatterCapturesExtraMetadata() {
        var yaml = """
                playbook: "1.0"
                schema: server
                custom-field: custom-value
                ---
                playbook: test
                steps:
                  - navigate: /test
                """;
        var result = YamlMultiDocSplitter.split(yaml);
        assertNotNull(result.frontMatter());
        assertEquals("server", result.frontMatter().schema());
        assertEquals("custom-value", result.frontMatter().metadata().get("custom-field"));
    }

    @Test
    void multiDocWithoutSchemaFieldTreatsFirstAsContent() {
        var yaml = """
                playbook: "1.0"
                ---
                playbook: test
                steps:
                  - navigate: /test
                """;
        var result = YamlMultiDocSplitter.split(yaml);
        assertNull(result.frontMatter());
        assertEquals("1.0", result.content().path("playbook").asText());
    }

    @Test
    void emptyYamlThrows() {
        assertThrows(IllegalArgumentException.class, () -> YamlMultiDocSplitter.split(""));
    }

    @Test
    void nullYamlThrows() {
        assertThrows(IllegalArgumentException.class, () -> YamlMultiDocSplitter.split(null));
    }
}
