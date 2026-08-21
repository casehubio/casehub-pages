package io.casehub.pages.scenario;

import java.util.List;
import java.util.Objects;

public record ScenarioSection(String label, List<HierarchicalStep> steps) {
    public ScenarioSection {
        Objects.requireNonNull(label, "label");
        steps = steps != null ? List.copyOf(steps) : List.of();
    }
}
