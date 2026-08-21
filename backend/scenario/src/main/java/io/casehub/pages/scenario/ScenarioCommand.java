package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public record ScenarioCommand(String action, AriaTarget target,
                               String value, Map<String, Object> data,
                               String domain, AwaitCondition await,
                               Integer timeout) {
    public ScenarioCommand {
        Objects.requireNonNull(action, "action");
        data = data != null ? Map.copyOf(data) : null;
    }
}
