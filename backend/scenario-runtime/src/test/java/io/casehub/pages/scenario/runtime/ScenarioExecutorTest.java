package io.casehub.pages.scenario.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.TopicRegistry;
import io.casehub.pages.scenario.AriaTarget;
import io.casehub.pages.scenario.Scenario;
import io.casehub.pages.scenario.ScenarioStep;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScenarioExecutorTest {

    @Test
    void executesGraphQLStepsSequentially() {
        var dispatcher = stubGraphQLDispatcher(Map.of(
                "injectChat", Map.of("caseId", "C-001"),
                "caseContext", Map.of("category", "HARDWARE")));

        var executor = new ScenarioExecutor(List.of(
                new GraphQLDeliveryHandler(dispatcher),
                new SimulatedDeliveryHandler()));

        var scenario = new Scenario("test", List.of(
                new ScenarioStep.GenericStep("inject", "graphql", Map.of(
                        "domain", "connectors", "operation", "injectChat",
                        "params", Map.of("sender", "Alice"))),
                new ScenarioStep.GenericStep("check", "graphql", Map.of(
                        "domain", "engine", "operation", "caseContext",
                        "params", Map.of("caseId", "${inject.caseId}")))));

        List<ExecutionResult> results = executor.execute(scenario, ScenarioConfig.localhost());

        assertThat(results).hasSize(2);
        assertThat(results.get(0).success()).isTrue();
        assertThat(results.get(0).result()).containsEntry("caseId", "C-001");
        assertThat(results.get(1).result()).containsEntry("category", "HARDWARE");
    }

    @Test
    void failFastOnError() {
        var dispatcher = new GraphQLDispatcher(null, null) {
            @Override
            public Map<String, Object> dispatch(String domain, String operation,
                                                Map<String, Object> params,
                                                String endpoint, VariableContext ctx) {
                throw new RuntimeException("Connection refused");
            }
        };

        var executor = new ScenarioExecutor(List.of(
                new GraphQLDeliveryHandler(dispatcher)));
        var scenario = new Scenario("test", List.of(
                new ScenarioStep.GenericStep("s1", "graphql", Map.of(
                        "domain", "d", "operation", "op1", "params", Map.of())),
                new ScenarioStep.GenericStep("s2", "graphql", Map.of(
                        "domain", "d", "operation", "op2", "params", Map.of()))));

        assertThatThrownBy(() -> executor.execute(scenario, ScenarioConfig.localhost()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Connection refused");
    }

    @Test
    void ariaStepsReturnEmptyResult() {
        var executor = new ScenarioExecutor(List.of(
                new AriaDeliveryHandler(null)));
        var scenario = new Scenario("test", List.of(
                new ScenarioStep.AriaStep("click-btn", "click", null, null, null, null)));

        List<ExecutionResult> results = executor.execute(scenario, ScenarioConfig.localhost());
        assertThat(results).hasSize(1);
        assertThat(results.getFirst().success()).isTrue();
    }

    @Test
    void ariaStepDelegatesToDispatcher() {
        var dispatched     = new ArrayList<ScenarioStep.AriaStep>();
        var ariaDispatcher = stubAriaDispatcher(dispatched, Map.of());
        var executor = new ScenarioExecutor(List.of(
                new AriaDeliveryHandler(ariaDispatcher)));

        var scenario = new Scenario("test", List.of(
                new ScenarioStep.AriaStep("click-btn", "click",
                                          new AriaTarget("button", "Submit"), null, null, null)));

        List<ExecutionResult> results = executor.execute(scenario, ScenarioConfig.localhost());

        assertThat(results).hasSize(1);
        assertThat(results.getFirst().success()).isTrue();
        assertThat(dispatched).hasSize(1);
        assertThat(dispatched.getFirst().action()).isEqualTo("click");
    }

    @Test
    void consecutiveUnnamedNonNavigateStepsBatched() {
        var batchSizes     = new ArrayList<Integer>();
        var ariaDispatcher = batchCapturingDispatcher(batchSizes);
        var executor = new ScenarioExecutor(List.of(
                new AriaDeliveryHandler(ariaDispatcher)));

        var scenario = new Scenario("test", List.of(
                new ScenarioStep.AriaStep(null, "click",
                                          new AriaTarget("button", "A"), null, null, null),
                new ScenarioStep.AriaStep(null, "fill",
                                          new AriaTarget("textbox", "Name"), "Alice", null, null),
                new ScenarioStep.AriaStep(null, "click",
                                          new AriaTarget("button", "B"), null, null, null)));

        executor.execute(scenario, ScenarioConfig.localhost());

        assertThat(batchSizes).containsExactly(3);
    }

    @Test
    void namedStepBreaksBatch() {
        var batchSizes     = new ArrayList<Integer>();
        var ariaDispatcher = batchCapturingDispatcher(batchSizes);
        var executor = new ScenarioExecutor(List.of(
                new AriaDeliveryHandler(ariaDispatcher)));

        var scenario = new Scenario("test", List.of(
                new ScenarioStep.AriaStep(null, "click",
                                          new AriaTarget("button", "A"), null, null, null),
                new ScenarioStep.AriaStep("important", "click",
                                          new AriaTarget("button", "B"), null, null, null),
                new ScenarioStep.AriaStep(null, "click",
                                          new AriaTarget("button", "C"), null, null, null)));

        executor.execute(scenario, ScenarioConfig.localhost());

        assertThat(batchSizes).containsExactly(1, 1);
    }

    @Test
    void navigateStepBreaksBatch() {
        var dispatched     = new ArrayList<ScenarioStep.AriaStep>();
        var ariaDispatcher = stubAriaDispatcher(dispatched, Map.of());
        var executor = new ScenarioExecutor(List.of(
                new AriaDeliveryHandler(ariaDispatcher)));

        var scenario = new Scenario("test", List.of(
                new ScenarioStep.AriaStep(null, "click",
                                          new AriaTarget("button", "A"), null, null, null),
                new ScenarioStep.AriaStep("nav", "navigate",
                                          null, "/page2", null, null)));

        executor.execute(scenario, ScenarioConfig.localhost());

        assertThat(dispatched).hasSize(2);
    }

    @Test
    void unknownDeliveryTypeReturnsFailure() {
        var executor = new ScenarioExecutor(List.of(new SimulatedDeliveryHandler()));
        var scenario = new Scenario("test", List.of(
                new ScenarioStep.GenericStep("step1", "desired-state",
                                             Map.of("deviceId", "dev-001"))));

        assertThatThrownBy(() -> executor.execute(scenario, ScenarioConfig.localhost()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("No DeliveryHandler registered");
    }

    @Test
    void simulatedStepReturnsOk() {
        var executor = new ScenarioExecutor(List.of(new SimulatedDeliveryHandler()));
        var scenario = new Scenario("test", List.of(
                new ScenarioStep.GenericStep("sim1", "simulated",
                                             Map.of("dataset", "metrics", "data", Map.of("cpu", 85)))));

        List<ExecutionResult> results = executor.execute(scenario, ScenarioConfig.localhost());
        assertThat(results).hasSize(1);
        assertThat(results.getFirst().success()).isTrue();
    }


    private static GraphQLDispatcher stubGraphQLDispatcher(Map<String, Map<String, Object>> responses) {
        return new GraphQLDispatcher(null, null) {
            @Override
            public Map<String, Object> dispatch(String domain, String operation,
                                                Map<String, Object> params,
                                                String endpoint, VariableContext ctx) {
                Map<String, Object> result = responses.get(operation);
                if (result == null) {
                    throw new RuntimeException("No stub for " + operation);
                }
                return result;
            }
        };
    }

    private static AriaDispatcher stubAriaDispatcher(
            List<ScenarioStep.AriaStep> captured,
            Map<String, Object> result) {
        return new AriaDispatcher(
                new EventBroadcaster(
                        new InMemoryEventStore(100), new TopicRegistry(),
                        (c, m) -> {}, o -> "{}"),
                500) {
            @Override
            public PushRequest.CommandResult send(ScenarioStep.AriaStep step) {
                captured.add(step);
                return new PushRequest.CommandResult("id", true, null, result);
            }

            @Override
            public PushRequest.CommandResult sendBatch(List<ScenarioStep.AriaStep> steps) {
                captured.addAll(steps);
                return new PushRequest.CommandResult("id", true, null, result);
            }
        };
    }

    private static AriaDispatcher batchCapturingDispatcher(List<Integer> batchSizes) {
        return new AriaDispatcher(
                new EventBroadcaster(
                        new InMemoryEventStore(100), new TopicRegistry(),
                        (c, m) -> {}, o -> "{}"),
                500) {
            @Override
            public PushRequest.CommandResult send(ScenarioStep.AriaStep step) {
                return new PushRequest.CommandResult("id", true, null, Map.of());
            }

            @Override
            public PushRequest.CommandResult sendBatch(List<ScenarioStep.AriaStep> steps) {
                batchSizes.add(steps.size());
                return new PushRequest.CommandResult("id", true, null, Map.of());
            }
        };
    }
}
