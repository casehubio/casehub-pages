package io.casehub.pages.scenario.runtime;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ScenarioConfigTest {

    @Test
    void defaultEndpointForUnmappedDomain() {
        var config = ScenarioConfig.localhost();
        assertThat(config.graphQLEndpoint("connectors"))
                .isEqualTo("http://localhost:8080/graphql");
        assertThat(config.pushEndpoint("connectors"))
                .isEqualTo("ws://localhost:8080/push");
    }

    @Test
    void overriddenEndpointForMappedDomain() {
        var config = new ScenarioConfig(
                "http://localhost:8080/graphql",
                "ws://localhost:8080/push",
                Map.of("connectors", "http://connectors:8080/graphql"),
                Map.of("connectors", "ws://connectors:8080/push"));
        assertThat(config.graphQLEndpoint("connectors"))
                .isEqualTo("http://connectors:8080/graphql");
        assertThat(config.graphQLEndpoint("engine"))
                .isEqualTo("http://localhost:8080/graphql");
        assertThat(config.pushEndpoint("connectors"))
                .isEqualTo("ws://connectors:8080/push");
        assertThat(config.pushEndpoint("engine"))
                .isEqualTo("ws://localhost:8080/push");
    }
}
