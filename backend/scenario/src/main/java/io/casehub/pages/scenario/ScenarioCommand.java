package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public record ScenarioCommand(String action, AriaTarget target,
                              String value, Map<String, Object> data,
                              String domain, AwaitCondition await,
                              Integer timeout, DataMode mode,
                              String source, Integer interval,
                              String script, Map<String, Object> callParams) {

    public enum DataMode {SINGLE, BULK, STEPPED, STREAM}

    public ScenarioCommand {
        Objects.requireNonNull(action, "action");
        data       = data != null ? Map.copyOf(data) : null;
        callParams = callParams != null ? Map.copyOf(callParams) : null;
        if (mode == null) {mode = DataMode.SINGLE;}
    }

    public ScenarioCommand(String action, AriaTarget target,
                           String value, Map<String, Object> data,
                           String domain, AwaitCondition await,
                           Integer timeout, DataMode mode,
                           String source, Integer interval) {
        this(action, target, value, data, domain, await, timeout,
             mode, source, interval, null, null);
    }

    public ScenarioCommand(String action, AriaTarget target,
                           String value, Map<String, Object> data,
                           String domain, AwaitCondition await,
                           Integer timeout) {
        this(action, target, value, data, domain, await, timeout,
             DataMode.SINGLE, null, null, null, null);
    }
}
