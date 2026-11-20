package io.casehub.pages.push.runtime;

import io.casehub.pages.push.TopicRegistry;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.smallrye.jwt.build.Jwt;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;

@QuarkusTest
class PushPublishResourceTest {

    @Inject TestPushConfig testConfig;
    @Inject TopicRegistry topicRegistry;

    @BeforeEach
    void setUp() {
        testConfig.clear();
    }

    private String validToken() {
        return Jwt.claims()
                .subject("worker-1")
                .groups(Set.of("user"))
                .sign();
    }

    @Test
    void publish_broadcasts_and_returns_seq() {
        topicRegistry.listen("conn-1", List.of("orders:new"));

        given()
                .auth().oauth2(validToken())
                .contentType(ContentType.JSON)
                .body("{\"item\":\"widget\",\"qty\":3}")
                .when()
                .post("/api/push/publish/orders:new")
                .then()
                .statusCode(200)
                .body("seq", equalTo(1));

        assertThat(testConfig.sent()).hasSize(1);
        assertThat(testConfig.sent().getFirst().message()).contains("\"topic\":\"orders:new\"");
        assertThat(testConfig.sent().getFirst().message()).contains("\"item\":\"widget\"");
    }

    @Test
    void publish_without_auth_returns_401() {
        given()
                .contentType(ContentType.JSON)
                .body("{\"x\":1}")
                .when()
                .post("/api/push/publish/test:topic")
                .then()
                .statusCode(401);
    }

    @Test
    void publish_wildcard_topic_returns_400() {
        given()
                .auth().oauth2(validToken())
                .contentType(ContentType.JSON)
                .body("{\"x\":1}")
                .when()
                .post("/api/push/publish/metrics:*:cpu")
                .then()
                .statusCode(400);
    }

    @Test
    void publish_empty_body_returns_400() {
        given()
                .auth().oauth2(validToken())
                .contentType(ContentType.JSON)
                .body("")
                .when()
                .post("/api/push/publish/test:topic")
                .then()
                .statusCode(400);
    }


    @Test
    void publish_malformed_json_returns_400() {
        given()
                .auth().oauth2(validToken())
                .contentType(ContentType.JSON)
                .body("not valid json {{{")
                .when()
                .post("/api/push/publish/test:topic")
                .then()
                .statusCode(400);
    }

    @Test
    void publish_with_no_subscribers_returns_seq() {
        given()
                .auth().oauth2(validToken())
                .contentType(ContentType.JSON)
                .body("{\"alert\":true}")
                .when()
                .post("/api/push/publish/nobody:listens")
                .then()
                .statusCode(200)
                .body("seq", greaterThan(0));

        assertThat(testConfig.sent()).isEmpty();
    }
}
