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
import java.util.Map;

public class RestDispatcher {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public RestDispatcher() {
        this(HttpClient.newHttpClient(), new ObjectMapper());
    }

    RestDispatcher(HttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper = mapper;
    }

    public Map<String, Object> dispatch(ScenarioStep.RestStep step,
                                         String baseUrl,
                                         VariableContext ctx) {
        String resolvedUrl = ctx.resolve(baseUrl + step.url());
        String method = step.method().toUpperCase();

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(resolvedUrl))
                .header("Content-Type", "application/json");

        for (var entry : step.headers().entrySet()) {
            requestBuilder.header(entry.getKey(), ctx.resolve(entry.getValue()));
        }

        Map<String, Object> resolvedBody = ctx.resolveMap(step.body());

        HttpRequest.BodyPublisher bodyPublisher = resolvedBody.isEmpty()
                ? HttpRequest.BodyPublishers.noBody()
                : bodyPublisher(resolvedBody);

        requestBuilder.method(method, bodyPublisher);

        try {
            HttpResponse<String> response = httpClient.send(
                    requestBuilder.build(),
                    HttpResponse.BodyHandlers.ofString());

            if (step.expectedStatus() != null && response.statusCode() != step.expectedStatus()) {
                throw new RuntimeException("Expected status " + step.expectedStatus()
                        + " but got " + response.statusCode() + ": " + response.body());
            }

            return parseResponse(response);
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("REST dispatch failed for " + method + " " + step.url(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResponse(HttpResponse<String> response) {
        if (response.statusCode() == 204 || response.body() == null || response.body().isBlank()) {
            return Map.of("status", response.statusCode());
        }
        try {
            Map<String, Object> body = mapper.readValue(response.body(), new TypeReference<>() {});
            body = new java.util.HashMap<>(body);
            body.put("status", response.statusCode());
            return body;
        } catch (JsonProcessingException e) {
            return Map.of("status", response.statusCode(), "body", response.body());
        }
    }

    private HttpRequest.BodyPublisher bodyPublisher(Map<String, Object> body) {
        try {
            return HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize request body", e);
        }
    }
}
