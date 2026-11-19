package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ParamDescriptor;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ParamDescriptorResolverTest {

    private final ParamDescriptorResolver resolver = new ParamDescriptorResolver();

    @Test
    void defaultValue_null_returnsNull() {
        var param = new ParamDescriptor("p", "string", false, null, List.of());
        assertThat(resolver.defaultValue(param)).isNull();
    }

    @Test
    void defaultValue_string_returnsQuotedJson() {
        var param = new ParamDescriptor("p", "string", false, "blank", List.of());
        assertThat(resolver.defaultValue(param)).isEqualTo("\"blank\"");
    }

    @Test
    void defaultValue_integer_returnsJsonNumber() {
        var param = new ParamDescriptor("p", "integer", false, 42, List.of());
        assertThat(resolver.defaultValue(param)).isEqualTo("42");
    }

    @Test
    void defaultValue_boolean_returnsJsonBoolean() {
        var param = new ParamDescriptor("p", "boolean", false, true, List.of());
        assertThat(resolver.defaultValue(param)).isEqualTo("true");
    }

    @Test
    void defaultValue_map_returnsJsonObject() {
        var param = new ParamDescriptor("p", "object", false,
                Map.of("key", "val"), List.of());
        assertThat(resolver.defaultValue(param)).isEqualTo("{\"key\":\"val\"}");
    }

    @Test
    void enumValues_empty_returnsEmptyList() {
        var param = new ParamDescriptor("p", "string", false, null, List.of());
        assertThat(resolver.enumValues(param)).isEmpty();
    }

    @Test
    void enumValues_strings_returnsQuotedJsonList() {
        var param = new ParamDescriptor("p", "string", false, null,
                List.of("a", "b", "c"));
        assertThat(resolver.enumValues(param))
                .containsExactly("\"a\"", "\"b\"", "\"c\"");
    }

    @Test
    void enumValues_mixed_returnsJsonList() {
        var param = new ParamDescriptor("p", "string", false, null,
                List.of("text", 42, true));
        assertThat(resolver.enumValues(param))
                .containsExactly("\"text\"", "42", "true");
    }
}
