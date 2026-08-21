package io.casehub.pages.scenario;

import java.util.Map;

public sealed interface Trigger {
    record AfterTrigger(String step, long delayMs) implements Trigger {}
    record TimeTrigger(long atMs) implements Trigger {}
    record DataTrigger(String endpoint, Map<String, Object> match,
                       long pollMs) implements Trigger {
        public DataTrigger {
            match = match != null ? Map.copyOf(match) : Map.of();
        }
    }
}
