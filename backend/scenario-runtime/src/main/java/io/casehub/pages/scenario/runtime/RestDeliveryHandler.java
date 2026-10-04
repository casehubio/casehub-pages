package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.DeliveryContext;
import io.casehub.pages.scenario.DeliveryHandler;
import io.casehub.pages.scenario.StepOutcome;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class RestDeliveryHandler implements DeliveryHandler {

    private final RestDispatcher dispatcher;

    @Inject
    public RestDeliveryHandler(RestDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Override
    public String name() {
        return "rest";
    }

    @Override
    @SuppressWarnings("unchecked")
    public StepOutcome execute(String stepName, Map<String, Object> data,
                               DeliveryContext ctx) {
        try {
            String method = (String) data.getOrDefault("method", "POST");
            String url = (String) data.get("url");
            Map<String, Object> body = data.containsKey("body")
                    ? (Map<String, Object>) data.get("body") : Map.of();
            Map<String, String> headers = extractHeaders(data);
            Integer expectedStatus = extractExpectedStatus(data);
            String baseUrl = ctx.config("rest.baseUrl");
            String resolvedUrl = ctx.resolve(baseUrl + url);
            Map<String, Object> resolvedBody = ctx.resolveMap(body);
            Map<String, Object> result = dispatcher.dispatch(method, resolvedUrl,
                    resolvedBody, headers, expectedStatus);
            return StepOutcome.ok(stepName, result);
        } catch (Exception e) {
            return StepOutcome.fail(stepName, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> extractHeaders(Map<String, Object> data) {
        if (!data.containsKey("headers")) return Map.of();
        Map<String, Object> raw = (Map<String, Object>) data.get("headers");
        Map<String, String> headers = new HashMap<>();
        for (var entry : raw.entrySet()) {
            headers.put(entry.getKey(), String.valueOf(entry.getValue()));
        }
        return headers;
    }

    @SuppressWarnings("unchecked")
    private static Integer extractExpectedStatus(Map<String, Object> data) {
        if (!data.containsKey("await")) return null;
        Object awaitObj = data.get("await");
        if (awaitObj instanceof Map<?, ?> awaitMap) {
            Object status = awaitMap.get("status");
            if (status instanceof Number n) return n.intValue();
        }
        return null;
    }
}
