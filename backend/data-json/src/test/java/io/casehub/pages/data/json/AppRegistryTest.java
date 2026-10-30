package io.casehub.pages.data.json;

import io.casehub.pages.data.CollectionSchema;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class AppRegistryTest {

    @Inject
    AppRegistry registry;

    @Test
    void discovers_app_from_classpath() {
        assertThat(registry.getRegisteredApps()).contains("helpdesk");
    }

    @Test
    void returns_descriptor_for_registered_app() {
        Optional<AppDescriptor> descriptor = registry.getDescriptor("helpdesk");
        assertThat(descriptor).isPresent();
        assertThat(descriptor.get().collections()).isNotEmpty();
    }

    @Test
    void returns_schema_for_collection() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "tickets");
        assertThat(schema).isPresent();
        assertThat(schema.get().fieldTypes()).containsKey("subject");
        assertThat(schema.get().fieldTypes().get("subject")).isEqualTo("string");
    }

    @Test
    void returns_schema_with_enum_encoding() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "tickets");
        assertThat(schema).isPresent();
        assertThat(schema.get().fieldTypes().get("priority"))
            .startsWith("enum:");
    }

    @Test
    void returns_schema_with_ref_mapping() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "tickets");
        assertThat(schema).isPresent();
        assertThat(schema.get().refs()).containsEntry("assigneeId", "agents");
    }

    @Test
    void returns_empty_for_unknown_app() {
        assertThat(registry.getDescriptor("nonexistent")).isEmpty();
    }

    @Test
    void returns_empty_for_unknown_collection() {
        assertThat(registry.getSchema("helpdesk", "nonexistent")).isEmpty();
    }
}
