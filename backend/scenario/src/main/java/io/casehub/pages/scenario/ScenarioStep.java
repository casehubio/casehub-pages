package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public record ScenarioStep(String action, AriaTarget target,
                           String value, Map<String, Object> state,
                           Integer timeout) {

    public ScenarioStep {
        Objects.requireNonNull(action, "action");
        state = state != null ? Map.copyOf(state) : null;
    }
}
