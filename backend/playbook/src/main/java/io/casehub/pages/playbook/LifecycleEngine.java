package io.casehub.pages.playbook;

import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LifecycleEngine {

    private final LinkedHashMap<String, List<String>> transitions;
    private final String initialState;

    private LifecycleEngine(LinkedHashMap<String, List<String>> transitions, String initialState) {
        this.transitions = transitions;
        this.initialState = initialState;
    }

    public String initialState() {
        return initialState;
    }

    public List<String> states() {
        return List.copyOf(transitions.keySet());
    }

    public boolean canTransition(String currentState, String targetState) {
        List<String> targets = transitions.get(currentState);
        if (targets == null) return false;
        return targets.contains(targetState);
    }

    public void validateTransition(String currentState, String targetState) {
        if (!canTransition(currentState, targetState)) {
            throw new IllegalStateException(
                    "Cannot transition from '" + currentState + "' to '" + targetState + "'");
        }
    }

    public List<String> availableTransitions(String currentState) {
        List<String> targets = transitions.get(currentState);
        if (targets == null) {
            throw new IllegalArgumentException("Unknown state: '" + currentState + "'");
        }
        return targets;
    }

    @SuppressWarnings("unchecked")
    public static LifecycleEngine defaultEngine() {
        try (InputStream is = LifecycleEngine.class.getResourceAsStream("/lifecycle/default-lifecycle.yaml")) {
            if (is == null) throw new RuntimeException("default-lifecycle.yaml not found on classpath");
            Map<String, Object> raw = new Yaml().load(is);
            return fromYaml(raw);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to load default lifecycle", e);
        }
    }

    @SuppressWarnings("unchecked")
    static LifecycleEngine fromYaml(Map<String, Object> raw) {
        Map<String, Object> statesRaw = (Map<String, Object>) raw.get("states");
        if (statesRaw == null) throw new IllegalArgumentException("Lifecycle YAML must have a 'states' block");

        LinkedHashMap<String, List<String>> transitions = new LinkedHashMap<>();
        String initial = null;

        for (Map.Entry<String, Object> entry : statesRaw.entrySet()) {
            String stateName = entry.getKey();
            if (initial == null) initial = stateName;

            List<String> targets = new ArrayList<>();
            Object stateValue = entry.getValue();

            if (stateValue instanceof List<?> entries) {
                for (Object item : entries) {
                    if (item instanceof Map<?, ?> map) {
                        Object next = map.get("next");
                        if (next instanceof String nextState) {
                            if (!targets.contains(nextState)) targets.add(nextState);
                        }
                        Object on = map.get("on");
                        if (on == null) on = map.get(Boolean.TRUE);
                        if (on instanceof Map<?, ?> events) {
                            for (Object target : events.values()) {
                                if (target instanceof String t && !targets.contains(t)) {
                                    targets.add(t);
                                }
                            }
                        }
                    }
                }
            }

            transitions.put(stateName, List.copyOf(targets));
        }

        return new LifecycleEngine(transitions, initial);
    }
}
