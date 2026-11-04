package io.casehub.pages.data.json;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PageResourceE2ETest {

    private String adminToken;
    private String userToken;

    @BeforeEach
    void login() {
        adminToken = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "admin", "roles", List.of("admin", "developer")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");

        userToken = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "viewer", "roles", List.of("user")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");
    }

    // --- Full lifecycle: create → list → get → update → delete ---

    @Test
    @Order(1)
    void full_page_lifecycle() {
        String name = "lifecycle-" + System.nanoTime();
        String yaml = "name: " + name + "\ncomponents:\n  - type: title\n    properties:\n      text: Hello\n";

        // Create
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of("name", name, "yaml", yaml, "description", "Test page"))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(201)
            .body("name", equalTo(name))
            .body("yaml", equalTo(yaml));

        // List — metadata only (no yaml field)
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("find { it.name == '" + name + "' }.description", equalTo("Test page"))
            .body("find { it.name == '" + name + "' }.yaml", nullValue());

        // Get — full content with yaml
        String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        String etag = given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/helpdesk/pages/" + slug)
            .then().statusCode(200)
            .body("yaml", containsString("type: title"))
            .header("ETag", notNullValue())
            .extract().header("ETag");

        // Update with If-Match
        String updatedYaml = "name: " + name + "\ncomponents:\n  - type: title\n    properties:\n      text: Updated\n";
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .header("If-Match", etag)
            .body(Map.of("yaml", updatedYaml, "description", "Updated page"))
            .patch("/api/apps/helpdesk/pages/" + slug)
            .then().statusCode(200)
            .body("description", equalTo("Updated page"))
            .body("yaml", containsString("Updated"));

        // Delete
        given()
            .header("Authorization", "Bearer " + adminToken)
            .delete("/api/apps/helpdesk/pages/" + slug)
            .then().statusCode(204);

        // Verify deleted
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/helpdesk/pages/" + slug)
            .then().statusCode(404);
    }

    // --- Static page protection ---

    @Test
    @Order(2)
    void static_pages_are_seeded_and_visible() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("size()", greaterThanOrEqualTo(3))
            .body("findAll { it.source == 'static' }.size()", greaterThanOrEqualTo(3));
    }

    @Test
    @Order(3)
    void cannot_delete_static_page() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .delete("/api/apps/helpdesk/pages/dashboard")
            .then().statusCode(409)
            .body("error", containsString("static"));
    }

    @Test
    @Order(4)
    void cannot_patch_static_page() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of("description", "hacked"))
            .patch("/api/apps/helpdesk/pages/dashboard")
            .then().statusCode(409)
            .body("error", containsString("immutable"));
    }

    @Test
    @Order(5)
    void cannot_create_page_with_static_name_collision() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "name", "Dashboard",
                "yaml", "name: Dashboard\ncomponents:\n  - type: title\n    properties:\n      text: Fake\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(409)
            .body("error", containsString("static"));
    }

    // --- Access control ---

    @Test
    @Order(6)
    void user_can_read_pages() {
        given()
            .header("Authorization", "Bearer " + userToken)
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200);
    }

    @Test
    @Order(7)
    void user_cannot_create_pages() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + userToken)
            .body(Map.of(
                "name", "user-page",
                "yaml", "name: user-page\ncomponents:\n  - type: title\n    properties:\n      text: No\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(403);
    }

    @Test
    @Order(8)
    void user_cannot_delete_pages() {
        given()
            .header("Authorization", "Bearer " + userToken)
            .delete("/api/apps/helpdesk/pages/some-page")
            .then().statusCode(403);
    }

    // --- YAML validation ---

    @Test
    @Order(9)
    void rejects_yaml_with_script_key() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "name", "xss-page",
                "yaml", "name: xss-page\ncomponents:\n  - script: alert(1)\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("script"));
    }

    @Test
    @Order(10)
    void rejects_yaml_with_root_level_variables() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "name", "yamlcore-page",
                "yaml", "variables:\n  x: 1\nname: yamlcore-page\ncomponents: []\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("variables"));
    }

    @Test
    @Order(11)
    void rejects_yaml_with_dataset_url() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "name", "ssrf-page",
                "yaml", "name: ssrf-page\ndatasets:\n  - uuid: ext\n    url: https://evil.com/data\ncomponents: []\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("url"));
    }

    @Test
    @Order(12)
    void rejects_page_without_name() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "yaml", "components:\n  - type: title\n"
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("name"));
    }

    @Test
    @Order(13)
    void rejects_page_without_yaml() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of("name", "no-yaml"))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(400)
            .body("error", containsString("yaml"));
    }

    // --- Label filtering ---

    @Test
    @Order(14)
    void label_filtering_on_list() {
        String name = "labeled-" + System.nanoTime();
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "name", name,
                "yaml", "name: " + name + "\ncomponents:\n  - type: title\n    properties:\n      text: Labeled\n",
                "labels", List.of("support/faq", "support/kb")
            ))
            .post("/api/apps/helpdesk/pages")
            .then().statusCode(201);

        // Filter matches
        given()
            .header("Authorization", "Bearer " + adminToken)
            .queryParam("label", "support")
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("find { it.name == '" + name + "' }", notNullValue());

        // Filter doesn't match
        given()
            .header("Authorization", "Bearer " + adminToken)
            .queryParam("label", "billing")
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("find { it.name == '" + name + "' }", nullValue());
    }

    // --- Metadata-only listing verification ---

    @Test
    @Order(15)
    void listing_excludes_yaml_field() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/helpdesk/pages")
            .then().statusCode(200)
            .body("[0].yaml", nullValue())
            .body("[0].name", notNullValue());
    }

    // --- Unknown app uses default access policy ---

    @Test
    @Order(16)
    void unknown_app_uses_default_access() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/nonexistent/pages")
            .then().statusCode(200);

        given()
            .header("Authorization", "Bearer " + userToken)
            .get("/api/apps/nonexistent/pages")
            .then().statusCode(200);
    }
}
