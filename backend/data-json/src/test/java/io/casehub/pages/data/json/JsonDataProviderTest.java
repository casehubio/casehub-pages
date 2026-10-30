package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.ColumnDef;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.DataSetResult;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.QueryResult;
import io.casehub.pages.data.SortColumn;
import io.casehub.pages.data.SortOp;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class JsonDataProviderTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    JsonDataProvider provider;

    @Test
    void type_returns_json() {
        assertThat(provider.type()).isEqualTo("json");
    }

    @Test
    void canHandle_matches_json_prefix() {
        assertThat(provider.canHandle("json:helpdesk/tickets")).isTrue();
        assertThat(provider.canHandle("json:app/col")).isTrue();
        assertThat(provider.canHandle("sql:query")).isFalse();
        assertThat(provider.canHandle("other")).isFalse();
    }

    @Test
    void crud_through_provider() {
        DataContext ctx = new DataContext("integration-test");
        ObjectNode doc = MAPPER.createObjectNode().put("title", "Integration Test").put("status", "open");

        String id = provider.create(ctx, "tickets", doc, "title");
        assertThat(id).isEqualTo("integration-test");

        Optional<JsonNode> loaded = provider.get(ctx, "tickets", id);
        assertThat(loaded).isPresent();
        assertThat(loaded.get().get("title").asText()).isEqualTo("Integration Test");
        assertThat(loaded.get().get("_version").asInt()).isEqualTo(1);

        ObjectNode patch = MAPPER.createObjectNode().put("status", "closed");
        provider.update(ctx, "tickets", id, patch, OptionalInt.of(1));

        JsonNode updated = provider.get(ctx, "tickets", id).orElseThrow();
        assertThat(updated.get("status").asText()).isEqualTo("closed");
        assertThat(updated.get("_version").asInt()).isEqualTo(2);

        provider.delete(ctx, "tickets", id);
        assertThat(provider.get(ctx, "tickets", id)).isEmpty();
    }

    @Test
    void query_returns_flattened_tabular_result() {
        DataContext ctx = new DataContext("query-test");
        provider.create(ctx, "items",
            MAPPER.createObjectNode().put("title", "Alpha").put("priority", 1), "title");
        provider.create(ctx, "items",
            MAPPER.createObjectNode().put("title", "Beta").put("priority", 2), "title");

        DataSetLookup lookup = new DataSetLookup("json:query-test/items", List.of(), null);
        QueryResult result = provider.query(lookup);

        DataSetResult ds = result.result();
        assertThat(ds.columns()).isNotEmpty();
        assertThat(ds.columns().stream().map(ColumnDef::id))
            .contains("title", "priority");
        assertThat(ds.rows()).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    void query_with_filter_and_sort() {
        DataContext ctx = new DataContext("filter-sort-test");
        provider.create(ctx, "tasks",
            MAPPER.createObjectNode().put("title", "Task A").put("priority", 3), "title");
        provider.create(ctx, "tasks",
            MAPPER.createObjectNode().put("title", "Task B").put("priority", 1), "title");
        provider.create(ctx, "tasks",
            MAPPER.createObjectNode().put("title", "Task C").put("priority", 2), "title");

        FilterExpression filter = new FilterExpression.Numeric("priority", Map.of("gte", 2));
        SortOp sort = new SortOp(List.of(new SortColumn("priority", true)));
        DataSetLookup lookup = new DataSetLookup(
            "json:filter-sort-test/tasks",
            List.of(new FilterOp(List.of(filter)), sort),
            null);

        QueryResult result = provider.query(lookup);

        assertThat(result.result().rows()).hasSize(2);
    }

    @Test
    void hasReferences_returns_false() {
        DataContext ctx = new DataContext("ref-test");
        assertThat(provider.hasReferences(ctx, "col", "any-id")).isFalse();
    }
}
