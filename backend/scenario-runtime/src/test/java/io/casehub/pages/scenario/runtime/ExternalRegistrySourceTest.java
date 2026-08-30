package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.ScriptProvenance;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExternalRegistrySourceTest {

    static final String MANIFEST_JSON = """
            [
              {
                "name": "onboard-team",
                "description": "Onboard team members",
                "labels": ["domain:hr", "capability:onboarding"],
                "tags": ["getting-started"],
                "params": [{"name": "teamName", "type": "string", "required": true}],
                "contentUrl": "./scripts/onboard-team.yaml",
                "calls": ["create-user"]
              },
              {
                "name": "assign-roles",
                "description": "Assign roles to members",
                "labels": ["domain:hr"],
                "tags": [],
                "params": [],
                "contentUrl": "./scripts/assign-roles.yaml",
                "calls": []
              }
            ]
            """;

    static final String SAMPLE_YAML = """
            scenario: onboard-team
            steps:
              - label: "Onboard"
                target: browser
                commands:
                  - action: navigate
                    value: "#onboard"
            """;

    @Test
    void fetch_parsesJsonManifest() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> MANIFEST_JSON, Duration.ofMinutes(5));
        var scripts = source.list();
        assertThat(scripts).hasSize(2);
        assertThat(scripts.get(0).name()).isEqualTo("onboard-team");
        assertThat(scripts.get(0).provenance()).isEqualTo(ScriptProvenance.EXTERNAL);
        assertThat(scripts.get(0).description()).isEqualTo("Onboard team members");
        assertThat(scripts.get(0).labels()).containsExactly("domain:hr", "capability:onboarding");
        assertThat(scripts.get(0).calls()).containsExactly("create-user");
    }

    @Test
    void fetch_cachesWithTtl() {
        var fetchCount = new AtomicInteger();
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> { fetchCount.incrementAndGet(); return MANIFEST_JSON; },
                Duration.ofMinutes(5));
        source.list();
        source.list();
        assertThat(fetchCount.get()).isEqualTo(1);
    }

    @Test
    void contains_checksManifest() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> MANIFEST_JSON, Duration.ofMinutes(5));
        assertThat(source.contains("onboard-team")).isTrue();
        assertThat(source.contains("unknown-script")).isFalse();
    }

    @Test
    void getYaml_fetchesFromContentUrl() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> {
                    if (uri.toString().contains("manifest.json")) return MANIFEST_JSON;
                    if (uri.toString().contains("onboard-team.yaml")) return SAMPLE_YAML;
                    return "";
                }, Duration.ofMinutes(5));
        var yaml = source.getYaml("onboard-team");
        assertThat(yaml).isPresent();
        assertThat(yaml.get()).contains("scenario: onboard-team");
    }

    @Test
    void getYaml_resolvesRelativeContentUrl() {
        var fetchedUris = new java.util.ArrayList<URI>();
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/registry/manifest.json"),
                uri -> { fetchedUris.add(uri); return uri.toString().contains("manifest") ? MANIFEST_JSON : SAMPLE_YAML; },
                Duration.ofMinutes(5));
        source.getYaml("onboard-team");
        assertThat(fetchedUris).anyMatch(uri ->
                uri.toString().equals("https://scripts.example.com/registry/scripts/onboard-team.yaml"));
    }

    @Test
    void getYaml_returnsEmptyForUnknownScript() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> MANIFEST_JSON, Duration.ofMinutes(5));
        assertThat(source.getYaml("unknown")).isEmpty();
    }

    @Test
    void list_returnsEmptyOnFetchError() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> { throw new RuntimeException("connection refused"); },
                Duration.ofMinutes(5));
        assertThat(source.list()).isEmpty();
    }

    @Test
    void fetch_extractsParams() {
        var source = new ExternalRegistrySource("test-registry",
                URI.create("https://scripts.example.com/manifest.json"),
                uri -> MANIFEST_JSON, Duration.ofMinutes(5));
        var scripts = source.list();
        assertThat(scripts.get(0).params()).hasSize(1);
        assertThat(scripts.get(0).params().get(0).name()).isEqualTo("teamName");
        assertThat(scripts.get(0).params().get(0).required()).isTrue();
    }
}
