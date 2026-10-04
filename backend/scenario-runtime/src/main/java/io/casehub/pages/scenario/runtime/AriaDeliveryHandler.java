package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.AriaTarget;
import io.casehub.pages.scenario.DeliveryContext;
import io.casehub.pages.scenario.DeliveryHandler;
import io.casehub.pages.scenario.ScenarioStep;
import io.casehub.pages.scenario.StepOutcome;
import io.casehub.pages.push.PushRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;
import java.util.Map;

@ApplicationScoped
public class AriaDeliveryHandler implements DeliveryHandler {

    private final AriaDispatcher dispatcher;

    @Inject
    public AriaDeliveryHandler(AriaDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Override
    public String name() {
        return "aria";
    }

    @Override
    public StepOutcome execute(String stepName, Map<String, Object> data,
                               DeliveryContext ctx) {
        if (dispatcher == null) {
            return StepOutcome.ok(stepName, Map.of());
        }
        try {
            ScenarioStep.AriaStep ariaStep = toAriaStep(stepName, data);
            PushRequest.CommandResult result = dispatcher.send(ariaStep);
            Map<String, Object> resultMap = result.result() != null ? result.result() : Map.of();
            return StepOutcome.ok(stepName, resultMap);
        } catch (AriaCommandException e) {
            return StepOutcome.fail(stepName, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    ScenarioStep.AriaStep toAriaStep(String stepName, Map<String, Object> data) {
        String action = (String) data.get("action");
        String value = (String) data.get("value");
        Map<String, Object> state = data.containsKey("state")
                ? (Map<String, Object>) data.get("state") : null;
        Integer timeout = data.containsKey("timeout")
                ? ((Number) data.get("timeout")).intValue() : null;
        AriaTarget target = extractTarget(data);
        return new ScenarioStep.AriaStep(stepName, action, target, value, state, timeout);
    }

    private static AriaTarget extractTarget(Map<String, Object> data) {
        Object targetObj = data.get("target");
        if (targetObj instanceof Map<?, ?> targetMap) {
            String role = (String) targetMap.get("role");
            String name = (String) targetMap.get("name");
            if (role != null && name != null) {
                return new AriaTarget(role, name);
            }
        }
        return null;
    }

    public PushRequest.CommandResult sendBatch(List<ScenarioStep.AriaStep> steps) {
        return dispatcher.sendBatch(steps);
    }
}
