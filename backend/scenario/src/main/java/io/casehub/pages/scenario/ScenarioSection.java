package io.casehub.pages.scenario;

import java.util.List;
import java.util.Objects;

public record ScenarioSection(String label, NarrativeContent content,
                               List<HierarchicalStep> steps) {
    public ScenarioSection {
        Objects.requireNonNull(label, "label");
        steps = steps != null ? List.copyOf(steps) : List.of();
    }

    public ScenarioSection(String label, List<HierarchicalStep> steps) {
        this(label, null, steps);
    }
}
