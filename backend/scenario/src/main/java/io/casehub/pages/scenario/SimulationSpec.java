package io.casehub.pages.scenario;

import java.util.List;
import java.util.Map;

public record SimulationSpec(
        Map<String, String> strategies,
        List<String> corpus,
        List<String> capture) {

    public SimulationSpec {
        strategies = strategies != null ? Map.copyOf(strategies) : Map.of();
        corpus = corpus != null ? List.copyOf(corpus) : List.of();
        capture = capture != null ? List.copyOf(capture) : List.of();
    }
}
