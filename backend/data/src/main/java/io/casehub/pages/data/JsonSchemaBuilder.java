package io.casehub.pages.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Map;

public final class JsonSchemaBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonSchemaBuilder() {
    }

    public static ObjectNode buildSchema(Map<String, CollectionSchema.FieldConstraints> constraints) {
        ObjectNode schema = MAPPER.createObjectNode();
        schema.put("type", "object");
        ObjectNode properties = schema.putObject("properties");
        ArrayNode required = schema.putArray("required");

        for (var entry : constraints.entrySet()) {
            String fieldName = entry.getKey();
            CollectionSchema.FieldConstraints fc = entry.getValue();
            ObjectNode prop = properties.putObject(fieldName);

            if (fc.type() != null) prop.put("type", mapType(fc.type()));
            if (fc.minLength() != null) prop.put("minLength", fc.minLength());
            if (fc.maxLength() != null) prop.put("maxLength", fc.maxLength());
            if (fc.pattern() != null) prop.put("pattern", fc.pattern());
            if (fc.minimum() != null) prop.put("minimum", fc.minimum().doubleValue());
            if (fc.maximum() != null) prop.put("maximum", fc.maximum().doubleValue());
            if (fc.exclusiveMinimum() != null) prop.put("exclusiveMinimum", fc.exclusiveMinimum().doubleValue());
            if (fc.exclusiveMaximum() != null) prop.put("exclusiveMaximum", fc.exclusiveMaximum().doubleValue());
            if (fc.multipleOf() != null) prop.put("multipleOf", fc.multipleOf().doubleValue());
            if (fc.format() != null) prop.put("format", fc.format());
            if (fc.enumValues() != null && !fc.enumValues().isEmpty()) {
                ArrayNode enumNode = prop.putArray("enum");
                fc.enumValues().forEach(enumNode::add);
            }
            if (fc.required()) required.add(fieldName);
        }

        return schema;
    }

    private static String mapType(String pagesType) {
        return switch (pagesType.toLowerCase()) {
            case "number", "date" -> "number";
            case "boolean" -> "boolean";
            case "array" -> "array";
            case "object" -> "object";
            default -> "string";
        };
    }
}
