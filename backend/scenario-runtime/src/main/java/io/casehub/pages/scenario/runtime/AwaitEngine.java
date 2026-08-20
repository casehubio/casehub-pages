package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.AwaitCondition;

import java.util.Map;
import java.util.function.Supplier;

public class AwaitEngine {

    private final Supplier<Map<String, Object>> queryExecutor;

    public AwaitEngine(Supplier<Map<String, Object>> queryExecutor) {
        this.queryExecutor = queryExecutor;
    }

    public Map<String, Object> poll(AwaitCondition condition) {
        long deadline = System.currentTimeMillis() + condition.timeout();

        while (System.currentTimeMillis() < deadline) {
            Map<String, Object> result = queryExecutor.get();
            if (matches(result, condition.match())) {
                return result;
            }
            try {
                Thread.sleep(condition.interval());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Await interrupted", e);
            }
        }

        throw new RuntimeException("Await timed out after " + condition.timeout()
                + "ms. Condition not met: " + condition.match());
    }

    private boolean matches(Map<String, Object> result, Map<String, Object> expected) {
        for (var entry : expected.entrySet()) {
            Object actual = result.get(entry.getKey());
            if (!entry.getValue().equals(actual)) {
                return false;
            }
        }
        return true;
    }
}
