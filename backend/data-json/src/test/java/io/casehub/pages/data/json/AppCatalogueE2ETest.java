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
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AppCatalogueE2ETest {

    private static final String APP_ID = "demo-crm";

    private String adminToken;

    @BeforeEach
    void login() {
        adminToken = given()
            .contentType(ContentType.JSON)
            .body(Map.of("name", "admin", "roles", List.of("admin", "developer")))
            .post("/dev/auth/login")
            .then().statusCode(200)
            .extract().path("token");
    }

    @Test
    @Order(1)
    void catalogue_shows_auto_seeded_apps() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/platform/apps")
            .then().statusCode(200)
            .body("size()", greaterThanOrEqualTo(3))
            .body("appId", hasItem("helpdesk"))
            .body("appId", hasItem("contacts"))
            .body("appId", hasItem("tasks"));
    }

    @Test
    @Order(2)
    void add_app_to_catalogue() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of(
                "appId", APP_ID,
                "name", "CRM",
                "description", "Customer relationship management",
                "icon", "people",
                "route", "/crm",
                "order", 10
            ))
            .post("/api/apps/platform/apps")
            .then().statusCode(201)
            .body("appId", equalTo(APP_ID))
            .body("name", equalTo("CRM"));
    }

    @Test
    @Order(3)
    void verify_app_appears_in_catalogue() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/platform/apps")
            .then().statusCode(200)
            .body("appId", hasItem(APP_ID));
    }

    @Test
    @Order(4)
    void update_app_in_catalogue() {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body(Map.of("description", "Enterprise CRM solution"))
            .patch("/api/apps/platform/apps/" + APP_ID)
            .then().statusCode(200)
            .body("description", equalTo("Enterprise CRM solution"))
            .body("name", equalTo("CRM"));
    }

    @Test
    @Order(5)
    void remove_app_from_catalogue() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .delete("/api/apps/platform/apps/" + APP_ID)
            .then().statusCode(204);

        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/platform/apps")
            .then().statusCode(200)
            .body("appId", not(hasItem(APP_ID)));
    }

    @Test
    @Order(6)
    void static_apps_cannot_be_removed() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .delete("/api/apps/platform/apps/helpdesk")
            .then().statusCode(409);

        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/platform/apps")
            .then().statusCode(200)
            .body("appId", hasItem("helpdesk"));
    }

    @Test
    @Order(7)
    void get_individual_app_entry() {
        given()
            .header("Authorization", "Bearer " + adminToken)
            .get("/api/apps/platform/apps/contacts")
            .then().statusCode(200)
            .body("appId", equalTo("contacts"))
            .body("name", equalTo("Contacts"))
            .body("source", equalTo("static"))
            .header("ETag", notNullValue());
    }
}
