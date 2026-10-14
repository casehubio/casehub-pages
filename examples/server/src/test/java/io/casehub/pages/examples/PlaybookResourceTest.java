package io.casehub.pages.examples;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class PlaybookResourceTest {

    @Test
    void manifest_returnsJson() {
        given()
            .when().get("/api/playbooks/manifest.json")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .header("Cache-Control", containsString("max-age=300"))
            .body("version", is("1.0.0"))
            .body("categories.size()", greaterThan(0));
    }

    @Test
    void yamlPlaybook_returnsYaml() {
        given()
            .when().get("/api/playbooks/flow-control/sequential.playbook.yaml")
            .then()
            .statusCode(200)
            .contentType("text/yaml")
            .header("Cache-Control", containsString("max-age=300"))
            .body(containsString("playbook:"));
    }

    @Test
    void missingPlaybook_returns404() {
        given()
            .when().get("/api/playbooks/nonexistent/missing.yaml")
            .then()
            .statusCode(404);
    }

    @Test
    void pathTraversal_returns404() {
        given()
            .when().get("/api/playbooks/../../../etc/passwd")
            .then()
            .statusCode(404);
    }
}
