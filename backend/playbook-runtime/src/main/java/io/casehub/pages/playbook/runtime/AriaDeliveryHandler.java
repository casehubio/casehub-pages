package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.CompactStep;
import io.casehub.pages.playbook.DeliveryContext;
import io.casehub.pages.playbook.DeliveryHandler;
import io.casehub.pages.playbook.StepOutcome;
import io.casehub.pages.push.PushRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.LinkedHashMap;
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
            CompactStep step = toCompactStep(stepName, data);
            PushRequest.CommandResult result = dispatcher.send(step);
            Map<String, Object> resultMap = result.result() != null ? result.result() : Map.of();
            return StepOutcome.ok(stepName, resultMap);
        } catch (AriaCommandException e) {
            return StepOutcome.fail(stepName, e.getMessage());
        }
    }

    CompactStep toCompactStep(String stepName, Map<String, Object> data) {
        String action = (String) data.getOrDefault("action", stepName);
        var params = new LinkedHashMap<>(data);
        return new CompactStep(action, params, null, null, null, Map.of());
    }

    public PushRequest.CommandResult sendBatch(List<CompactStep> steps) {
        return dispatcher.sendBatch(steps);
    }
}
