package io.casehub.pages.scenario.runtime;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VariableContext {

    private static final Pattern VAR_PATTERN = Pattern.compile("\\$\\{([^}]+)}");

    private final Map<String, Map<String, Object>> stepResults = new LinkedHashMap<>();

    public void put(String stepName, Map<String, Object> result) {
        stepResults.put(stepName, result);
    }

    public String resolve(String template) {
        if (template == null || !template.contains("${")) {
            return template;
        }
        Matcher matcher = VAR_PATTERN.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String ref = matcher.group(1);
            Object value = resolveRef(ref);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(
                    value != null ? value.toString() : ""));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> resolveMap(Map<String, Object> params) {
        Map<String, Object> resolved = new LinkedHashMap<>();
        for (var entry : params.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String s) {
                resolved.put(entry.getKey(), resolve(s));
            } else if (value instanceof Map<?, ?> m) {
                resolved.put(entry.getKey(), resolveMap((Map<String, Object>) m));
            } else {
                resolved.put(entry.getKey(), value);
            }
        }
        return resolved;
    }

    @SuppressWarnings("unchecked")
    private Object resolveRef(String ref) {
        String[] parts = ref.split("\\.", 2);
        String stepName = parts[0];
        Map<String, Object> result = stepResults.get(stepName);
        if (result == null) {
            throw new IllegalArgumentException(
                    "Unknown step '" + stepName + "'. Available: " + stepResults.keySet());
        }
        if (parts.length == 1) {
            return result;
        }
        String[] fieldPath = parts[1].split("\\.");
        Object current = result;
        for (String field : fieldPath) {
            if (current instanceof Map<?, ?> map) {
                current = map.get(field);
            } else {
                return null;
            }
        }
        return current;
    }
}
