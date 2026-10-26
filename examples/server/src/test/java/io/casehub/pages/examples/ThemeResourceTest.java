package io.casehub.pages.examples;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ThemeResourceTest {

    @TempDir
    static Path tempDir;

    @BeforeEach
    void setUp() throws IOException {
        System.setProperty("casehub.pages.themes.directory", tempDir.toString());
        for (var file : Files.list(tempDir).toList()) {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void list_empty_returnsEmptyArray() {
        given()
            .when().get("/api/themes")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .body("$", hasSize(0));
    }

    @Test
    void put_then_get_roundTrips() {
        String config = """
            {"primary":"#ff0000","secondary":"#00ff00"}""";

        given()
            .contentType("application/json")
            .body(config)
            .when().put("/api/themes/dark")
            .then()
            .statusCode(204);

        given()
            .when().get("/api/themes/dark")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .body("primary", is("#ff0000"))
            .body("secondary", is("#00ff00"));
    }

    @Test
    void list_afterPut_containsName() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().put("/api/themes/ocean")
            .then()
            .statusCode(204);

        given()
            .when().get("/api/themes")
            .then()
            .statusCode(200)
            .body("$", hasItem("ocean"));
    }

    @Test
    void get_missing_returns404() {
        given()
            .when().get("/api/themes/nonexistent")
            .then()
            .statusCode(404);
    }

    @Test
    void delete_removes_theme() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().put("/api/themes/toDelete")
            .then()
            .statusCode(204);

        given()
            .when().delete("/api/themes/toDelete")
            .then()
            .statusCode(204);

        given()
            .when().get("/api/themes/toDelete")
            .then()
            .statusCode(404);
    }

    @Test
    void delete_missing_returns204() {
        given()
            .when().delete("/api/themes/doesNotExist")
            .then()
            .statusCode(204);
    }

    @Test
    void put_overwrite_updatesContent() {
        given()
            .contentType("application/json")
            .body("{\"v\":1}")
            .when().put("/api/themes/mutable")
            .then()
            .statusCode(204);

        given()
            .contentType("application/json")
            .body("{\"v\":2}")
            .when().put("/api/themes/mutable")
            .then()
            .statusCode(204);

        given()
            .when().get("/api/themes/mutable")
            .then()
            .statusCode(200)
            .body("v", is(2));
    }

    @Test
    void nameWithDoubleDot_rejected() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().put("/api/themes/..theme")
            .then()
            .statusCode(400);
    }
}
