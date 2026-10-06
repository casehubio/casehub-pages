package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.DeliveryContext;
import io.casehub.pages.playbook.DeliveryHandler;
import io.casehub.pages.playbook.StepOutcome;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Map;

@ApplicationScoped
public class SimulatedDeliveryHandler implements DeliveryHandler {

    @Override
    public String name() {
        return "simulated";
    }

    @Override
    public StepOutcome execute(String stepName, Map<String, Object> data,
                               DeliveryContext ctx) {
        return StepOutcome.ok(stepName, Map.of());
    }
}
