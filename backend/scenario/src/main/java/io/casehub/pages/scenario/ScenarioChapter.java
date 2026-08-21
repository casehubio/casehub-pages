package io.casehub.pages.scenario;

import java.util.List;
import java.util.Objects;

public record ScenarioChapter(String label, List<ScenarioSection> sections) {
    public ScenarioChapter {
        Objects.requireNonNull(label, "label");
        sections = sections != null ? List.copyOf(sections) : List.of();
    }
}
