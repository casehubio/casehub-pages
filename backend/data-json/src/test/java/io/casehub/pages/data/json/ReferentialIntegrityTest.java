package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataContext;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class ReferentialIntegrityTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    JsonDataProvider provider;

    @Inject
    AppRegistry registry;

    @Test
    void hasReferences_returns_true_when_referenced() {
        DataContext ctx = new DataContext("ref-integrity");

        ObjectNode agent = MAPPER.createObjectNode()
            .put("name", "Agent One")
            .put("email", "one@test.com");
        String agentId = provider.create(ctx, "agents", agent, "name");

        ObjectNode ticket = MAPPER.createObjectNode()
            .put("title", "Ref Test Ticket")
            .put("priority", "low")
            .put("assignee", agentId);
        provider.create(ctx, "tickets", ticket, "title");

        assertThat(provider.hasReferences(ctx, "agents", agentId)).isTrue();
    }

    @Test
    void hasReferences_returns_false_when_not_referenced() {
        DataContext ctx = new DataContext("ref-integrity-none");

        ObjectNode agent = MAPPER.createObjectNode()
            .put("name", "Lonely Agent")
            .put("email", "lonely@test.com");
        String agentId = provider.create(ctx, "agents", agent, "name");

        assertThat(provider.hasReferences(ctx, "agents", agentId)).isFalse();
    }

    @Test
    void hasReferences_returns_false_for_unregistered_collections() {
        DataContext ctx = new DataContext("ref-unreg");
        assertThat(provider.hasReferences(ctx, "unknown-collection", "any-id")).isFalse();
    }
}
