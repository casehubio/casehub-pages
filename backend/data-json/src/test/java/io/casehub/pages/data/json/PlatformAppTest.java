package io.casehub.pages.data.json;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
class PlatformAppTest {

    private String token;

    @BeforeEach
    void login() {
        token = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "admin", "roles", List.of("admin", "developer")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");
    }

    @Test
    void platform_app_is_discovered() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/platform/apps")
            .then().statusCode(200)
            .body("size()", greaterThanOrEqualTo(3))
            .body("appId", hasItem("helpdesk"))
            .body("appId", hasItem("contacts"))
            .body("appId", hasItem("tasks"));
    }

    @Test
    void catalogue_lists_auto_seeded_apps() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/platform/apps/helpdesk")
            .then().statusCode(200)
            .body("appId", equalTo("helpdesk"))
            .body("name", equalTo("Helpdesk"))
            .body("source", equalTo("static"))
            .body("route", equalTo("/helpdesk"));
    }

    @Test
    void can_add_custom_app_to_catalogue() {
        String appId = "custom-app-" + System.nanoTime();
        Map<String, Object> entry = Map.of(
            "appId", appId,
            "name", "Custom App",
            "description", "A dynamically added application",
            "route", "/" + appId
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/platform/apps")
            .then().statusCode(201)
            .body("appId", equalTo(appId));

        given()
            .header("Authorization", "Bearer " + token)
            .delete("/api/apps/platform/apps/" + appId)
            .then().statusCode(204);
    }

    @Test
    void cannot_delete_static_app_from_catalogue() {
        given()
            .header("Authorization", "Bearer " + token)
            .delete("/api/apps/platform/apps/helpdesk")
            .then().statusCode(409);
    }
}
