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
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class AppCatalogueResourceTest {

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
    void create_and_list_app_entry() {
        String appId = "test-app-" + System.nanoTime();
        Map<String, Object> entry = Map.of(
            "appId", appId,
            "name", "Test App",
            "description", "A test application",
            "icon", "test-icon",
            "route", "/" + appId
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(201)
            .body("appId", equalTo(appId))
            .body("name", equalTo("Test App"));

        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/helpdesk/apps")
            .then().statusCode(200)
            .body("find { it.appId == '" + appId + "' }.description", equalTo("A test application"))
            .body("find { it.appId == '" + appId + "' }.route", equalTo("/" + appId));
    }

    @Test
    void get_app_entry() {
        String appId = "get-app-" + System.nanoTime();
        Map<String, Object> entry = Map.of(
            "appId", appId,
            "name", "Get Test",
            "route", "/" + appId
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(201);

        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/helpdesk/apps/" + appId)
            .then().statusCode(200)
            .body("name", equalTo("Get Test"));
    }

    @Test
    void delete_app_entry() {
        String appId = "del-app-" + System.nanoTime();
        Map<String, Object> entry = Map.of(
            "appId", appId,
            "name", "Delete Test",
            "route", "/" + appId
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(201);

        given()
            .header("Authorization", "Bearer " + token)
            .delete("/api/apps/helpdesk/apps/" + appId)
            .then().statusCode(204);

        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/helpdesk/apps/" + appId)
            .then().statusCode(404);
    }

    @Test
    void rejects_create_without_appId() {
        Map<String, Object> entry = Map.of(
            "name", "No AppId"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(400)
            .body("error", containsString("appId"));
    }

    @Test
    void rejects_write_without_admin_role() {
        String userToken = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "viewer", "roles", List.of("user")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");

        Map<String, Object> entry = Map.of(
            "appId", "forbidden",
            "name", "Forbidden App",
            "route", "/forbidden"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + userToken)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(403);
    }

    @Test
    void rejects_delete_static_app() {
        String appId = "static-app-" + System.nanoTime();
        Map<String, Object> entry = Map.of(
            "appId", appId,
            "name", "Static App",
            "route", "/" + appId,
            "source", "static"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(entry)
            .post("/api/apps/helpdesk/apps")
            .then().statusCode(201);

        given()
            .header("Authorization", "Bearer " + token)
            .delete("/api/apps/helpdesk/apps/" + appId)
            .then().statusCode(409);
    }
}
