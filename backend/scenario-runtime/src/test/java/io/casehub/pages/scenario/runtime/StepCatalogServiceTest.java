package io.casehub.pages.scenario.runtime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class StepCatalogServiceTest {

    StepCatalogService service;

    @BeforeEach
    void setUp() {
        var testDir = Path.of("src/test/resources/step-definitions");
        service = new StepCatalogService(testDir);
    }

    @Test
    void yamlDefinitionsAreLoaded() {
        var actions = service.listActions();
        assertThat(actions).isNotEmpty();
        var compliance = actions.stream()
                .filter(a -> a.name().equals("check-compliance"))
                .findFirst()
                .orElseThrow();
        assertThat(compliance.source()).isEqualTo("yaml");
        assertThat(compliance.invokeKind()).isEqualTo("rest");
        assertThat(compliance.inputCount()).isEqualTo(2);
        assertThat(compliance.outputCount()).isEqualTo(1);
    }

    @Test
    void namespacedActionsAvailableByShortName() {
        var actions = service.listActions();
        var byName = actions.stream()
                .filter(a -> a.name().equals("check-compliance"))
                .findFirst();
        assertThat(byName).isPresent();
    }

    @Test
    void actionDetailContainsFullSchema() {
        var detail = service.getAction("check-compliance").orElseThrow();
        assertThat(detail.name()).isEqualTo("check-compliance");
        assertThat(detail.description()).isEqualTo("Check document compliance against a standard");
        assertThat(detail.inputs()).hasSize(2);
        assertThat(detail.inputs()).containsKey("documentId");

        var docId = detail.inputs().get("documentId");
        assertThat(docId.type()).isEqualTo("STRING");
        assertThat(docId.required()).isTrue();
        assertThat(docId.description()).isEqualTo("Document identifier");

        var standard = detail.inputs().get("standard");
        assertThat(standard.defaultValue()).isEqualTo("ISO-27001");
        assertThat(standard.allowedValues()).containsExactly("ISO-27001", "SOC-2", "GDPR");
    }

    @Test
    void actionDetailContainsInvokeBinding() {
        var detail = service.getAction("check-compliance").orElseThrow();
        assertThat(detail.invoke()).isNotNull();
        assertThat(detail.invoke().kind()).isEqualTo("rest");
        assertThat(detail.invoke().metadata()).containsEntry("method", "POST");
        assertThat(detail.invoke().metadata()).containsEntry("url", "https://api.example.com/compliance/check");
    }

    @Test
    void mcpInvokeBindingParsed() {
        var detail = service.getAction("list-standards").orElseThrow();
        assertThat(detail.invoke().kind()).isEqualTo("mcp");
        assertThat(detail.invoke().metadata()).containsEntry("tool", "compliance-list-standards");
    }

    @Test
    void unknownActionReturnsEmpty() {
        assertThat(service.getAction("nonexistent")).isEmpty();
    }

    @Test
    void listActionsSummaryMatchesDetailCounts() {
        var summary = service.listActions().stream()
                .filter(a -> a.name().equals("check-compliance"))
                .findFirst().orElseThrow();
        var detail = service.getAction("check-compliance").orElseThrow();
        assertThat(summary.inputCount()).isEqualTo(detail.inputs().size());
        assertThat(summary.outputCount()).isEqualTo(detail.outputs().size());
    }
}
