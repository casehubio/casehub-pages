package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

@com.fasterxml.jackson.annotation.JsonTypeInfo(use = com.fasterxml.jackson.annotation.JsonTypeInfo.Id.NAME, property = "type")
@com.fasterxml.jackson.annotation.JsonSubTypes({
        @com.fasterxml.jackson.annotation.JsonSubTypes.Type(value = NarrativeContent.Inline.class, name = "inline"),
        @com.fasterxml.jackson.annotation.JsonSubTypes.Type(value = NarrativeContent.Template.class, name = "template"),
        @com.fasterxml.jackson.annotation.JsonSubTypes.Type(value = NarrativeContent.Slide.class, name = "slide"),
})
public sealed interface NarrativeContent {

    record Inline(String markdown) implements NarrativeContent {
        public Inline {java.util.Objects.requireNonNull(markdown, "markdown");}
    }

    record Template(String path, String section,
                    java.util.Map<String, Object> params) implements NarrativeContent {
        public Template {
            java.util.Objects.requireNonNull(path, "path");
            params = params != null ? java.util.Map.copyOf(params) : java.util.Map.of();
        }
    }

    record Slide(Object ref) implements NarrativeContent {
        public Slide {java.util.Objects.requireNonNull(ref, "ref");}
    }
}
