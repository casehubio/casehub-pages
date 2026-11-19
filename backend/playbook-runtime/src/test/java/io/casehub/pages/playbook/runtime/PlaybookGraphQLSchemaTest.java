package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ParamDescriptor;
import org.eclipse.microprofile.graphql.Ignore;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class PlaybookGraphQLSchemaTest {

    @Test
    void paramDescriptor_objectFields_haveIgnoreAnnotation() {
        Set<String> ignoredComponents = Arrays.stream(ParamDescriptor.class.getRecordComponents())
                .filter(rc -> rc.getAccessor().isAnnotationPresent(Ignore.class))
                .map(RecordComponent::getName)
                .collect(Collectors.toSet());

        assertThat(ignoredComponents)
                .as("Object-typed fields must be @Ignore'd for GraphQL schema generation")
                .containsExactlyInAnyOrder("defaultValue", "enumValues");
    }

    @Test
    void paramDescriptor_nonObjectFields_notIgnored() {
        Set<String> visibleComponents = Arrays.stream(ParamDescriptor.class.getRecordComponents())
                .filter(rc -> !rc.getAccessor().isAnnotationPresent(Ignore.class))
                .map(RecordComponent::getName)
                .collect(Collectors.toSet());

        assertThat(visibleComponents)
                .containsExactlyInAnyOrder("name", "type", "required");
    }

    @Test
    void resolver_exposesDefaultValueAndEnumValues_asStrings() throws Exception {
        var resolver = new ParamDescriptorResolver();
        var methods = resolver.getClass().getMethods();

        boolean hasDefaultValue = Arrays.stream(methods)
                .anyMatch(m -> m.getParameterCount() == 1
                        && m.getParameterTypes()[0] == ParamDescriptor.class
                        && m.getReturnType() == String.class);

        boolean hasEnumValues = Arrays.stream(methods)
                .anyMatch(m -> m.getParameterCount() == 1
                        && m.getParameterTypes()[0] == ParamDescriptor.class
                        && java.util.List.class.isAssignableFrom(m.getReturnType()));

        assertThat(hasDefaultValue)
                .as("Resolver must expose defaultValue as String via @Source")
                .isTrue();
        assertThat(hasEnumValues)
                .as("Resolver must expose enumValues as List<String> via @Source")
                .isTrue();
    }
}
