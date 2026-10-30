package io.casehub.pages.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class SlugUtilsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void slugifyLowercases() {
        assertThat(SlugUtils.slugify("Hello World")).isEqualTo("hello-world");
    }

    @Test
    void slugifyReplacesSpecialChars() {
        assertThat(SlugUtils.slugify("Hello, World! #1")).isEqualTo("hello-world-1");
    }

    @Test
    void slugifyCollapsesConsecutiveHyphens() {
        assertThat(SlugUtils.slugify("hello---world")).isEqualTo("hello-world");
    }

    @Test
    void slugifyStripsLeadingTrailingHyphens() {
        assertThat(SlugUtils.slugify("-hello-world-")).isEqualTo("hello-world");
    }

    @Test
    void slugifyHandlesEmptyString() {
        assertThat(SlugUtils.slugify("")).isEmpty();
    }

    @Test
    void slugifyHandlesAllSpecialChars() {
        assertThat(SlugUtils.slugify("!@#$%^&*()")).isEmpty();
    }

    @Test
    void slugifyPreservesNumbers() {
        assertThat(SlugUtils.slugify("Issue 42 - Critical Bug")).isEqualTo("issue-42-critical-bug");
    }

    @Test
    void slugifyTruncatesLongInput() {
        String longTitle = "a".repeat(200);
        String slug = SlugUtils.slugify(longTitle);
        assertThat(slug.length()).isLessThanOrEqualTo(128);
    }

    @Test
    void resolveSlugUsesExplicitId() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("_id", "my-custom-slug");
        doc.put("title", "Some Title");
        assertThat(SlugUtils.resolveSlug(doc, "title")).isEqualTo(Optional.of("my-custom-slug"));
    }

    @Test
    void resolveSlugUsesPlainIdField() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("id", "my-explicit-id");
        doc.put("title", "Some Title");
        assertThat(SlugUtils.resolveSlug(doc, "title")).isEqualTo(Optional.of("my-explicit-id"));
    }

    @Test
    void resolveSlugPrefersUnderscoreIdOverPlainId() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("_id", "underscore-wins");
        doc.put("id", "plain-loses");
        doc.put("title", "Some Title");
        assertThat(SlugUtils.resolveSlug(doc, "title")).isEqualTo(Optional.of("underscore-wins"));
    }


    @Test
    void resolveSlugDerivesFromSlugField() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("title", "My Great Article!");
        assertThat(SlugUtils.resolveSlug(doc, "title")).isEqualTo(Optional.of("my-great-article"));
    }

    @Test
    void resolveSlugReturnsEmptyWhenNoSource() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("body", "some content");
        assertThat(SlugUtils.resolveSlug(doc, null)).isEmpty();
    }

    @Test
    void resolveSlugReturnsEmptyWhenSlugFieldMissing() {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("body", "some content");
        assertThat(SlugUtils.resolveSlug(doc, "title")).isEmpty();
    }
}
