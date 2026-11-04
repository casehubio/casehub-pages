package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import io.casehub.pages.data.DataContext;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class PageBootstrapTest {

    @Inject
    AppRegistry appRegistry;

    @Test
    void seeds_static_pages_from_classpath() {
        DataContext ctx = new DataContext("platform");
        JsonCollectionStore store = appRegistry.getStore();

        Optional<JsonNode> dashboard = store.get(ctx, "platform", "_pages", "dashboard");
        assertThat(dashboard).isPresent();
        assertThat(dashboard.get().get("source").asText()).isEqualTo("static");
        assertThat(dashboard.get().get("sourceHash").asText()).isNotBlank();
        assertThat(dashboard.get().get("yaml").asText()).contains("type:");
    }

    @Test
    void static_pages_have_correct_names() {
        DataContext ctx = new DataContext("platform");
        JsonCollectionStore store = appRegistry.getStore();

        var pages = store.listAll("platform", "platform", "_pages");
        var names = pages.stream()
            .map(p -> p.get("name").asText())
            .toList();

        assertThat(names).contains("Dashboard", "Ticket Queue", "Agents");
    }
}
