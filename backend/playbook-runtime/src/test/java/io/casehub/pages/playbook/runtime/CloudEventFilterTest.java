package io.casehub.pages.playbook.runtime;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CloudEventFilterTest {

    @Test
    void emptyFilterMatchesEverything() {
        assertThat(CloudEventFilter.matches(Map.of(),
                Map.of("key", "value"))).isTrue();
    }

    @Test
    void exactMatchOnFlatKey() {
        assertThat(CloudEventFilter.matches(
                Map.of("status", "failed"),
                Map.of("status", "failed", "id", "123"))).isTrue();
    }

    @Test
    void mismatchOnFlatKey() {
        assertThat(CloudEventFilter.matches(
                Map.of("status", "failed"),
                Map.of("status", "success"))).isFalse();
    }

    @Test
    void dotNotationTraversesNestedMaps() {
        assertThat(CloudEventFilter.matches(
                Map.of("account.region", "EMEA"),
                Map.of("account", Map.of("region", "EMEA")))).isTrue();
    }

    @Test
    void dotNotationMismatch() {
        assertThat(CloudEventFilter.matches(
                Map.of("account.region", "EMEA"),
                Map.of("account", Map.of("region", "APAC")))).isFalse();
    }

    @Test
    void missingKeyIsNonMatch() {
        assertThat(CloudEventFilter.matches(
                Map.of("missing", "value"),
                Map.of("other", "value"))).isFalse();
    }

    @Test
    void allFiltersMustMatch() {
        assertThat(CloudEventFilter.matches(
                Map.of("status", "failed", "type", "trade"),
                Map.of("status", "failed", "type", "trade"))).isTrue();

        assertThat(CloudEventFilter.matches(
                Map.of("status", "failed", "type", "trade"),
                Map.of("status", "failed", "type", "order"))).isFalse();
    }

    @Test
    void numericValuesComparedAsStrings() {
        assertThat(CloudEventFilter.matches(
                Map.of("count", "5"),
                Map.of("count", 5))).isTrue();
    }

    @Test
    void nullEventDataReturnsFalseForNonEmptyFilter() {
        assertThat(CloudEventFilter.matches(
                Map.of("key", "value"), null)).isFalse();
    }

    @Test
    void nullEventDataReturnsTrueForEmptyFilter() {
        assertThat(CloudEventFilter.matches(Map.of(), null)).isTrue();
    }
}
