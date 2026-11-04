package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public record CollectionSchema(
    String collection,
    Map<String, String> fieldTypes,
    Map<String, Object> defaults,
    Map<String, String> refs,
    Map<String, FieldConstraints> fieldConstraints
) {
    public CollectionSchema {
        fieldTypes = Map.copyOf(fieldTypes);
        defaults = Map.copyOf(defaults);
        refs = Map.copyOf(refs);
        fieldConstraints = fieldConstraints != null ? Map.copyOf(fieldConstraints) : Map.of();
    }

    public CollectionSchema(String collection, Map<String, String> fieldTypes,
                            Map<String, Object> defaults, Map<String, String> refs) {
        this(collection, fieldTypes, defaults, refs, Map.of());
    }

    public void validate(JsonNode document) {
        SchemaValidationResult result = validateToResult(document);
        if (!result.valid()) {
            String summary = result.violations().stream()
                .map(v -> v.field() + ": " + v.message())
                .collect(Collectors.joining("; "));
            throw new SchemaViolationException(summary, result.violations());
        }
    }

    public SchemaValidationResult validateToResult(JsonNode document) {
        List<FieldViolation> violations = new ArrayList<>();
        validateTypes(document, violations);
        if (!fieldConstraints.isEmpty()) {
            validateConstraints(document, violations);
        }
        return new SchemaValidationResult(violations.isEmpty(), violations);
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

    private void validateTypes(JsonNode document, List<FieldViolation> violations) {
        for (var entry : fieldTypes.entrySet()) {
            String field = entry.getKey();
            String type = entry.getValue();
            JsonNode value = document.get(field);
            if (value == null || value.isNull()) continue;

            if (type.startsWith("enum:")) {
                String[] allowed = type.substring(5).split(",");
                String actual = value.asText();
                boolean found = false;
                for (String a : allowed) {
                    if (a.equals(actual)) { found = true; break; }
                }
                if (!found) {
                    violations.add(new FieldViolation(field, "enum",
                        Map.of("allowed", type.substring(5)),
                        "value '" + actual + "' not in allowed values: " + type.substring(5)));
                }
                continue;
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
                violations.add(new FieldViolation(field, "type",
                    Map.of("expected", type, "actual", value.getNodeType().toString()),
                    "expected type '" + type + "' but got " + value.getNodeType()));
            }
        }
    }

    private void validateConstraints(JsonNode document, List<FieldViolation> violations) {
        ObjectNode schema = JsonSchemaBuilder.buildSchema(fieldConstraints);
        JsonSchema jsonSchema = JsonSchemaFactory
            .getInstance(SpecVersion.VersionFlag.V7)
            .getSchema(schema);
        Set<ValidationMessage> messages = jsonSchema.validate(document);
        for (ValidationMessage msg : messages) {
            violations.add(toFieldViolation(msg));
        }
    }

    private static FieldViolation toFieldViolation(ValidationMessage msg) {
        String path = msg.getInstanceLocation().toString();
        String field = path;
        if (field.startsWith("$.")) field = field.substring(2);
        else if (field.startsWith("/")) field = field.substring(1);
        String constraint = msg.getType();
        Map<String, Object> params = Map.of();
        if (msg.getSchemaLocation() != null) {
            String schemaPath = msg.getSchemaLocation().toString();
            int lastSlash = schemaPath.lastIndexOf('/');
            if (lastSlash >= 0) {
                constraint = schemaPath.substring(lastSlash + 1);
            }
        }
        return new FieldViolation(field, constraint, params, msg.getMessage());
    }

    public record FieldConstraints(
            String type,
            boolean required,
            Integer minLength,
            Integer maxLength,
            String pattern,
            Number minimum,
            Number maximum,
            Number exclusiveMinimum,
            Number exclusiveMaximum,
            Number multipleOf,
            List<String> enumValues,
            String format
    ) {
        public static FieldConstraints typeOnly(String type) {
            return new FieldConstraints(type, false, null, null, null,
                                        null, null, null, null, null, null, null);
        }
    }
}
