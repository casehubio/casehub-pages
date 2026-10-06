package io.casehub.pages.playbook.runtime;

import java.util.Map;

public class PlaybookConfig {

    private final String defaultGraphQLEndpoint;
    private final String defaultPushEndpoint;
    private final String defaultRestBaseUrl;
    private final Map<String, String> graphQLEndpoints;
    private final Map<String, String> pushEndpoints;
    private final String              libraryPath;


    public PlaybookConfig(String defaultGraphQLEndpoint,
                          String defaultPushEndpoint,
                          Map<String, String> graphQLEndpoints,
                          Map<String, String> pushEndpoints) {
        this(defaultGraphQLEndpoint, defaultPushEndpoint, defaultGraphQLEndpoint.replaceAll("/graphql$", ""),
             graphQLEndpoints, pushEndpoints, System.getProperty("java.io.tmpdir") + "/casehub-playbook-library");}

    public PlaybookConfig(String defaultGraphQLEndpoint,
                          String defaultPushEndpoint,
                          String defaultRestBaseUrl,
                          Map<String, String> graphQLEndpoints,
                          Map<String, String> pushEndpoints,
                          String libraryPath) {
        this.defaultGraphQLEndpoint = defaultGraphQLEndpoint;
        this.defaultPushEndpoint = defaultPushEndpoint;
        this.defaultRestBaseUrl = defaultRestBaseUrl;
        this.graphQLEndpoints = Map.copyOf(graphQLEndpoints);
        this.pushEndpoints = Map.copyOf(pushEndpoints);
        this.libraryPath = libraryPath;
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

    public String libraryPath() {
        return libraryPath;
    }


    public static PlaybookConfig localhost() {
        return new PlaybookConfig(
                "http://localhost:8080/graphql",
                "ws://localhost:8080/push",
                Map.of(), Map.of());
    }
}
