package io.casehub.pages.scenario.runtime;

import java.util.Map;

public class ScenarioConfig {

    private final String defaultGraphQLEndpoint;
    private final String defaultPushEndpoint;
    private final String defaultRestBaseUrl;
    private final Map<String, String> graphQLEndpoints;
    private final Map<String, String> pushEndpoints;

    public ScenarioConfig(String defaultGraphQLEndpoint,
                           String defaultPushEndpoint,
                           Map<String, String> graphQLEndpoints,
                           Map<String, String> pushEndpoints) {
        this(defaultGraphQLEndpoint, defaultPushEndpoint, defaultGraphQLEndpoint.replaceAll("/graphql$", ""),
             graphQLEndpoints, pushEndpoints);
    }

    public ScenarioConfig(String defaultGraphQLEndpoint,
                           String defaultPushEndpoint,
                           String defaultRestBaseUrl,
                           Map<String, String> graphQLEndpoints,
                           Map<String, String> pushEndpoints) {
        this.defaultGraphQLEndpoint = defaultGraphQLEndpoint;
        this.defaultPushEndpoint = defaultPushEndpoint;
        this.defaultRestBaseUrl = defaultRestBaseUrl;
        this.graphQLEndpoints = Map.copyOf(graphQLEndpoints);
        this.pushEndpoints = Map.copyOf(pushEndpoints);
    }

    public String graphQLEndpoint(String domain) {
        return graphQLEndpoints.getOrDefault(domain, defaultGraphQLEndpoint);
    }

    public String pushEndpoint(String domain) {
        return pushEndpoints.getOrDefault(domain, defaultPushEndpoint);
    }

    public String restBaseUrl() {
        return defaultRestBaseUrl;
    }

    public static ScenarioConfig localhost() {
        return new ScenarioConfig(
                "http://localhost:8080/graphql",
                "ws://localhost:8080/push",
                Map.of(), Map.of());
    }
}
