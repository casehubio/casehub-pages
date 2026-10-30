package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Map;

public record CollectionSchema(
    String collection,
    Map<String, String> fieldTypes,
    Map<String, Object> defaults,
    Map<String, String> refs
) {
    public CollectionSchema {
        fieldTypes = Map.copyOf(fieldTypes);
        defaults = Map.copyOf(defaults);
        refs = Map.copyOf(refs);
    }

    public void validate(JsonNode document) {
        for (var entry : fieldTypes.entrySet()) {
            String field = entry.getKey();
            String type = entry.getValue();
            JsonNode value = document.get(field);
            if (value == null || value.isNull()) continue;
            validateType(field, type, value);
        }
    }

    public void applyDefaults(ObjectNode document) {
        for (var entry : defaults.entrySet()) {
            String field = entry.getKey();
            if (!document.has(field)) {
                Object val = entry.getValue();
                if (val instanceof Boolean b) document.put(field, b);
                else if (val instanceof Number n) document.put(field, n.doubleValue());
                else if (val instanceof String s) document.put(field, s);
            }
        }
    }

    private void validateType(String field, String type, JsonNode value) {
        if (type.startsWith("enum:")) {
            String[] allowed = type.substring(5).split(",");
            String actual = value.asText();
            for (String a : allowed) {
                if (a.equals(actual)) return;
            }
            throw new SchemaViolationException(
                "Field '" + field + "' value '" + actual + "' not in allowed values: " + type.substring(5));
        }

        boolean valid = switch (type) {
            case "string", "date", "ref" -> value.isTextual();
            case "number" -> value.isNumber();
            case "boolean" -> value.isBoolean();
            case "array" -> value.isArray();
            case "object" -> value.isObject();
            default -> true;
        };
        if (!valid) {
            throw new SchemaViolationException(
                "Field '" + field + "' expected type '" + type + "' but got " + value.getNodeType());
        }
    }
}
