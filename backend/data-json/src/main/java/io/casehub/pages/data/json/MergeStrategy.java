package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Iterator;
import java.util.Map;

public enum MergeStrategy {

    SHALLOW {
        @Override
        public JsonNode merge(JsonNode existing, JsonNode patch) {
            ObjectNode result = existing.deepCopy();
            patch.fields().forEachRemaining(e -> result.set(e.getKey(), e.getValue().deepCopy()));
            return result;
        }
    },

    DEEP {
        @Override
        public JsonNode merge(JsonNode existing, JsonNode patch) {
            ObjectNode result = existing.deepCopy();
            Iterator<Map.Entry<String, JsonNode>> fields = patch.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String key = entry.getKey();
                JsonNode patchValue = entry.getValue();
                JsonNode existingValue = result.get(key);
                if (existingValue != null && existingValue.isObject() && patchValue.isObject()) {
                    result.set(key, DEEP.merge(existingValue, patchValue));
                } else {
                    result.set(key, patchValue.deepCopy());
                }
            }
            return result;
        }
    },

    RFC_7396 {
        @Override
        public JsonNode merge(JsonNode existing, JsonNode patch) {
            ObjectNode result = existing.deepCopy();
            Iterator<Map.Entry<String, JsonNode>> fields = patch.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (entry.getValue().isNull()) {
                    result.remove(entry.getKey());
                } else {
                    result.set(entry.getKey(), entry.getValue().deepCopy());
                }
            }
            return result;
        }
    };

    public abstract JsonNode merge(JsonNode existing, JsonNode patch);
}
