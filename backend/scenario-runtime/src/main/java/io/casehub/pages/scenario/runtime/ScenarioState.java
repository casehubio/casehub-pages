package io.casehub.pages.scenario.runtime;

public record ScenarioState(String scenario, String chapter, String section,
                             String step, boolean paused, double speed,
                             double progress) {

    public static ScenarioState idle() {
        return new ScenarioState(null, null, null, null, false, 1.0, 0.0);
    }
}
