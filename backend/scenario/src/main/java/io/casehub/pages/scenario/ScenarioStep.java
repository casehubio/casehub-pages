package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public sealed interface ScenarioStep {

    String name();

    record AriaStep(String name, String action, AriaTarget target,
                    String value, Map<String, Object> state,
                    Integer timeout) implements ScenarioStep {
        public AriaStep {
            Objects.requireNonNull(action, "action");
            state = state != null ? Map.copyOf(state) : null;
        }
    }

    record GenericStep(String name, String delivery,
                       Map<String, Object> data) implements ScenarioStep {
        public GenericStep {
            Objects.requireNonNull(delivery, "delivery");
            data = data != null ? Map.copyOf(data) : Map.of();
        }
    }
}
