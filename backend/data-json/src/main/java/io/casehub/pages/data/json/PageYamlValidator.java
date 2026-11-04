package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.util.Iterator;
import java.util.Map;
import java.util.Set;

public final class PageYamlValidator {

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());

    private static final Set<String> ALLOWED_ROOT_KEYS = Set.of(
        "name", "properties", "components", "rows", "datasets",
        "dataScope", "save", "navTree", "global", "description",
        "icon", "order", "author", "labels"
    );

    private static final Set<String> YAML_CORE_KEYS = Set.of(
        "variables", "modules", "imports", "iterations", "data"
    );

    private static final Set<String> XSS_KEYS = Set.of(
        "script", "innerhtml"
    );

    private static final Set<String> DATASET_FORBIDDEN_KEYS = Set.of(
        "url", "content", "serverQuery"
    );

    private PageYamlValidator() {}

    public static void validate(String yaml) {
        parseAndValidate(yaml);
    }

    public static JsonNode parseAndValidate(String yaml) {
        JsonNode root;
        try {
            root = YAML.readTree(yaml);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid YAML syntax: " + e.getMessage(), e);
        }
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("Page YAML must be an object");
        }

        if (!root.has("name") || root.get("name").asText().isBlank()) {
            throw new IllegalArgumentException("Page YAML requires a 'name' field");
        }

        Iterator<String> rootFields = root.fieldNames();
        while (rootFields.hasNext()) {
            String key = rootFields.next();
            if (YAML_CORE_KEYS.contains(key)) {
                throw new IllegalArgumentException(
                    "Dynamic pages cannot use yaml-core key at root level: " + key);
            }
            if (!ALLOWED_ROOT_KEYS.contains(key)) {
                throw new IllegalArgumentException(
                    "Unknown root-level key in dynamic page: " + key);
            }
        }

        validateDatasets(root.get("datasets"));
        walkAndValidate(root);

        return root;
    }

    private static void validateDatasets(JsonNode datasetsNode) {
        if (datasetsNode == null || !datasetsNode.isArray()) return;
        for (JsonNode ds : datasetsNode) {
            if (!ds.isObject()) continue;
            Iterator<String> fields = ds.fieldNames();
            while (fields.hasNext()) {
                String key = fields.next();
                if (DATASET_FORBIDDEN_KEYS.contains(key)) {
                    throw new IllegalArgumentException(
                        "Dynamic page datasets cannot contain key: " + key);
                }
            }
        }
    }

    private static void walkAndValidate(JsonNode node) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String                      key   = entry.getKey();
                String                      lower = key.toLowerCase(java.util.Locale.ROOT);
                if (XSS_KEYS.contains(lower)) {
                    throw new IllegalArgumentException(
                            "Dynamic pages cannot contain key: " + key);
                }
                if (lower.length() > 2 && lower.startsWith("on") && Character.isLetter(lower.charAt(2))) {
                    throw new IllegalArgumentException(
                            "Dynamic pages cannot contain HTML event handler: " + key);
                }
                walkAndValidate(entry.getValue());
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                walkAndValidate(child);
            }
        }
    }
}
