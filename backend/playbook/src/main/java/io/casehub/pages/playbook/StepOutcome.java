package io.casehub.pages.playbook;

import java.util.Map;

public record StepOutcome(boolean success, String stepName,
                          Map<String, Object> result, String error) {
    public static StepOutcome ok(String stepName, Map<String, Object> result) {
        return new StepOutcome(true, stepName, result, null);
    }

    public static StepOutcome fail(String stepName, String error) {
        return new StepOutcome(false, stepName, Map.of(), error);
    }
}
