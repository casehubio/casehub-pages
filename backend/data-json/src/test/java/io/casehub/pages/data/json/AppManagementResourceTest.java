package io.casehub.pages.data.json;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class AppManagementResourceTest {

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
    void list_returns_all_registered_apps() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps")
            .then().statusCode(200)
            .body("size()", greaterThanOrEqualTo(1))
            .body("[0].appId", notNullValue())
            .body("[0].enabled", notNullValue());
    }

    @Test
    void list_includes_collection_counts() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps")
            .then().statusCode(200)
            .body("find { it.appId == 'contacts' }.collectionCount",
                  greaterThanOrEqualTo(1));
    }

    @Test
    void get_single_app() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/contacts")
            .then().statusCode(200)
            .body("appId", equalTo("contacts"))
            .body("enabled", equalTo(true))
            .body("source", equalTo("static"));
    }

    @Test
    void get_unknown_app_returns_404() {
        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/nonexistent-app-xyz")
            .then().statusCode(404);
    }

    @Test
    void stop_dynamic_app() {
        String appId = "lifecycle-stop-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200)
                .body("enabled", equalTo(false));
    }

    @Test
    void start_stopped_app() {
        String appId = "lifecycle-start-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "start"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200)
                .body("enabled", equalTo(true));
    }

    @Test
    void lifecycle_rejects_static_app() {
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/contacts/lifecycle")
                .then().statusCode(409)
                .body("error", containsString("static"));
    }

    @Test
    void lifecycle_rejects_invalid_action() {
        String appId = "lifecycle-invalid-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "restart"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(400);
    }

    @Test
    void lifecycle_unknown_app_returns_404() {
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/nonexistent-xyz/lifecycle")
                .then().statusCode(404);
    }


    @Test
    void disabled_app_pages_return_404() {
        String appId = "gated-pages-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200);

        given()
                .header("Authorization", "Bearer " + token)
                .get("/api/apps/" + appId + "/pages")
                .then().statusCode(404)
                .body("error", containsString("disabled"));
    }

    @Test
    void disabled_app_child_apps_return_404() {
        String appId = "gated-catalogue-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200);

        given()
                .header("Authorization", "Bearer " + token)
                .get("/api/apps/" + appId + "/apps")
                .then().statusCode(404)
                .body("error", containsString("disabled"));
    }

    @Test
    void reenabled_app_pages_return_200() {
        String appId = "gated-reenable-" + System.nanoTime();
        createDynamicApp(appId);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "stop"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("action", "start"))
                .post("/api/apps/" + appId + "/lifecycle")
                .then().statusCode(200);

        given()
                .header("Authorization", "Bearer " + token)
                .get("/api/apps/" + appId + "/pages")
                .then().statusCode(200);
    }

    private void createDynamicApp(String appId) {
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(Map.of("appId", appId, "name", "Test " + appId,
                             "route", "/" + appId))
                .post("/api/apps/platform/apps")
                .then().statusCode(201);
    }

}
