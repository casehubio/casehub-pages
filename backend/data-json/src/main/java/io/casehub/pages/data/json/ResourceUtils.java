package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.OptionalInt;
import java.util.Set;

public final class ResourceUtils {

    private ResourceUtils() {}

    public static OptionalInt parseIfMatch(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) return OptionalInt.empty();
        String stripped = ifMatch.replace("\"", "").trim();
        try {
            return OptionalInt.of(Integer.parseInt(stripped));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    public static Set<String> extractRoles(JsonWebToken jwt) {
        Set<String> groups = jwt.getGroups();
        return groups != null ? groups : Set.of();
    }

    public static boolean matchesLabel(JsonNode doc, String labelFilter) {
        JsonNode labels = doc.get("labels");
        if (labels == null || !labels.isArray()) {return false;}
        for (JsonNode label : labels) {
            if (label.asText().startsWith(labelFilter)) {return true;}
        }
        return false;
    }

    public static void copyIfPresent(JsonNode source, ObjectNode target, String field) {
        if (source.has(field)) {target.set(field, source.get(field));}
    }


}
