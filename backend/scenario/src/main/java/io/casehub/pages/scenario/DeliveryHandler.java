package io.casehub.pages.scenario;

import java.util.Map;

public interface DeliveryHandler {
    String name();
    StepOutcome execute(String stepName, Map<String, Object> data, DeliveryContext ctx);
}
