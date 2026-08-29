package io.casehub.pages.scenario;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

public record HierarchicalScenario(
        String scenario, String description,
        double speed, String onError,
        List<ParamDescriptor> params, ScriptMeta meta,
        Map<String, Object> data, Map<String, Object> iterations,
        String slides,
        List<ScenarioChapter> chapters,
        List<ScenarioSection> sections,
        List<HierarchicalStep> steps) {

    public HierarchicalScenario {
        Objects.requireNonNull(scenario, "scenario");
        params     = params != null ? List.copyOf(params) : List.of();
        data       = data != null ? Map.copyOf(data) : Map.of();
        iterations = iterations != null ? Map.copyOf(iterations) : Map.of();
    }

    public Stream<HierarchicalStep> allSteps() {
        if (chapters != null) {
            return chapters.stream()
                           .flatMap(c -> c.sections().stream())
                           .flatMap(s -> s.steps().stream());
        }
        if (sections != null) {
            return sections.stream().flatMap(s -> s.steps().stream());
        }
        return steps != null ? steps.stream() : Stream.empty();
    }
}
