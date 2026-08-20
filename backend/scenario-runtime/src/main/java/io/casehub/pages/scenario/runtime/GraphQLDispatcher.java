package io.casehub.pages.scenario.runtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.scenario.ScenarioStep;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class GraphQLDispatcher {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public GraphQLDispatcher() {
        this(HttpClient.newHttpClient(), new ObjectMapper());
    }

    GraphQLDispatcher(HttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper = mapper;
    }

    public Map<String, Object> dispatch(ScenarioStep.GraphQLStep step,
                                         String endpoint,
                                         VariableContext ctx) {
        Map<String, Object> resolvedParams = ctx.resolveMap(step.params());
        String operationType = "mutation";
        String query = buildQuery(step, operationType);

        try {
            String body = mapper.writeValueAsString(Map.of(
                    "query", query,
                    "variables", resolvedParams));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            return parseResponse(response.body(), step.operation());
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("GraphQL dispatch failed for "
                    + step.domain() + "." + step.operation(), e);
        }
    }

    String buildQuery(ScenarioStep.GraphQLStep step, String operationType) {
        String operation = step.operation();
        Map<String, Object> params = step.params();

        if (params.isEmpty()) {
            return operationType + " { " + operation + " }";
        }

        String varDecl = params.keySet().stream()
                .map(k -> "$" + k + ": String")
                .collect(Collectors.joining(", "));

        String argPass = params.keySet().stream()
                .map(k -> k + ": $" + k)
                .collect(Collectors.joining(", "));

        return operationType + " " + operation + "(" + varDecl + ") { "
                + operation + "(" + argPass + ") }";
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> parseResponse(String responseJson, String operation) {
        try {
            Map<String, Object> response = mapper.readValue(responseJson,
                    new TypeReference<>() {});

            if (response.containsKey("errors")) {
                List<Map<String, Object>> errors =
                        (List<Map<String, Object>>) response.get("errors");
                String message = errors.stream()
                        .map(e -> (String) e.get("message"))
                        .collect(Collectors.joining("; "));
                throw new RuntimeException("GraphQL error: " + message);
            }

            Map<String, Object> data = (Map<String, Object>) response.get("data");
            if (data == null) {
                return Map.of();
            }
            Object result = data.get(operation);
            if (result instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
            if (result == null) {
                return Map.of();
            }
            return Map.of("value", result);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse GraphQL response", e);
        }
    }
}
