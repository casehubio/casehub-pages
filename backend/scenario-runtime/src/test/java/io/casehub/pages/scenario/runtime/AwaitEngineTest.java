package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.AwaitCondition;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AwaitEngineTest {

    @Test
    void matchesImmediately() {
        var callCount = new AtomicInteger(0);
        var engine = new AwaitEngine(() -> {
            callCount.incrementAndGet();
            return Map.of("status", "RESOLVED");
        });

        var condition = new AwaitCondition(Map.of("status", "RESOLVED"), 5000, 100);
        Map<String, Object> result = engine.poll(condition);

        assertThat(result).containsEntry("status", "RESOLVED");
        assertThat(callCount.get()).isEqualTo(1);
    }

    @Test
    void pollsUntilMatch() {
        var callCount = new AtomicInteger(0);
        var engine = new AwaitEngine(() -> {
            int n = callCount.incrementAndGet();
            return Map.of("status", n >= 3 ? "RESOLVED" : "PENDING");
        });

        var condition = new AwaitCondition(Map.of("status", "RESOLVED"), 5000, 50);
        Map<String, Object> result = engine.poll(condition);

        assertThat(result).containsEntry("status", "RESOLVED");
        assertThat(callCount.get()).isEqualTo(3);
    }

    @Test
    void timesOut() {
        var engine = new AwaitEngine(() -> Map.of("status", "PENDING"));

        var condition = new AwaitCondition(Map.of("status", "RESOLVED"), 200, 50);
        assertThatThrownBy(() -> engine.poll(condition))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("timed out");
    }

    @Test
    void matchesMultipleFields() {
        var engine = new AwaitEngine(() ->
                Map.of("status", "RESOLVED", "category", "HARDWARE"));

        var condition = new AwaitCondition(
                Map.of("status", "RESOLVED", "category", "HARDWARE"), 5000, 100);
        Map<String, Object> result = engine.poll(condition);

        assertThat(result).containsEntry("category", "HARDWARE");
    }
}
