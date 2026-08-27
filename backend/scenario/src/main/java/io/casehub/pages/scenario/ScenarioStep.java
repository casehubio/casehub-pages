package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public sealed interface ScenarioStep {

    String name();

    record AriaStep(String name, String action, AriaTarget target,
                    String value, Map<String, Object> state,
                    Integer timeout) implements ScenarioStep {
        public AriaStep {
            Objects.requireNonNull(action, "action");
            state = state != null ? Map.copyOf(state) : null;
        }
    }

    record GraphQLStep(String name, String domain, String operation,
                       Map<String, Object> params,
                       AwaitCondition await) implements ScenarioStep {
        public GraphQLStep {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(operation, "operation");
            params = params != null ? Map.copyOf(params) : Map.of();
        }
    }

    record SimulatedStep(String name, String dataset,
                         Map<String, Object> data) implements ScenarioStep {
        public SimulatedStep {
            Objects.requireNonNull(dataset, "dataset");
            data = data != null ? Map.copyOf(data) : Map.of();
        }
    }

    record RestStep(String name, String method, String url,
                    Map<String, Object> body, Map<String, String> headers,
                    Integer expectedStatus, AwaitCondition await) implements ScenarioStep {
        public RestStep {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(method, "method");
            Objects.requireNonNull(url, "url");
            body = body != null ? Map.copyOf(body) : Map.of();
            headers = headers != null ? Map.copyOf(headers) : Map.of();
        }
    }
}
