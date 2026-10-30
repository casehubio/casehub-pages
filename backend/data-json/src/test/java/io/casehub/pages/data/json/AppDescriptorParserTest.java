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

        assertThat(tickets.fields()).hasSize(5);

        FieldDef title = tickets.fields().stream()
            .filter(f -> f.name().equals("title")).findFirst().orElseThrow();
        assertThat(title.type()).isEqualTo(FieldType.STRING);

        FieldDef priority = tickets.fields().stream()
            .filter(f -> f.name().equals("priority")).findFirst().orElseThrow();
        assertThat(priority.type()).isEqualTo(FieldType.ENUM);
        assertThat(priority.enumValues()).containsExactly("low", "medium", "high", "critical");

        FieldDef assignee = tickets.fields().stream()
            .filter(f -> f.name().equals("assignee")).findFirst().orElseThrow();
        assertThat(assignee.type()).isEqualTo(FieldType.REF);
        assertThat(assignee.ref()).isEqualTo("agents");

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
    void rejects_null_input() {
        assertThatThrownBy(() -> AppDescriptorParser.parse("test", null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
