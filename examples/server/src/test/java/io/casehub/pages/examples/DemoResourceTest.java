package io.casehub.pages.examples;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;

@QuarkusTest
class DemoResourceTest {
    @Test
    void healthEndpointReturnsOk() {
        given().when().get("/api/demo/health")
            .then().statusCode(200)
            .body("status", is("ok"))
            .body("storeType", is("jdbc"));
    }

    @Test
    void infoEndpointReturnsStoreMetadata() {
        given().when().get("/api/demo/info")
            .then().statusCode(200)
            .body("storeType", is("jdbc"))
            .body("topicCount", greaterThanOrEqualTo(0));
    }

    @Test
    void generateEndpointProducesEvents() {
        given().queryParam("topic", "test:burst").queryParam("count", "5")
            .when().post("/api/demo/generate")
            .then().statusCode(200)
            .body("generated", is(5))
            .body("topic", is("test:burst"));
    }
}
