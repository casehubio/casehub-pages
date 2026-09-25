package io.casehub.pages.data.prometheus;

import com.sun.net.httpserver.HttpServer;
import io.casehub.pages.data.DataQueryException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PrometheusClientTest {

    private HttpServer server;
    private PrometheusClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        int port = server.getAddress().getPort();
        client = new PrometheusClient("http://localhost:" + port, "none", null, null, null, 5, 30);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void rangeQueryParsesMatrix() {
        String json = """
            {
              "status": "success",
              "data": {
                "resultType": "matrix",
                "result": [
                  {
                    "metric": {"instance": "host1", "job": "node"},
                    "values": [[1695000000, "1.5"], [1695000060, "2.0"]]
                  }
                ]
              }
            }
            """;
        server.createContext("/api/v1/query_range", exchange -> {
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        PromQLQuery query = new PromQLQuery("node_cpu", "1695000000", "1695000120", "60s", List.of());
        PrometheusResponse response = client.rangeQuery(query);

        assertThat(response.status()).isEqualTo("success");
        assertThat(response.data().resultType()).isEqualTo("matrix");
        assertThat(response.data().result()).hasSize(1);
        assertThat(response.data().result().getFirst().metric()).containsEntry("instance", "host1");
        assertThat(response.data().result().getFirst().values()).hasSize(2);
    }

    @Test
    void instantQueryParsesVector() {
        String json = """
            {
              "status": "success",
              "data": {
                "resultType": "vector",
                "result": [
                  {
                    "metric": {"instance": "host1"},
                    "value": [1695000000, "42.5"]
                  }
                ]
              }
            }
            """;
        server.createContext("/api/v1/query", exchange -> {
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        PrometheusResponse response = client.instantQuery("node_cpu");

        assertThat(response.status()).isEqualTo("success");
        assertThat(response.data().resultType()).isEqualTo("vector");
        assertThat(response.data().result()).hasSize(1);
        assertThat(response.data().result().getFirst().value()).hasSize(2);
    }

    @Test
    void invalidPromQLReturns422ThrowsDataQueryException() {
        String json = """
            {"status": "error", "errorType": "bad_data", "error": "invalid expression"}
            """;
        server.createContext("/api/v1/query", exchange -> {
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(422, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        assertThatThrownBy(() -> client.instantQuery("invalid{"))
            .isInstanceOf(DataQueryException.class)
            .satisfies(e -> {
                DataQueryException dqe = (DataQueryException) e;
                assertThat(dqe.code()).isEqualTo("INVALID_QUERY");
            });
    }

    @Test
    void serverErrorThrowsFetchFailed() {
        server.createContext("/api/v1/query", exchange -> {
            byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(503, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        assertThatThrownBy(() -> client.instantQuery("metric"))
            .isInstanceOf(DataQueryException.class)
            .satisfies(e -> {
                DataQueryException dqe = (DataQueryException) e;
                assertThat(dqe.code()).isEqualTo("FETCH_FAILED");
            });
    }

    @Test
    void bearerAuthHeaderSent() {
        PrometheusClient authClient = new PrometheusClient(
            "http://localhost:" + server.getAddress().getPort(),
            "bearer", "my-secret-token", null, null, 5, 30
        );
        String json = """
            {"status": "success", "data": {"resultType": "vector", "result": []}}
            """;
        final String[] capturedAuth = {null};
        server.createContext("/api/v1/query", exchange -> {
            capturedAuth[0] = exchange.getRequestHeaders().getFirst("Authorization");
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        authClient.instantQuery("metric");

        assertThat(capturedAuth[0]).isEqualTo("Bearer my-secret-token");
    }
}
