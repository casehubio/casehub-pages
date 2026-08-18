package io.casehub.pages.scenario;

import java.util.List;
import java.util.Objects;

public record Scenario(String scenario, List<ScenarioStep> steps) {

    public Scenario {
        Objects.requireNonNull(scenario, "scenario");
        Objects.requireNonNull(steps, "steps");
        steps = List.copyOf(steps);
    }
}
