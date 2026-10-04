package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.AwaitCondition;
import io.casehub.pages.scenario.DeliveryContext;
import io.casehub.pages.scenario.DeliveryHandler;
import io.casehub.pages.scenario.Scenario;
import io.casehub.pages.scenario.ScenarioStep;
import io.casehub.pages.scenario.StepOutcome;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class ScenarioExecutor {

    private static final Set<String> NON_BATCHABLE_ACTIONS =
            Set.of("navigate", "wait", "assert");

    private final Map<String, DeliveryHandler> handlers;
    private final AriaDeliveryHandler          ariaHandler;


    @Inject
    public ScenarioExecutor(@Any Instance<DeliveryHandler> handlerInstances) {
        this(handlerInstances.stream().toList());
    }

    public ScenarioExecutor(List<DeliveryHandler> handlerList) {
        this.handlers = new HashMap<>();
        AriaDeliveryHandler foundAria = null;
        for (DeliveryHandler h : handlerList) {
            handlers.put(h.name(), h);
            if (h instanceof AriaDeliveryHandler a) {foundAria = a;}
        }
        this.ariaHandler = foundAria;
    }

    public List<ExecutionResult> execute(Scenario scenario, ScenarioConfig config) {
        var context = new VariableContext();
        var results = new ArrayList<ExecutionResult>();
        var steps   = scenario.steps();

        int i = 0;
        while (i < steps.size()) {
            ScenarioStep step = steps.get(i);

            if (step instanceof ScenarioStep.AriaStep as && isBatchable(as)) {
                var             batch  = collectBatch(steps, i);
                ExecutionResult result = executeBatch(batch);
                results.add(result);
                if (!result.success()) {
                    throw new RuntimeException("Batch failed: " + result.error());
                }
                i += batch.size();
            } else {
                ExecutionResult result = executeStep(step, config, context);
                results.add(result);
                if (!result.success()) {
                    throw new RuntimeException("Step '" + step.name()
                                               + "' failed: " + result.error());
                }
                if (result.result() != null && !result.result().isEmpty()
                    && step.name() != null) {
                    context.put(step.name(), result.result());
                }
                i++;
            }
        }

        return results;
    }

    private ExecutionResult executeStep(ScenarioStep step, ScenarioConfig config,
                                        VariableContext context) {
        String              delivery;
        String              stepName;
        Map<String, Object> data;

        switch (step) {
            case ScenarioStep.AriaStep as -> {
                delivery = "aria";
                stepName = as.name();
                data     = ariaStepToMap(as);
            }
            case ScenarioStep.GenericStep gs -> {
                delivery = gs.delivery();
                stepName = gs.name();
                data     = new HashMap<>(gs.data());
            }
        }

        DeliveryHandler handler = handlers.get(delivery);
        if (handler == null) {
            return ExecutionResult.fail(stepName,
                                        "No DeliveryHandler registered for delivery type: " + delivery);
        }

        DeliveryContext ctx   = new RuntimeDeliveryContext(config, context);
        AwaitCondition  await = extractAwait(data);

        try {
            StepOutcome outcome;
            if (await != null) {
                var                 engine = new AwaitEngine(() -> handler.execute(stepName, data, ctx).result());
                Map<String, Object> result = engine.poll(await);
                outcome = StepOutcome.ok(stepName, result);
            } else {
                outcome = handler.execute(stepName, data, ctx);
            }
            return new ExecutionResult(outcome.stepName(), outcome.success(),
                                       outcome.result(), outcome.error());
        } catch (Exception e) {
            return ExecutionResult.fail(stepName, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private AwaitCondition extractAwait(Map<String, Object> data) {
        Object awaitObj = data.get("await");
        if (awaitObj instanceof Map<?, ?> awaitMap) {
            Map<String, Object> match = (Map<String, Object>) awaitMap.get("match");
            if (match == null) {return null;}
            Integer timeout = awaitMap.containsKey("timeout")
                              ? ((Number) awaitMap.get("timeout")).intValue() : null;
            Integer interval = awaitMap.containsKey("interval")
                               ? ((Number) awaitMap.get("interval")).intValue() : null;
            return new AwaitCondition(match, timeout, interval);
        }
        return null;
    }

    private Map<String, Object> ariaStepToMap(ScenarioStep.AriaStep as) {
        var map = new HashMap<String, Object>();
        map.put("action", as.action());
        if (as.target() != null) {
            map.put("target", Map.of("role", as.target().role(), "name", as.target().name()));
        }
        if (as.value() != null) {map.put("value", as.value());}
        if (as.state() != null) {map.put("state", as.state());}
        if (as.timeout() != null) {map.put("timeout", as.timeout());}
        return map;
    }

    private ExecutionResult executeBatch(List<ScenarioStep.AriaStep> batch) {
        if (ariaHandler == null) {
            return ExecutionResult.ok(null, Map.of());
        }
        try {
            var result = ariaHandler.sendBatch(batch);
            return ExecutionResult.ok(null, result.result() != null
                                            ? result.result() : Map.of());
        } catch (AriaCommandException e) {
            return ExecutionResult.fail(null, e.getMessage());
        }
    }

    private boolean isBatchable(ScenarioStep.AriaStep step) {
        return step.name() == null
               && !NON_BATCHABLE_ACTIONS.contains(step.action());
    }

    private List<ScenarioStep.AriaStep> collectBatch(List<ScenarioStep> steps, int start) {
        var batch = new ArrayList<ScenarioStep.AriaStep>();
        for (int j = start; j < steps.size(); j++) {
            if (steps.get(j) instanceof ScenarioStep.AriaStep as && isBatchable(as)) {
                batch.add(as);
            } else {
                break;
            }
        }
        return batch;
    }
}
