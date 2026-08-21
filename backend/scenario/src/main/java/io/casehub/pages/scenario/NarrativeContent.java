package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public sealed interface NarrativeContent {

    record Inline(String markdown) implements NarrativeContent {
        public Inline { Objects.requireNonNull(markdown, "markdown"); }
    }

    record Template(String path, String section,
                    Map<String, Object> params) implements NarrativeContent {
        public Template {
            Objects.requireNonNull(path, "path");
            params = params != null ? Map.copyOf(params) : Map.of();
        }
    }

    record Slide(Object ref) implements NarrativeContent {
        public Slide { Objects.requireNonNull(ref, "ref"); }
    }
}
