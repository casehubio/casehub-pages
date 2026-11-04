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
    void discovers_contacts_and_tasks_apps() {
        assertThat(registry.getRegisteredApps()).contains("contacts", "tasks");
        assertThat(registry.getDescriptor("contacts")).isPresent();
        assertThat(registry.getDescriptor("contacts").get().collections()).extracting("name").contains("contacts");
        assertThat(registry.getDescriptor("tasks")).isPresent();
        assertThat(registry.getDescriptor("tasks").get().collections()).extracting("name").contains("tasks", "notes");
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
    void registers_pages_system_collection_for_each_app() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "_pages");
        assertThat(schema).isPresent();
        assertThat(schema.get().fieldTypes()).containsKeys("name", "yaml", "description", "icon", "order", "author", "labels", "source", "sourceHash");
        assertThat(schema.get().fieldTypes().get("name")).isEqualTo("string");
        assertThat(schema.get().fieldTypes().get("yaml")).isEqualTo("string");
        assertThat(schema.get().fieldTypes().get("order")).isEqualTo("number");
        assertThat(schema.get().fieldTypes().get("labels")).isEqualTo("array");
        assertThat(schema.get().defaults()).containsEntry("order", (Object) 0);
    }

    @Test
    void registers_apps_system_collection_for_each_app() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "_apps");
        assertThat(schema).isPresent();
        assertThat(schema.get().fieldTypes()).containsKeys("appId", "name", "description", "icon", "order", "route", "labels", "source");
        assertThat(schema.get().fieldTypes().get("appId")).isEqualTo("string");
        assertThat(schema.get().fieldTypes().get("name")).isEqualTo("string");
        assertThat(schema.get().fieldTypes().get("order")).isEqualTo("number");
        assertThat(schema.get().fieldTypes().get("labels")).isEqualTo("array");
        assertThat(schema.get().defaults()).containsEntry("order", (Object) 0);
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

    @Test
    void isAppEnabled_returns_true_for_registered_app() {
        assertThat(registry.isAppEnabled("contacts")).isTrue();
    }

    @Test
    void isAppEnabled_returns_true_for_unknown_app() {
        assertThat(registry.isAppEnabled("nonexistent-app-xyz")).isTrue();
    }

    @Test
    void apps_schema_includes_settings_fields() {
        Optional<CollectionSchema> schema = registry.getSchema("helpdesk", "_apps");
        assertThat(schema).isPresent();
        assertThat(schema.get().fieldTypes()).containsKeys("enabled", "displayName", "autoSeed", "maxDocuments");
        assertThat(schema.get().fieldTypes().get("enabled")).isEqualTo("boolean");
        assertThat(schema.get().fieldTypes().get("displayName")).isEqualTo("string");
        assertThat(schema.get().fieldTypes().get("autoSeed")).isEqualTo("boolean");
        assertThat(schema.get().fieldTypes().get("maxDocuments")).isEqualTo("number");
        assertThat(schema.get().defaults()).containsEntry("enabled", (Object) true);
        assertThat(schema.get().defaults()).containsEntry("autoSeed", (Object) true);
        assertThat(schema.get().defaults()).containsEntry("maxDocuments", (Object) (-1));
    }

}
