package io.casehub.pages.scenario.runtime;

import java.util.Map;

public record ExecutionResult(String stepName, boolean success,
                              Map<String, Object> result,
                              String error) {

    public static ExecutionResult ok(String stepName, Map<String, Object> result) {
        return new ExecutionResult(stepName, true, result, null);
    }

    public static ExecutionResult fail(String stepName, String error) {
        return new ExecutionResult(stepName, false, Map.of(), error);
    }
}
