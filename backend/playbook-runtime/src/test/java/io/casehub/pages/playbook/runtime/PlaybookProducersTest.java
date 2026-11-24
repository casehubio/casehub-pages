package io.casehub.pages.playbook.runtime;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class PlaybookProducersTest {

    private final PlaybookProducers producers = new PlaybookProducers();

    @Test
    void defaultPlaybookConfigUsesLocalhostDefaults() {
        var config = producers.playbookConfig(
                "http://localhost:8080/graphql",
                "ws://localhost:8080/push",
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty());

        assertThat(config.graphQLEndpoint("any")).isEqualTo("http://localhost:8080/graphql");
        assertThat(config.pushEndpoint("any")).isEqualTo("ws://localhost:8080/push");
        assertThat(config.restBaseUrl()).isEqualTo("http://localhost:8080");
        assertThat(config.libraryPath()).endsWith("/casehub-playbook-library");
    }

    @Test
    void playbookConfigWithExplicitValues() {
        var config = producers.playbookConfig(
                "http://gateway:8080/graphql",
                "ws://gateway:8080/push",
                Optional.of("http://gateway:8080"),
                Optional.of(Map.of("connectors", "http://connectors:8080/graphql")),
                Optional.of(Map.of("connectors", "ws://connectors:8080/push")),
                Optional.of("/opt/playbooks"));

        assertThat(config.graphQLEndpoint("connectors")).isEqualTo("http://connectors:8080/graphql");
        assertThat(config.graphQLEndpoint("engine")).isEqualTo("http://gateway:8080/graphql");
        assertThat(config.pushEndpoint("connectors")).isEqualTo("ws://connectors:8080/push");
        assertThat(config.restBaseUrl()).isEqualTo("http://gateway:8080");
        assertThat(config.libraryPath()).isEqualTo("/opt/playbooks");
    }

    @Test
    void restBaseUrlDerivedFromGraphQLEndpointWhenNotSet() {
        var config = producers.playbookConfig(
                "http://myhost:9090/graphql",
                "ws://myhost:9090/push",
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty());

        assertThat(config.restBaseUrl()).isEqualTo("http://myhost:9090");
    }

    @Test
    void restDispatcherProduced() {
        var dispatcher = producers.restDispatcher();
        assertThat(dispatcher).isNotNull();
    }

    @Test
    void graphQLDispatcherProduced() {
        var dispatcher = producers.graphQLDispatcher();
        assertThat(dispatcher).isNotNull();
    }
}
