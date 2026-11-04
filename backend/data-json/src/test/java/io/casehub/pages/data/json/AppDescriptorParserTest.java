package io.casehub.pages.data.json;

import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppDescriptorParserTest {

    @Test
    void parses_collections_with_fields() {
        InputStream yaml = getClass().getClassLoader()
            .getResourceAsStream("org/apps/helpdesk/app.yaml");

        AppDescriptor descriptor = AppDescriptorParser.parse("helpdesk", yaml);

        assertThat(descriptor.appId()).isEqualTo("helpdesk");
        assertThat(descriptor.collections()).hasSize(2);

        CollectionDef tickets = descriptor.collections().stream()
            .filter(c -> c.name().equals("tickets"))
            .findFirst().orElseThrow();

        assertThat(tickets.fields()).hasSize(8);

        FieldDef subject = tickets.fields().stream()
            .filter(f -> f.name().equals("subject")).findFirst().orElseThrow();
        assertThat(subject.type()).isEqualTo(FieldType.STRING);

        FieldDef priority = tickets.fields().stream()
            .filter(f -> f.name().equals("priority")).findFirst().orElseThrow();
        assertThat(priority.type()).isEqualTo(FieldType.ENUM);
        assertThat(priority.enumValues()).containsExactly("LOW", "MEDIUM", "HIGH", "URGENT");

        FieldDef assigneeId = tickets.fields().stream()
            .filter(f -> f.name().equals("assigneeId")).findFirst().orElseThrow();
        assertThat(assigneeId.type()).isEqualTo(FieldType.REF);
        assertThat(assigneeId.ref()).isEqualTo("agents");

        assertThat(tickets.dataFiles()).containsExactly("data/tickets.json");
    }

    @Test
    void parses_field_defaults() {
        InputStream yaml = getClass().getClassLoader()
            .getResourceAsStream("org/apps/helpdesk/app.yaml");

        AppDescriptor descriptor = AppDescriptorParser.parse("helpdesk", yaml);
        CollectionDef agents = descriptor.collections().stream()
            .filter(c -> c.name().equals("agents"))
            .findFirst().orElseThrow();

        FieldDef active = agents.fields().stream()
            .filter(f -> f.name().equals("active")).findFirst().orElseThrow();
        assertThat(active.type()).isEqualTo(FieldType.BOOLEAN);
        assertThat(active.defaultValue()).isEqualTo(true);
    }

    @Test
    void parses_label_trees() {
        InputStream yaml = getClass().getClassLoader()
            .getResourceAsStream("org/apps/helpdesk/app.yaml");

        AppDescriptor descriptor = AppDescriptorParser.parse("helpdesk", yaml);

        assertThat(descriptor.labelTrees()).hasSize(2);

        LabelTreeDef categories = descriptor.labelTrees().stream()
            .filter(t -> t.name().equals("categories"))
            .findFirst().orElseThrow();
        assertThat(categories.paths()).containsExactly(
            "HARDWARE/Laptops", "HARDWARE/Monitors",
            "SOFTWARE/OS", "SOFTWARE/Applications");

        LabelTreeDef priorities = descriptor.labelTrees().stream()
            .filter(t -> t.name().equals("priorities"))
            .findFirst().orElseThrow();
        assertThat(priorities.paths()).hasSize(5);
    }

    @Test
    void parses_app_without_labels() {
        String yaml = "collections:\n  things:\n    fields:\n      - name: title\n        type: string\n";
        AppDescriptor descriptor = AppDescriptorParser.parse("nolabels",
            new java.io.ByteArrayInputStream(yaml.getBytes()));

        assertThat(descriptor.labelTrees()).isEmpty();
    }


    @Test
    void parses_params_declaration() {
        InputStream yaml = getClass().getClassLoader()
                                     .getResourceAsStream("org/apps/helpdesk/app.yaml");

        AppDescriptor descriptor = AppDescriptorParser.parse("helpdesk", yaml);

        assertThat(descriptor.params()).hasSize(1);
        ParamDef ticketId = descriptor.params().get(0);
        assertThat(ticketId.name()).isEqualTo("ticketId");
        assertThat(ticketId.type()).isEqualTo("string");
        assertThat(ticketId.required()).isFalse();
        assertThat(ticketId.defaultValue()).isNull();
    }

    @Test
    void parses_access_policy() {
        InputStream yaml = getClass().getClassLoader()
                                     .getResourceAsStream("org/apps/helpdesk/app.yaml");

        AppDescriptor descriptor = AppDescriptorParser.parse("helpdesk", yaml);

        assertThat(descriptor.access()).isNotNull();
        assertThat(descriptor.access().read().roles()).containsExactly("authenticated");
        assertThat(descriptor.access().write().roles()).containsExactly("admin", "developer");
    }

    @Test
    void missing_access_returns_default_policy() {
        String yaml = "collections:\n  items:\n    fields:\n      - name: title\n        type: string\n";
        AppDescriptor descriptor = AppDescriptorParser.parse("minimal",
                                                             new java.io.ByteArrayInputStream(yaml.getBytes()));

        assertThat(descriptor.access().read().roles()).isEmpty();
        assertThat(descriptor.access().write().roles()).containsExactly("admin", "developer");
    }

    @Test
    void missing_params_returns_empty_list() {
        String yaml = "collections:\n  items:\n    fields:\n      - name: title\n        type: string\n";
        AppDescriptor descriptor = AppDescriptorParser.parse("minimal",
                                                             new java.io.ByteArrayInputStream(yaml.getBytes()));

        assertThat(descriptor.params()).isEmpty();
    }

    @Test
    void rejects_null_input() {
        assertThatThrownBy(() -> AppDescriptorParser.parse("test", null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
