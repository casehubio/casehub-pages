package io.casehub.pages.scenario.runtime;

import io.casehub.pages.push.PushRequest;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

public class ExecutorRegistry {

    public record ExecutorInfo(String name, String connectionId, List<String> actions) {
        public ExecutorInfo {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(connectionId, "connectionId");
            actions = actions != null ? List.copyOf(actions) : List.of();
        }
    }

    private final Map<String, ExecutorInfo> byName = new ConcurrentHashMap<>();
    private final Map<String, ExecutorInfo> byConnection = new ConcurrentHashMap<>();

    public void register(String connectionId, PushRequest.ExecutorRegister reg) {
        var info = new ExecutorInfo(reg.name(), connectionId, reg.actions());
        byName.put(reg.name(), info);
        byConnection.put(connectionId, info);
    }

    public ExecutorInfo get(String executorName) {
        return byName.get(executorName);
    }

    public boolean hasExecutor(String name) {
        return byName.containsKey(name);
    }

    public Collection<ExecutorInfo> all() {
        return byName.values();
    }

    public void removeConnection(String connectionId) {
        var info = byConnection.remove(connectionId);
        if (info != null) {
            byName.remove(info.name());
        }
    }
}
