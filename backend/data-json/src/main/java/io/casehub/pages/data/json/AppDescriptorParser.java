package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public final class AppDescriptorParser {

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

    private AppDescriptorParser() {}

    public static AppDescriptor parse(String appId, InputStream yaml) {
        if (yaml == null) {
            throw new IllegalArgumentException("YAML input must not be null for app: " + appId);
        }
        try {
            JsonNode root = YAML.readTree(yaml);
            List<CollectionDef> collections = parseCollections(root.get("collections"));
            return new AppDescriptor(appId, collections);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to parse app.yaml for app: " + appId, e);
        }
    }

    private static List<CollectionDef> parseCollections(JsonNode collectionsNode) {
        if (collectionsNode == null || !collectionsNode.isObject()) return List.of();

        List<CollectionDef> result = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> it = collectionsNode.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            String name = entry.getKey();
            JsonNode colNode = entry.getValue();
            List<FieldDef> fields = parseFields(colNode.get("fields"));
            List<String> dataFiles = parseDataFiles(colNode.get("data"));
            result.add(new CollectionDef(name, fields, dataFiles));
        }
        return List.copyOf(result);
    }

    private static List<FieldDef> parseFields(JsonNode fieldsNode) {
        if (fieldsNode == null || !fieldsNode.isArray()) return List.of();

        List<FieldDef> result = new ArrayList<>();
        for (JsonNode fieldNode : fieldsNode) {
            String name = fieldNode.get("name").asText();
            FieldType type = FieldType.fromJson(fieldNode.get("type").asText());
            Object defaultValue = parseDefault(fieldNode.get("default"), type);
            List<String> enumValues = parseStringArray(fieldNode.get("values"));
            String ref = fieldNode.has("ref") ? fieldNode.get("ref").asText() : null;
            result.add(new FieldDef(name, type, defaultValue, enumValues, ref));
        }
        return List.copyOf(result);
    }

    private static Object parseDefault(JsonNode node, FieldType type) {
        if (node == null || node.isNull()) return null;
        return switch (type) {
            case BOOLEAN -> node.asBoolean();
            case NUMBER -> node.numberValue();
            case STRING, DATE, ENUM -> node.asText();
            default -> node.toString();
        };
    }

    private static List<String> parseStringArray(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            result.add(item.asText());
        }
        return List.copyOf(result);
    }

    private static List<String> parseDataFiles(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            result.add(item.asText());
        }
        return List.copyOf(result);
    }
}
