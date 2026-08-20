package io.casehub.pages.scenario.runtime;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VariableContextTest {

    @Test
    void storesAndResolvesStepResult() {
        var ctx = new VariableContext();
        ctx.put("create-case", Map.of("caseId", "C-001", "status", "OPEN"));
        assertThat(ctx.resolve("${create-case.caseId}")).isEqualTo("C-001");
    }

    @Test
    void resolvesNestedField() {
        var ctx = new VariableContext();
        ctx.put("step1", Map.of("data", Map.of("id", "42")));
        assertThat(ctx.resolve("${step1.data.id}")).isEqualTo("42");
    }

    @Test
    void interpolatesWithinString() {
        var ctx = new VariableContext();
        ctx.put("s1", Map.of("id", "C-001"));
        assertThat(ctx.resolve("Case ${s1.id} created")).isEqualTo("Case C-001 created");
    }

    @Test
    void nullValueInterpolatesAsEmpty() {
        var ctx = new VariableContext();
        ctx.put("s1", Map.of("val", "present"));
        assertThat(ctx.resolve("${s1.missing}")).isEqualTo("");
    }

    @Test
    void noInterpolationReturnsOriginal() {
        var ctx = new VariableContext();
        assertThat(ctx.resolve("plain text")).isEqualTo("plain text");
    }

    @Test
    void unknownStepThrows() {
        var ctx = new VariableContext();
        assertThatThrownBy(() -> ctx.resolve("${missing.field}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("missing");
    }

    @Test
    void interpolatesMap() {
        var ctx = new VariableContext();
        ctx.put("s1", Map.of("id", "42"));
        Map<String, Object> params = Map.of("caseId", "${s1.id}", "label", "fixed");
        Map<String, Object> resolved = ctx.resolveMap(params);
        assertThat(resolved).containsEntry("caseId", "42");
        assertThat(resolved).containsEntry("label", "fixed");
    }

    @Test
    void multipleReferencesInOneString() {
        var ctx = new VariableContext();
        ctx.put("a", Map.of("x", "hello"));
        ctx.put("b", Map.of("y", "world"));
        assertThat(ctx.resolve("${a.x} ${b.y}")).isEqualTo("hello world");
    }
}
