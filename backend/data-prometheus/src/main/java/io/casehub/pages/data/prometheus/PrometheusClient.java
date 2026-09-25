package io.casehub.pages.data.prometheus;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.data.DataQueryException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class PrometheusClient {

    private final String endpoint;
    private final String authType;
    private final String authToken;
    private final String authUsername;
    private final String authPassword;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final int readTimeoutSeconds;

    public PrometheusClient(String endpoint, String authType, String authToken,
                            String authUsername, String authPassword,
                            int connectTimeoutSeconds, int readTimeoutSeconds) {
        this.endpoint = endpoint;
        this.authType = authType;
        this.authToken = authToken;
        this.authUsername = authUsername;
        this.authPassword = authPassword;
        this.readTimeoutSeconds = readTimeoutSeconds;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
            .build();
        this.mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    public PrometheusResponse rangeQuery(PromQLQuery query) {
        String url = endpoint + "/api/v1/query_range"
            + "?query=" + encode(query.expr())
            + "&start=" + encode(query.start())
            + "&end=" + encode(query.end())
            + "&step=" + encode(query.step());
        return execute(url);
    }

    public PrometheusResponse instantQuery(String expr) {
        String url = endpoint + "/api/v1/query?query=" + encode(expr);
        return execute(url);
    }

    private PrometheusResponse execute(String url) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(readTimeoutSeconds));

            applyAuth(builder);

            HttpResponse<String> response = httpClient.send(builder.build(),
                HttpResponse.BodyHandlers.ofString());

            int status = response.statusCode();
            if (status == 422) {
                throw new DataQueryException("INVALID_QUERY",
                    parseError(response.body()));
            }
            if (status >= 400) {
                throw new DataQueryException("FETCH_FAILED",
                    "HTTP " + status + ": " + parseError(response.body()));
            }

            return mapper.readValue(response.body(), PrometheusResponse.class);
        } catch (DataQueryException e) {
            throw e;
        } catch (IOException e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("timed out")) {
                throw new DataQueryException("FETCH_FAILED", "Connection timed out", e);
            }
            throw new DataQueryException("FETCH_FAILED", "Connection failed: " + msg, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new DataQueryException("FETCH_FAILED", "Request interrupted", e);
        }
    }

    private void applyAuth(HttpRequest.Builder builder) {
        switch (authType) {
            case "bearer" -> builder.header("Authorization", "Bearer " + authToken);
            case "basic" -> {
                String credentials = authUsername + ":" + authPassword;
                String encoded = java.util.Base64.getEncoder()
                    .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
                builder.header("Authorization", "Basic " + encoded);
            }
            default -> { /* none */ }
        }
    }

    private String parseError(String body) {
        try {
            var node = mapper.readTree(body);
            if (node.has("error")) {
                return node.get("error").asText();
            }
        } catch (Exception ignored) {}
        return body;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
