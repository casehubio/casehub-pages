package io.casehub.pages.scenario;

import java.util.List;

public record CompiledScenario(List<HierarchicalStep> steps, List<String> callRefs) {
    public CompiledScenario {
        steps = List.copyOf(steps);
        callRefs = callRefs != null ? List.copyOf(callRefs) : List.of();
    }
}
