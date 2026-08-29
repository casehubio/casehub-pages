package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.ScriptMeta;
import io.casehub.pages.scenario.ScriptProvenance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptRegistryTest {

    static final String BUNDLED_YAML = """
            scenario: helpdesk-intake
            meta:
              description: "Helpdesk intake form"
              labels:
                - domain:helpdesk
              tags:
                - demo
            steps:
              - label: "Fill form"
                target: browser
                commands:
                  - action: fill
                    target: {role: textbox, name: "Subject"}
                    value: "Test"
            """;

    static final String SAMPLE_YAML = """
            scenario: sample-script
            meta:
              description: "A sample automation"
              labels:
                - domain:hr
              tags:
                - setup
            steps:
              - label: "Navigate"
                target: browser
                commands:
                  - action: navigate
                    value: "#home"
            """;

    static final String BUNDLED_NAME_YAML = """
            scenario: helpdesk-intake
            steps:
              - label: "Duplicate"
                target: browser
                commands:
                  - action: navigate
                    value: "#dup"
            """;

    @TempDir Path tempDir;
    ScriptRegistry registry;

    @BeforeEach
    void setUp() {
        var bundled = new TestBundledSource(BUNDLED_YAML);
        var uploaded = new UploadedScriptSource(tempDir);
        registry = new ScriptRegistry(bundled, uploaded);
    }

    @Test
    void list_returnsBundledScripts() {
        var scripts = registry.list(List.of(), List.of());
        assertThat(scripts).extracting("name").contains("helpdesk-intake");
    }

    @Test
    void upload_savesAndReturns() {
        var desc = registry.upload(SAMPLE_YAML);
        assertThat(desc.name()).isEqualTo("sample-script");
        assertThat(desc.provenance()).isEqualTo(ScriptProvenance.UPLOADED);

        var all = registry.list(List.of(), List.of());
        assertThat(all).extracting("name").contains("helpdesk-intake", "sample-script");
    }

    @Test
    void upload_rejectsBundledNameCollision() {
        assertThatThrownBy(() -> registry.upload(BUNDLED_NAME_YAML))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bundled");
    }

    @Test
    void upload_overwritesExistingUploaded() {
        registry.upload(SAMPLE_YAML);
        var updated = registry.upload(SAMPLE_YAML);
        assertThat(updated.name()).isEqualTo("sample-script");
        assertThat(registry.list(List.of(), List.of()).stream()
                .filter(d -> d.name().equals("sample-script")).count()).isEqualTo(1);
    }

    @Test
    void delete_removesUploaded() {
        registry.upload(SAMPLE_YAML);
        assertThat(registry.delete("sample-script")).isTrue();
        assertThat(registry.get("sample-script")).isEmpty();
    }

    @Test
    void delete_rejectsBundled() {
        assertThat(registry.delete("helpdesk-intake")).isFalse();
        assertThat(registry.get("helpdesk-intake")).isPresent();
    }

    @Test
    void list_filtersByLabels() {
        registry.upload(SAMPLE_YAML);
        var filtered = registry.list(List.of("domain:hr"), List.of());
        assertThat(filtered).allMatch(d -> d.labels().contains("domain:hr"));
        assertThat(filtered).extracting("name").contains("sample-script");
        assertThat(filtered).extracting("name").doesNotContain("helpdesk-intake");
    }

    @Test
    void list_filtersByTags() {
        registry.upload(SAMPLE_YAML);
        var filtered = registry.list(List.of(), List.of("demo"));
        assertThat(filtered).extracting("name").contains("helpdesk-intake");
        assertThat(filtered).extracting("name").doesNotContain("sample-script");
    }

    @Test
    void getYaml_returnsContent() {
        assertThat(registry.getYaml("helpdesk-intake")).isPresent();
        assertThat(registry.getYaml("helpdesk-intake").get()).contains("helpdesk-intake");
    }

    @Test
    void updateMeta_updatesUploadedOnly() {
        registry.upload(SAMPLE_YAML);
        var updated = registry.updateMeta("sample-script",
                new ScriptMeta("Updated desc", List.of("domain:ops"), List.of("changed")));
        assertThat(updated.description()).isEqualTo("Updated desc");
        assertThat(updated.labels()).containsExactly("domain:ops");
    }

    @Test
    void updateMeta_rejectsBundled() {
        assertThatThrownBy(() -> registry.updateMeta("helpdesk-intake",
                new ScriptMeta("x", List.of(), List.of())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    static class TestBundledSource extends BundledScriptSource {
        TestBundledSource(String yaml) {
            super(List.of());
            var desc = io.casehub.pages.scenario.ScriptDescriptorExtractor.extract(
                    yaml, ScriptProvenance.BUNDLED);
            try {
                var descField = BundledScriptSource.class.getDeclaredField("descriptors");
                descField.setAccessible(true);
                @SuppressWarnings("unchecked")
                var map = (java.util.Map<String, io.casehub.pages.scenario.ScriptDescriptor>) descField.get(this);
                map.put(desc.name(), desc);

                var yamlField = BundledScriptSource.class.getDeclaredField("yamlContent");
                yamlField.setAccessible(true);
                @SuppressWarnings("unchecked")
                var yamlMap = (java.util.Map<String, String>) yamlField.get(this);
                yamlMap.put(desc.name(), yaml);
            } catch (Exception e) { throw new RuntimeException(e); }
        }
    }
}
