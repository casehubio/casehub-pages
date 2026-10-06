package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.DeliveryContext;
import io.casehub.pages.playbook.DeliveryHandler;
import io.casehub.pages.playbook.StepOutcome;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.Map;

@ApplicationScoped
public class GraphQLDeliveryHandler implements DeliveryHandler {

    private final GraphQLDispatcher dispatcher;

    @Inject
    public GraphQLDeliveryHandler(GraphQLDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Override
    public String name() {
        return "graphql";
    }

    @Override
    @SuppressWarnings("unchecked")
    public StepOutcome execute(String stepName, Map<String, Object> data,
                               DeliveryContext ctx) {
        try {
            String domain = (String) data.get("domain");
            String operation = (String) data.get("operation");
            Map<String, Object> params = data.containsKey("params")
                    ? (Map<String, Object>) data.get("params") : Map.of();
            String endpoint = ctx.config("graphql.endpoint." + domain);
            Map<String, Object> resolvedParams = ctx.resolveMap(params);
            Map<String, Object> result = dispatcher.dispatch(domain, operation,
                    resolvedParams, endpoint, null);
            return StepOutcome.ok(stepName, result);
        } catch (Exception e) {
            return StepOutcome.fail(stepName, e.getMessage());
        }
    }
}
