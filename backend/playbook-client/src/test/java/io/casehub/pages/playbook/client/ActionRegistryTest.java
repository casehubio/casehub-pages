package io.casehub.pages.playbook.client;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ActionRegistryTest {

    @Test
    void discoversAnnotatedMethods() {
        var registry = ActionRegistry.scan(List.of(new TestActions()));
        assertThat(registry.actions()).containsExactlyInAnyOrder("greet", "farewell");
    }

    @Test
    void invokesMatchingAction() throws Exception {
        var registry = ActionRegistry.scan(List.of(new TestActions()));
        var ctx = ActionContext.of("admin", Map.of("name", "Alice"), Map.of());
        var result = registry.invoke("greet", ctx);
        assertThat(result).containsEntry("greeting", "Hello Alice");
    }

    @Test
    void invokesVoidAction() throws Exception {
        var registry = ActionRegistry.scan(List.of(new TestActions()));
        var ctx = ActionContext.of("admin", Map.of(), Map.of());
        var result = registry.invoke("farewell", ctx);
        assertThat(result).isEmpty();
    }

    @Test
    void throwsForUnknownAction() {
        var registry = ActionRegistry.scan(List.of(new TestActions()));
        var ctx = ActionContext.of("admin", Map.of(), Map.of());
        assertThatThrownBy(() -> registry.invoke("unknown", ctx))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("unknown");
    }

    @Test
    void scansMultipleBeans() {
        var registry = ActionRegistry.scan(List.of(new TestActions(), new MoreActions()));
        assertThat(registry.actions()).containsExactlyInAnyOrder("greet", "farewell", "ping");
    }

    @Test
    void invokesPingAction() throws Exception {
        var registry = ActionRegistry.scan(List.of(new MoreActions()));
        var ctx = ActionContext.of(null, Map.of(), Map.of());
        var result = registry.invoke("ping", ctx);
        assertThat(result).containsEntry("pong", true);
    }

    static class TestActions {
        @PlaybookAction("greet")
        Map<String, Object> greet(ActionContext ctx) {
            return Map.of("greeting", "Hello " + ctx.data("name"));
        }

        @PlaybookAction("farewell")
        void farewell(ActionContext ctx) {
            // no-op
        }
    }

    static class MoreActions {
        @PlaybookAction("ping")
        Map<String, Object> ping(ActionContext ctx) {
            return Map.of("pong", true);
        }
    }
}
