package io.casehub.pages.data.json;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageYamlValidatorTest {

    @Test
    void accepts_valid_page_yaml() {
        String yaml = """
            name: dashboard
            components:
              - type: title
                properties:
                  text: Hello
            """;
        assertThatCode(() -> PageYamlValidator.validate(yaml)).doesNotThrowAnyException();
    }

    @Test
    void rejects_script_key() {
        String yaml = """
            name: evil
            components:
              - type: html
                properties:
                  script: alert(1)
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("script");
    }

    @Test
    void rejects_yaml_core_keys_at_root() {
        String yaml = """
            variables:
              x: 1
            name: test
            components: []
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("variables");
    }

    @Test
    void allows_data_key_at_component_level() {
        String yaml = """
            name: chart
            components:
              - type: displayer
                properties:
                  data:
                    - [1, 2, 3]
            """;
        assertThatCode(() -> PageYamlValidator.validate(yaml)).doesNotThrowAnyException();
    }

    @Test
    void rejects_dataset_with_url() {
        String yaml = """
            name: bad
            datasets:
              - uuid: ext
                url: https://evil.com/data
            components: []
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("url");
    }

    @Test
    void rejects_dataset_with_serverQuery() {
        String yaml = """
            name: bad
            datasets:
              - uuid: ext
                serverQuery: SELECT *
            components: []
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("serverQuery");
    }

    @Test
    void rejects_innerHTML_key() {
        String yaml = """
            name: xss
            components:
              - type: html
                innerHTML: <script>alert(1)</script>
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("innerHTML");
    }

    @Test
    void rejects_event_handlers_case_insensitively() {
        for (String key : java.util.List.of("onClick", "ONCLICK", "OnLoad", "onMouseOver")) {
            String yaml = "name: xss\ncomponents:\n  - type: html\n    " + key + ": bad\n";
            assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
                    .as("Should reject " + key)
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("event handler");
        }
    }

    @Test
    void rejects_innerHTML_case_insensitively() {
        String yaml = """
                      name: xss
                      components:
                        - type: html
                          InnerHTML: <script>alert(1)</script>
                      """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("InnerHTML");
    }


    @Test
    void rejects_invalid_yaml_syntax() {
        String yaml = "{{not valid yaml";
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("YAML");
    }

    @Test
    void requires_name_field() {
        String yaml = """
            components:
              - type: title
            """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("name");
    }

    @Test
    void rejects_unknown_root_level_key() {
        String yaml = """
                      name: test
                      customThing: bad
                      components: []
                      """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown root-level key");
    }

    @Test
    void rejects_any_on_event_handler_by_pattern() {
        String yaml = """
                      name: xss
                      components:
                        - type: html
                          properties:
                            onpointerrawupdate: alert(1)
                      """;
        assertThatThrownBy(() -> PageYamlValidator.validate(yaml))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("event handler");
    }

    @Test
    void accepts_valid_page_with_all_allowed_root_keys() {
        String yaml = """
                      name: full
                      properties:
                        color: red
                      components:
                        - type: title
                          properties:
                            text: Hello
                      datasets: []
                      dataScope:
                        dataset: tickets
                        idColumn: id
                      save:
                        trigger: auto
                        delay: 2000
                        adapter: rest
                      """;
        assertThatCode(() -> PageYamlValidator.validate(yaml)).doesNotThrowAnyException();
    }


}
