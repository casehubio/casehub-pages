package io.casehub.pages.playbook;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class LifecycleYamlConsistencyTest {

    @Test
    void defaultLifecycleYaml_isIdenticalAcrossRuntimes() throws IOException {
        String javaYaml;
        try (InputStream is = getClass().getResourceAsStream("/lifecycle/default-lifecycle.yaml")) {
            assertThat(is).as("Java lifecycle YAML must exist on classpath").isNotNull();
            javaYaml = new String(is.readAllBytes());
        }

        Path tsYaml = Path.of("../../packages/yaml-core/src/step/scenario/lifecycle/default-lifecycle.yaml");
        assertThat(tsYaml).as("TS lifecycle YAML must exist").exists();
        String tsContent = Files.readString(tsYaml);

        assertThat(javaYaml).as("Java and TS lifecycle YAML must be identical").isEqualTo(tsContent);
    }
}
