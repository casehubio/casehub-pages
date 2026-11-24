package io.casehub.pages.playbook.runtime;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class PlaybookProducers {

    @Produces
    @ApplicationScoped
    @DefaultBean
    PlaybookConfig playbookConfig(
            @ConfigProperty(name = "casehub.pages.playbook.graphql-endpoint",
                            defaultValue = "http://localhost:8080/graphql") String graphQLEndpoint,
            @ConfigProperty(name = "casehub.pages.playbook.push-endpoint",
                            defaultValue = "ws://localhost:8080/push") String pushEndpoint,
            @ConfigProperty(name = "casehub.pages.playbook.rest-base-url") Optional<String> restBaseUrl,
            @ConfigProperty(name = "casehub.pages.playbook.graphql-endpoints") Optional<Map<String, String>> graphQLEndpoints,
            @ConfigProperty(name = "casehub.pages.playbook.push-endpoints") Optional<Map<String, String>> pushEndpoints,
            @ConfigProperty(name = "casehub.pages.playbook.library-path") Optional<String> libraryPath) {
        return new PlaybookConfig(
                graphQLEndpoint,
                pushEndpoint,
                restBaseUrl.orElse(graphQLEndpoint.replaceAll("/graphql$", "")),
                graphQLEndpoints.orElse(Map.of()),
                pushEndpoints.orElse(Map.of()),
                libraryPath.orElse(System.getProperty("java.io.tmpdir") + "/casehub-playbook-library"));
    }

    @Produces
    @ApplicationScoped
    @DefaultBean
    RestDispatcher restDispatcher() {
        return new RestDispatcher();
    }

    @Produces
    @ApplicationScoped
    @DefaultBean
    GraphQLDispatcher graphQLDispatcher() {
        return new GraphQLDispatcher();
    }
}
