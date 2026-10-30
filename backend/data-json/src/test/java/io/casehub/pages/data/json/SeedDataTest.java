package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.data.DataContext;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class SeedDataTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    AppRegistry registry;

    @Inject
    JsonDataProvider provider;

    @Test
    void seeds_data_on_first_access() {
        DataContext ctx = new DataContext("seed-test");
        registry.ensureSeeded(ctx, "helpdesk", "tickets");

        Optional<JsonNode> ticket = provider.get(ctx, "tickets", "welcome-ticket");
        assertThat(ticket).isPresent();
        assertThat(ticket.get().get("title").asText()).isEqualTo("Welcome Ticket");
    }

    @Test
    void seed_is_idempotent() {
        DataContext ctx = new DataContext("seed-idempotent");
        registry.ensureSeeded(ctx, "helpdesk", "tickets");
        registry.ensureSeeded(ctx, "helpdesk", "tickets");

        Optional<JsonNode> ticket = provider.get(ctx, "tickets", "welcome-ticket");
        assertThat(ticket).isPresent();
    }

    @Test
    void seed_skips_if_collection_has_data() {
        DataContext ctx = new DataContext("seed-existing");
        var doc = MAPPER.createObjectNode().put("title", "Existing").put("priority", "low");
        provider.create(ctx, "tickets", doc, "title");

        registry.ensureSeeded(ctx, "helpdesk", "tickets");

        Optional<JsonNode> seeded = provider.get(ctx, "tickets", "welcome-ticket");
        assertThat(seeded).isEmpty();
    }

    @Test
    void seed_skips_unknown_app() {
        DataContext ctx = new DataContext("seed-unknown");
        registry.ensureSeeded(ctx, "nonexistent", "whatever");
    }
}
