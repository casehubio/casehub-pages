package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Optional;
import java.util.regex.Pattern;

public final class SlugUtils {

    private static final int MAX_SLUG_LENGTH = 128;
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern LEADING_TRAILING_HYPHENS = Pattern.compile("^-+|-+$");

    private SlugUtils() {}

    public static String slugify(String input) {
        if (input == null || input.isBlank()) return "";
        String slug = NON_ALNUM.matcher(input.toLowerCase()).replaceAll("-");
        slug = LEADING_TRAILING_HYPHENS.matcher(slug).replaceAll("");
        if (slug.length() > MAX_SLUG_LENGTH) {
            slug = slug.substring(0, MAX_SLUG_LENGTH);
            slug = LEADING_TRAILING_HYPHENS.matcher(slug).replaceAll("");
        }
        return slug;
    }

    public static Optional<String> resolveSlug(JsonNode document, String slugField) {
        JsonNode idNode = document.get("_id");
        if (idNode != null && idNode.isTextual() && !idNode.asText().isBlank()) {
            return Optional.of(idNode.asText());
        }
        JsonNode plainIdNode = document.get("id");
        if (plainIdNode != null && plainIdNode.isTextual() && !plainIdNode.asText().isBlank()) {
            return Optional.of(plainIdNode.asText());
        }
        if (slugField != null) {
            JsonNode fieldNode = document.get(slugField);
            if (fieldNode != null && fieldNode.isTextual() && !fieldNode.asText().isBlank()) {
                String slugified = slugify(fieldNode.asText());
                return slugified.isEmpty() ? Optional.empty() : Optional.of(slugified);
            }
        }
        return Optional.empty();
    }
}
