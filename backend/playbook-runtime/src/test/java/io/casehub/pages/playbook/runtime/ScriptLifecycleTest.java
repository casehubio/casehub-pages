package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ScriptDescriptor;
import io.casehub.pages.playbook.ScriptMeta;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptLifecycleTest {

    static final String SAMPLE_YAML = """
            playbook: test-script
            meta:
              description: A test script
              labels:
                - domain:test
              tags:
                - demo
            steps:
              - action: click
                role: button
                name: Submit
            """;

    @TempDir Path tempDir;
    ScriptRegistry registry;

    @BeforeEach
    void setUp() {
        var bundled = new BundledScriptSource(List.of());
        var uploaded = new UploadedScriptSource(tempDir);
        registry = new ScriptRegistry(bundled, uploaded);
    }

    @Test
    void uploaded_startsAsDraft() {
        ScriptDescriptor desc = registry.upload(SAMPLE_YAML);
        assertThat(desc.state()).isEqualTo("draft");
    }

    @Test
    void transition_movesToActive() {
        registry.upload(SAMPLE_YAML);
        ScriptDescriptor activated = registry.transition("test-script", "active");
        assertThat(activated.state()).isEqualTo("active");
    }

    @Test
    void transition_movesToArchived() {
        registry.upload(SAMPLE_YAML);
        registry.transition("test-script", "active");
        ScriptDescriptor archived = registry.transition("test-script", "archived");
        assertThat(archived.state()).isEqualTo("archived");
    }

    @Test
    void transition_revise_movesActiveBackToDraft() {
        registry.upload(SAMPLE_YAML);
        registry.transition("test-script", "active");
        ScriptDescriptor revised = registry.transition("test-script", "draft");
        assertThat(revised.state()).isEqualTo("draft");
    }

    @Test
    void transition_fromArchived_toActive_throws() {
        registry.upload(SAMPLE_YAML);
        registry.transition("test-script", "active");
        registry.transition("test-script", "archived");
        assertThatThrownBy(() -> registry.transition("test-script", "active"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void transition_archive_fromDraft_throws() {
        registry.upload(SAMPLE_YAML);
        assertThatThrownBy(() -> registry.transition("test-script", "archived"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void transition_nonUploaded_throws() {
        assertThatThrownBy(() -> registry.transition("nonexistent", "active"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void listByState_excludesDraftAndArchived() {
        registry.upload(SAMPLE_YAML);
        assertThat(registry.listByState("active", List.of(), List.of())).isEmpty();

        registry.transition("test-script", "active");
        assertThat(registry.listByState("active", List.of(), List.of())).hasSize(1);

        registry.transition("test-script", "archived");
        assertThat(registry.listByState("active", List.of(), List.of())).isEmpty();
    }

    @Test
    void updateMeta_onlyAllowedOnDraft() {
        registry.upload(SAMPLE_YAML);
        registry.transition("test-script", "active");
        assertThatThrownBy(() -> registry.updateMeta("test-script",
                new ScriptMeta("new desc", List.of(), List.of())))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void get_reflectsCurrentState() {
        registry.upload(SAMPLE_YAML);
        assertThat(registry.get("test-script").orElseThrow().state())
                .isEqualTo("draft");

        registry.transition("test-script", "active");
        assertThat(registry.get("test-script").orElseThrow().state())
                .isEqualTo("active");
    }
}
