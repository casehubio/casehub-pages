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
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class PageResourceTest {

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
    void create_and_list_dynamic_page() {
        Map<String, Object> page = Map.of(
            "name", "test-page-" + System.nanoTime(),
            "yaml", "name: test-page\ncomponents:\n  - type: title\n    properties:\n      text: Hello\n",
            "description", "A test page"
        );

        String name = (String) page.get("name");

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(page)
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(201)
            .body("name", equalTo(name));

        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("find { it.name == '" + name + "' }.description", equalTo("A test page"))
            .body("find { it.name == '" + name + "' }.yaml", nullValue());
    }

    @Test
    void get_page_returns_full_yaml() {
        String name = "get-test-" + System.nanoTime();
        Map<String, Object> page = Map.of(
            "name", name,
            "yaml", "name: " + name + "\ncomponents:\n  - type: title\n    properties:\n      text: Test\n"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(page)
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(201);

        given()
            .header("Authorization", "Bearer " + token)
            .get("/api/apps/helpdesk/pages/" + name)
            .then().statusCode(200)
            .body("yaml", containsString("type: title"));
    }

    @Test
    void rejects_invalid_yaml() {
        Map<String, Object> page = Map.of(
            "name", "bad-page",
            "yaml", "name: bad-page\ncomponents:\n  - script: alert(1)\n"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(page)
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("script"));
    }

    @Test
    void rejects_write_without_admin_role() {
        String userToken = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "viewer", "roles", List.of("user")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");

        Map<String, Object> page = Map.of(
            "name", "forbidden-page",
            "yaml", "name: forbidden-page\ncomponents:\n  - type: title\n    properties:\n      text: No\n"
        );

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + userToken)
            .body(page)
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(403);
    }
}
