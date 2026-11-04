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
            JsonNode            root        = YAML.readTree(yaml);
            List<CollectionDef> collections = parseCollections(root.get("collections"));
            List<LabelTreeDef>  labelTrees  = parseLabelTrees(root.get("labels"));
            List<ParamDef>      params      = parseParams(root.get("params"));
            AppAccessPolicy     access      = parseAccess(root.get("access"));
            return new AppDescriptor(appId, collections, labelTrees, params, access);
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
            boolean required = fieldNode.has("required") && fieldNode.get("required").asBoolean();
            Integer minLength = optionalInt(fieldNode, "minLength");
            Integer maxLength = optionalInt(fieldNode, "maxLength");
            String pattern = fieldNode.has("pattern") ? fieldNode.get("pattern").asText() : null;
            Number minimum = optionalNumber(fieldNode, "minimum");
            Number maximum = optionalNumber(fieldNode, "maximum");
            Number exclusiveMinimum = optionalNumber(fieldNode, "exclusiveMinimum");
            Number exclusiveMaximum = optionalNumber(fieldNode, "exclusiveMaximum");
            Number multipleOf = optionalNumber(fieldNode, "multipleOf");
            String format = fieldNode.has("format") ? fieldNode.get("format").asText() : null;
            result.add(new FieldDef(name, type, defaultValue, enumValues, ref,
                required, minLength, maxLength, pattern, minimum, maximum,
                exclusiveMinimum, exclusiveMaximum, multipleOf, format));
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

    private static Integer optionalInt(JsonNode parent, String key) {
        return parent.has(key) ? parent.get(key).asInt() : null;
    }

    private static Number optionalNumber(JsonNode parent, String key) {
        return parent.has(key) ? parent.get(key).numberValue() : null;
    }

    private static List<String> parseDataFiles(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            result.add(item.asText());
        }
        return List.copyOf(result);
    }


    private static List<ParamDef> parseParams(JsonNode paramsNode) {
        if (paramsNode == null || !paramsNode.isArray()) {return List.of();}

        List<ParamDef> result = new ArrayList<>();
        for (JsonNode paramNode : paramsNode) {
            String  name         = paramNode.get("name").asText();
            String  type         = paramNode.has("type") ? paramNode.get("type").asText() : "string";
            boolean required     = paramNode.has("required") && paramNode.get("required").asBoolean();
            String  defaultValue = paramNode.has("default") ? paramNode.get("default").asText() : null;
            result.add(new ParamDef(name, type, required, defaultValue));
        }
        return List.copyOf(result);
    }

    private static AppAccessPolicy parseAccess(JsonNode accessNode) {
        if (accessNode == null || !accessNode.isObject()) {return AppAccessPolicy.DEFAULT;}

        AppAccessPolicy.AccessRule read  = parseAccessRule(accessNode.get("read"));
        AppAccessPolicy.AccessRule write = parseAccessRule(accessNode.get("write"));
        if (write == null) {write = new AppAccessPolicy.AccessRule(List.of("admin", "developer"));}
        if (read == null) {read = new AppAccessPolicy.AccessRule(List.of());}
        return new AppAccessPolicy(read, write);
    }

    private static AppAccessPolicy.AccessRule parseAccessRule(JsonNode ruleNode) {
        if (ruleNode == null || !ruleNode.isObject()) {return null;}
        List<String> roles = parseStringArray(ruleNode.get("roles"));
        return new AppAccessPolicy.AccessRule(roles);
    }

    private static List<LabelTreeDef> parseLabelTrees(JsonNode labelsNode) {
        if (labelsNode == null || !labelsNode.isObject()) return List.of();

        List<LabelTreeDef> result = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> it = labelsNode.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            String name = entry.getKey();
            List<String> paths = parseStringArray(entry.getValue());
            result.add(new LabelTreeDef(name, paths));
        }
        return List.copyOf(result);
    }
}
