package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.MutationException;
import io.casehub.pages.sqlite.SqliteConnectionFactory;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.OptionalInt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@QuarkusTest
class JsonCollectionStoreTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DataContext CTX = new DataContext("tenant-1");

    @Inject
    SqliteConnectionFactory connectionFactory;

    JsonCollectionStore store;

    @BeforeEach
    void setUp() {
        store = new JsonCollectionStore(connectionFactory);
    }

    @Test
    void create_and_get_document() {
        ObjectNode doc = MAPPER.createObjectNode().put("title", "My Ticket").put("priority", "high");
        String docId = store.create(CTX, "helpdesk", "tickets", doc, "title");

        assertThat(docId).isEqualTo("my-ticket");

        Optional<JsonNode> loaded = store.get(CTX, "helpdesk", "tickets", docId);
        assertThat(loaded).isPresent();
        assertThat(loaded.get().get("_id").asText()).isEqualTo("my-ticket");
        assertThat(loaded.get().get("_version").asInt()).isEqualTo(1);
        assertThat(loaded.get().get("title").asText()).isEqualTo("My Ticket");
        assertThat(loaded.get().get("priority").asText()).isEqualTo("high");
        assertThat(loaded.get().has("_created_at")).isTrue();
        assertThat(loaded.get().has("_updated_at")).isTrue();
    }

    @Test
    void create_with_explicit_id() {
        ObjectNode doc = MAPPER.createObjectNode().put("_id", "custom-id").put("title", "Test");
        String docId = store.create(CTX, "helpdesk", "items", doc, "title");

        assertThat(docId).isEqualTo("custom-id");
    }

    @Test
    void create_generates_uuid_when_no_slug() {
        ObjectNode doc = MAPPER.createObjectNode().put("data", 42);
        String docId = store.create(CTX, "helpdesk", "counters", doc, "title");

        assertThat(docId).isNotBlank();
        assertThat(docId).hasSizeGreaterThan(8);
    }

    @Test
    void get_returns_empty_for_missing_doc() {
        Optional<JsonNode> result = store.get(CTX, "helpdesk", "tickets", "nonexistent");
        assertThat(result).isEmpty();
    }

    @Test
    void update_with_rfc7396_merge() {
        ObjectNode doc = MAPPER.createObjectNode().put("title", "Ticket").put("priority", "low");
        store.create(CTX, "helpdesk", "updates", doc, "title");

        ObjectNode patch = MAPPER.createObjectNode().put("priority", "high");
        store.update(CTX, "helpdesk", "updates", "ticket", patch, OptionalInt.empty(), MergeStrategy.RFC_7396);

        JsonNode updated = store.get(CTX, "helpdesk", "updates", "ticket").orElseThrow();
        assertThat(updated.get("priority").asText()).isEqualTo("high");
        assertThat(updated.get("title").asText()).isEqualTo("Ticket");
        assertThat(updated.get("_version").asInt()).isEqualTo(2);
    }

    @Test
    void update_version_conflict_throws() {
        ObjectNode doc = MAPPER.createObjectNode().put("title", "Conflict Test");
        store.create(CTX, "helpdesk", "conflicts", doc, "title");

        ObjectNode patch = MAPPER.createObjectNode().put("title", "Updated");
        assertThatThrownBy(() ->
            store.update(CTX, "helpdesk", "conflicts", "conflict-test", patch, OptionalInt.of(99), MergeStrategy.RFC_7396))
            .isInstanceOf(MutationException.class)
            .extracting(e -> ((MutationException) e).code())
            .isEqualTo("VERSION_CONFLICT");
    }

    @Test
    void update_not_found_throws() {
        ObjectNode patch = MAPPER.createObjectNode().put("title", "Updated");
        assertThatThrownBy(() ->
            store.update(CTX, "helpdesk", "missing", "nonexistent", patch, OptionalInt.empty(), MergeStrategy.RFC_7396))
            .isInstanceOf(MutationException.class)
            .extracting(e -> ((MutationException) e).code())
            .isEqualTo("NOT_FOUND");
    }

    @Test
    void delete_removes_document() {
        ObjectNode doc = MAPPER.createObjectNode().put("title", "To Delete");
        store.create(CTX, "helpdesk", "deletions", doc, "title");

        store.delete(CTX, "helpdesk", "deletions", "to-delete");
        assertThat(store.get(CTX, "helpdesk", "deletions", "to-delete")).isEmpty();
    }

    @Test
    void delete_not_found_throws() {
        assertThatThrownBy(() ->
            store.delete(CTX, "helpdesk", "missing", "nonexistent"))
            .isInstanceOf(MutationException.class)
            .extracting(e -> ((MutationException) e).code())
            .isEqualTo("NOT_FOUND");
    }

    @Test
    void slug_collision_appends_suffix() {
        ObjectNode doc1 = MAPPER.createObjectNode().put("title", "Same Title");
        ObjectNode doc2 = MAPPER.createObjectNode().put("title", "Same Title");

        String id1 = store.create(CTX, "helpdesk", "slugs", doc1, "title");
        String id2 = store.create(CTX, "helpdesk", "slugs", doc2, "title");

        assertThat(id1).isEqualTo("same-title");
        assertThat(id2).isEqualTo("same-title-2");
    }

    @Test
    void rfc7396_null_removes_field() {
        ObjectNode doc = MAPPER.createObjectNode().put("title", "Nulls").put("priority", "low");
        store.create(CTX, "helpdesk", "nulltest", doc, "title");

        ObjectNode patch = MAPPER.createObjectNode();
        patch.putNull("priority");
        store.update(CTX, "helpdesk", "nulltest", "nulls", patch, OptionalInt.empty(), MergeStrategy.RFC_7396);

        JsonNode updated = store.get(CTX, "helpdesk", "nulltest", "nulls").orElseThrow();
        assertThat(updated.has("priority")).isFalse();
        assertThat(updated.get("title").asText()).isEqualTo("Nulls");
    }
}
