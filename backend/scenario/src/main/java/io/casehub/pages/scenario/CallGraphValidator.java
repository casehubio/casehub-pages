package io.casehub.pages.scenario;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class CallGraphValidator {

    public record ScriptRef(String name, List<String> calls) {}

    private CallGraphValidator() {}

    public static void validate(String rootName,
                                 Function<String, Optional<ScriptRef>> resolver) {
        List<String> path = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        dfs(rootName, resolver, path, visited);
    }

    private static void dfs(String name,
                             Function<String, Optional<ScriptRef>> resolver,
                             List<String> path,
                             Set<String> visited) {
        if (path.contains(name)) {
            path.add(name);
            String cycle = path.subList(path.indexOf(name), path.size()).stream()
                    .collect(Collectors.joining(" → "));
            throw new IllegalArgumentException("Cycle detected in call graph: " + cycle);
        }

        if (visited.contains(name)) return;

        Optional<ScriptRef> ref = resolver.apply(name);
        if (ref.isEmpty()) return;

        path.add(name);
        for (String callee : ref.get().calls()) {
            dfs(callee, resolver, path, visited);
        }
        path.remove(path.size() - 1);
        visited.add(name);
    }
}
