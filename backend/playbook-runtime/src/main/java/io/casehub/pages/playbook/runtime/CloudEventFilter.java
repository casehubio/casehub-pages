package io.casehub.pages.playbook.runtime;

import java.util.Map;

public final class CloudEventFilter {

    private CloudEventFilter() {}

    public static boolean matches(Map<String, String> filter,
                                  Map<String, Object> eventData) {
        if (filter.isEmpty()) return true;
        if (eventData == null) return false;

        for (var entry : filter.entrySet()) {
            Object resolved = resolve(entry.getKey(), eventData);
            if (resolved == null) return false;
            if (!String.valueOf(resolved).equals(entry.getValue())) return false;
        }
        return true;
    }

    @SuppressWarnings("unchecked")
    private static Object resolve(String key, Map<String, Object> data) {
        String[] segments = key.split("\\.");
        Object current = data;
        for (String segment : segments) {
            if (current instanceof Map<?, ?> map) {
                current = map.get(segment);
                if (current == null) return null;
            } else {
                return null;
            }
        }
        return current;
    }
}
