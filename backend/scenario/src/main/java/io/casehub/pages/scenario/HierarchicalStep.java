package io.casehub.pages.scenario;

import java.util.List;
import java.util.Objects;

public record HierarchicalStep(String name, String label, String target,
                                String actor, Trigger trigger,
                                List<ScenarioCommand> commands) {
    public HierarchicalStep {
        Objects.requireNonNull(label, "label");
        Objects.requireNonNull(target, "target");
        commands = commands != null ? List.copyOf(commands) : List.of();
    }
}
