package io.casehub.pages.playbook.runtime;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class PlaybookConfigInjectionTest {

    @Inject
    PlaybookConfig config;

    @Test
    void graphQLEndpointsMapPopulatedFromConfig() {
        assertThat(config.graphQLEndpoint("connectors"))
                .isEqualTo("http://connectors:8080/graphql");
        assertThat(config.graphQLEndpoint("engine"))
                .isEqualTo("http://engine:9090/graphql");
    }

    @Test
    void pushEndpointsMapPopulatedFromConfig() {
        assertThat(config.pushEndpoint("connectors"))
                .isEqualTo("ws://connectors:8080/push");
    }

    @Test
    void unmappedDomainFallsBackToDefault() {
        assertThat(config.graphQLEndpoint("unknown"))
                .isEqualTo("http://localhost:8080/graphql");
        assertThat(config.pushEndpoint("unknown"))
                .isEqualTo("ws://localhost:8080/push");
    }
}
