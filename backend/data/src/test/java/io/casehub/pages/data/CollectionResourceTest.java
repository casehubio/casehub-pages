package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class CollectionResourceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Alternative
    @Priority(1)
    @ApplicationScoped
    static class TestMutableDataProvider implements MutableDataProvider {

        @Override
        public String type() { return "test-mutable"; }

        @Override
        public boolean canHandle(String dataSetId) {
            return dataSetId.startsWith("json:");
        }

        @Override
        public QueryResult query(DataSetLookup lookup) {
            return QueryResult.complete(new DataSetResult(List.of(), List.of()));
        }

        @Override
        public Optional<JsonNode> get(DataContext ctx, String collection, String docId) {
            if ("not-found".equals(docId)) return Optional.empty();
            ObjectNode doc = MAPPER.createObjectNode();
            doc.put("_id", docId);
            doc.put("_version", 1);
            doc.put("_created_at", "2026-10-30T10:00:00Z");
            doc.put("_updated_at", "2026-10-30T10:00:00Z");
            doc.put("title", "Test Document");
            return Optional.of(doc);
        }

        @Override
        public String create(DataContext ctx, String collection,
                             JsonNode document, String slugField) {
            return "test-document";
        }

        @Override
        public void update(DataContext ctx, String collection, String docId,
                           JsonNode changes, OptionalInt expectedVersion) {
            if (expectedVersion.isPresent() && expectedVersion.getAsInt() == 99) {
                throw new MutationException("VERSION_CONFLICT",
                    "expected 99, found 1");
            }
        }

        @Override
        public void delete(DataContext ctx, String collection, String docId) {
            if ("not-found".equals(docId)) {
                throw new MutationException("NOT_FOUND", "document not found");
            }
        }

        @Override
        public boolean hasReferences(DataContext ctx, String collection, String docId) {
            return "referenced-doc".equals(docId);
        }
    }

    private String validToken() {
        return Jwt.claims()
            .subject("alice")
            .claim("tenant_id", "dev")
            .groups(Set.of("user"))
            .sign();
    }

    private String tokenWithoutTenant() {
        return Jwt.claims()
            .subject("alice")
            .groups(Set.of("user"))
            .sign();
    }

    @Test
    void post_creates_document_returns_201() {
        given()
            .auth().oauth2(validToken())
            .contentType(ContentType.JSON)
            .body("{\"title\":\"New Ticket\"}")
            .when()
            .post("/api/collections/helpdesk/tickets")
            .then()
            .statusCode(201)
            .header("Location", endsWith("/api/collections/helpdesk/tickets/test-document"))
            .header("ETag", equalTo("\"1\""))
            .body("_id", equalTo("test-document"));
    }

    @Test
    void post_with_slug_field_query_param() {
        given()
            .auth().oauth2(validToken())
            .contentType(ContentType.JSON)
            .queryParam("slugField", "name")
            .body("{\"name\":\"My Item\"}")
            .when()
            .post("/api/collections/helpdesk/tickets")
            .then()
            .statusCode(201);
    }

    @Test
    void get_returns_document_with_etag() {
        given()
            .auth().oauth2(validToken())
            .when()
            .get("/api/collections/helpdesk/tickets/my-ticket")
            .then()
            .statusCode(200)
            .header("ETag", equalTo("\"1\""))
            .body("_id", equalTo("my-ticket"))
            .body("title", equalTo("Test Document"));
    }

    @Test
    void get_not_found_returns_404() {
        given()
            .auth().oauth2(validToken())
            .when()
            .get("/api/collections/helpdesk/tickets/not-found")
            .then()
            .statusCode(404)
            .body("code", equalTo("NOT_FOUND"));
    }

    @Test
    void patch_with_if_match_returns_200() {
        given()
            .auth().oauth2(validToken())
            .contentType(ContentType.JSON)
            .header("If-Match", "\"1\"")
            .body("{\"priority\":\"high\"}")
            .when()
            .patch("/api/collections/helpdesk/tickets/my-ticket")
            .then()
            .statusCode(200)
            .header("ETag", equalTo("\"1\""))
            .body("_id", equalTo("my-ticket"));
    }

    @Test
    void patch_without_if_match_succeeds() {
        given()
            .auth().oauth2(validToken())
            .contentType(ContentType.JSON)
            .body("{\"priority\":\"high\"}")
            .when()
            .patch("/api/collections/helpdesk/tickets/my-ticket")
            .then()
            .statusCode(200);
    }

    @Test
    void patch_version_conflict_returns_409() {
        given()
            .auth().oauth2(validToken())
            .contentType(ContentType.JSON)
            .header("If-Match", "\"99\"")
            .body("{\"priority\":\"high\"}")
            .when()
            .patch("/api/collections/helpdesk/tickets/my-ticket")
            .then()
            .statusCode(409)
            .body("code", equalTo("VERSION_CONFLICT"));
    }

    @Test
    void delete_returns_204() {
        given()
            .auth().oauth2(validToken())
            .when()
            .delete("/api/collections/helpdesk/tickets/my-ticket")
            .then()
            .statusCode(204);
    }

    @Test
    void delete_referenced_doc_returns_409() {
        given()
            .auth().oauth2(validToken())
            .when()
            .delete("/api/collections/helpdesk/tickets/referenced-doc")
            .then()
            .statusCode(409)
            .body("code", equalTo("REF_DELETE_BLOCKED"));
    }

    @Test
    void missing_tenant_returns_401() {
        given()
            .auth().oauth2(tokenWithoutTenant())
            .contentType(ContentType.JSON)
            .body("{\"title\":\"test\"}")
            .when()
            .post("/api/collections/helpdesk/tickets")
            .then()
            .statusCode(401)
            .body("error", equalTo("Missing claim: tenant_id"));
    }

    @Test
    void no_auth_returns_401() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"test\"}")
            .when()
            .post("/api/collections/helpdesk/tickets")
            .then()
            .statusCode(401);
    }
}
