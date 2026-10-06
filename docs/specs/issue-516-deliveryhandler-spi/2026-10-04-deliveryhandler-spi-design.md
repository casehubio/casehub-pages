# DeliveryHandler SPI — Plugin-Extensible Scenario Delivery Modes

**Issue:** casehubio/casehub-pages#516
**Date:** 2026-10-04
**Branch:** issue-516-deliveryhandler-spi

## Summary

Replace the hardcoded delivery-mode dispatch in `PlaybookExecutor` and
`ScenarioParser` with a CDI-discovered `DeliveryHandler` SPI. Plugin
modules (e.g. IoT) implement the interface to add new delivery modes
(e.g. `desired-state`) without modifying Pages. Existing delivery types
(graphql, rest, simulated, aria) are migrated to the SPI for uniform
dispatch.

## Scope

**In scope:**
- `DeliveryHandler` interface with `name()` and `execute()` in `backend/scenario/`
- `StepOutcome` and `DeliveryContext` types in `backend/scenario/`
- `GenericStep` record added to the sealed `ScenarioStep` interface
- `ScenarioParser` updated to create `GenericStep` for all `delivery:` values
- Four `DeliveryHandler` implementations in `backend/scenario-runtime/`:
  `GraphQLDeliveryHandler`, `RestDeliveryHandler`, `SimulatedDeliveryHandler`,
  `AriaDeliveryHandler`
- `PlaybookExecutor` refactored to use CDI `Instance<DeliveryHandler>` discovery
- Batching and await logic remain in the executor
- Unit tests for handler dispatch, unknown-type handling, handler priority

**Out of scope:**
- TypeScript `StepExecutor` changes (already extensible via interface)
- `DesiredStateDeliveryHandler` implementation (downstream: casehubio/iot#126)
- `PlaybookOrchestrator` changes (uses HierarchicalStep/ScenarioCommand, not ScenarioStep)
- YAML schema changes (the `delivery:` field already exists and is free-form)

## Architecture

### Component Diagram

```
                    .scenario.yaml
                         │
                         ▼
                  ScenarioParser
                  (delivery: → GenericStep)
                  (shorthand: → AriaStep)
                         │
                         ▼
                  ScenarioExecutor
                  (CDI Instance<DeliveryHandler>)
                  (name → handler map)
                  (batching, await wrapping)
                         │
          ┌──────────────┼──────────────┬──────────────┐
          ▼              ▼              ▼              ▼
   GraphQL          Rest          Simulated        Aria
   Delivery         Delivery      Delivery         Delivery
   Handler          Handler       Handler          Handler
   (graphql)        (rest)        (simulated)      (aria)
                                                      │
                                                      ▼
                                              AriaDispatcher
                                              (push wire)
```

Plugin modules add new handlers without touching this diagram:

```
   iot module
       │
       ▼
  DesiredState
  Delivery
  Handler
  (desired-state)
```

### New Types in `backend/scenario/`

```java
package io.casehub.pages.scenario;

import java.util.Map;

public interface DeliveryHandler {
    String name();
    StepOutcome execute(String stepName, Map<String, Object> data,
                        DeliveryContext ctx);
}
```

```java
package io.casehub.pages.scenario;

import java.util.Map;

public record StepOutcome(boolean success, String stepName,
                          Map<String, Object> result, String error) {
    public static StepOutcome ok(String stepName, Map<String, Object> result) {
        return new StepOutcome(true, stepName, result, null);
    }

    public static StepOutcome fail(String stepName, String error) {
        return new StepOutcome(false, stepName, Map.of(), error);
    }
}
```

```java
package io.casehub.pages.scenario;

import java.util.Map;

public interface DeliveryContext {
    String config(String key);
    String resolve(String template);
    Map<String, Object> resolveMap(Map<String, Object> data);
}
```

### ScenarioStep Changes

```java
public sealed interface ScenarioStep {

    String name();

    record AriaStep(/* unchanged */) implements ScenarioStep { }

    record GenericStep(String name, String delivery,
                       Map<String, Object> data) implements ScenarioStep {
        public GenericStep {
            Objects.requireNonNull(delivery, "delivery");
            data = data != null ? Map.copyOf(data) : Map.of();
        }
    }
}
```

`GraphQLStep`, `SimulatedStep`, and `RestStep` are removed. The parser
creates `GenericStep` for all `delivery:` values. The handler extracts
fields from the data map.

### ScenarioParser Changes

The switch at line 94 becomes:

```java
return new ScenarioStep.GenericStep(
    (String) fields.get("name"),
    delivery,
    fields
);
```

No more `buildGraphQLStep`, `buildSimulatedStep`, `buildRestStep`
methods. The parser no longer needs to know about specific delivery
types — it passes the raw fields map through.

### ScenarioExecutor Changes

```java
@ApplicationScoped
public class ScenarioExecutor {

    private final Map<String, DeliveryHandler> handlers;

    @Inject
    public ScenarioExecutor(@Any Instance<DeliveryHandler> handlerInstances) {
        this.handlers = new HashMap<>();
        for (DeliveryHandler h : handlerInstances) {
            handlers.put(h.name(), h);
        }
    }

    private ExecutionResult executeStep(ScenarioStep step, ScenarioConfig config,
                                        VariableContext context) {
        return switch (step) {
            case ScenarioStep.AriaStep as -> executeViaHandler("aria", as.name(),
                    ariaStepToMap(as), config, context);
            case ScenarioStep.GenericStep gs -> executeViaHandler(gs.delivery(),
                    gs.name(), gs.data(), config, context);
        };
    }

    private ExecutionResult executeViaHandler(String delivery, String stepName,
                                              Map<String, Object> data,
                                              ScenarioConfig config,
                                              VariableContext context) {
        DeliveryHandler handler = handlers.get(delivery);
        if (handler == null) {
            return ExecutionResult.fail(stepName,
                "No DeliveryHandler registered for delivery type: " + delivery);
        }

        DeliveryContext ctx = new RuntimeDeliveryContext(config, context);

        AwaitCondition await = extractAwait(data);
        StepOutcome outcome;
        if (await != null) {
            // AwaitEngine generified to Supplier<StepOutcome> (currently Map-typed)
            var engine = new AwaitEngine<>(() -> handler.execute(stepName, data, ctx));
            outcome = engine.poll(await);
        } else {
            outcome = handler.execute(stepName, data, ctx);
        }

        return new ExecutionResult(outcome.stepName(), outcome.success(),
                outcome.result(), outcome.error());
    }
}
```

`RuntimeDeliveryContext` is a package-private adapter in scenario-runtime
that wraps `PlaybookConfig` + `VariableContext`:

```java
class RuntimeDeliveryContext implements DeliveryContext {
    private final ScenarioConfig config;
    private final VariableContext variables;

    RuntimeDeliveryContext(ScenarioConfig config, VariableContext variables) {
        this.config = config;
        this.variables = variables;
    }

    @Override
    public String config(String key) {
        return switch (key) {
            case "rest.baseUrl" -> config.restBaseUrl();
            default -> {
                if (key.startsWith("graphql.endpoint.")) {
                    yield config.graphQLEndpoint(key.substring("graphql.endpoint.".length()));
                }
                if (key.startsWith("push.endpoint.")) {
                    yield config.pushEndpoint(key.substring("push.endpoint.".length()));
                }
                yield null;
            }
        };
    }

    @Override
    public String resolve(String template) {
        return variables.resolve(template);
    }

    @Override
    public Map<String, Object> resolveMap(Map<String, Object> data) {
        return variables.resolveMap(data);
    }
}
```

### Batching

The executor retains ARIA batching logic. It checks if consecutive steps
share the `"aria"` delivery and are batchable (no name, non-navigating
action), then calls the `AriaDeliveryHandler` in batch mode via a
package-private method. This is executor-internal — the SPI has no batch
concept.

### Handler Implementations

Each handler in `backend/scenario-runtime/`:

**GraphQLDeliveryHandler** — wraps `GraphQLDispatcher`:
- `name()` → `"graphql"`
- Extracts `domain`, `operation`, `params` from data map
- Calls `graphQLDispatcher.dispatch()` with resolved endpoint

**RestDeliveryHandler** — wraps `RestDispatcher`:
- `name()` → `"rest"`
- Extracts `method`, `url`, `body`, `headers`, `expectedStatus` from data map
- Calls `restDispatcher.dispatch()` with resolved base URL

**SimulatedDeliveryHandler** — no-op:
- `name()` → `"simulated"`
- Returns `StepOutcome.ok(stepName, Map.of())`

**AriaDeliveryHandler** — wraps `AriaDispatcher`:
- `name()` → `"aria"`
- Converts data map to ARIA command format
- Calls `ariaDispatcher.send()`

### Error Handling

- Unknown delivery type → `ExecutionResult.fail()` with descriptive message
  (not an exception — allows the executor to report which step failed)
- Handler exceptions → caught by executor, mapped to `ExecutionResult.fail()`
- Duplicate handler names → logged warning at startup, last-registered wins

### Downstream Plugin Example

A downstream module (e.g. `casehubio/iot`) adds a handler:

```java
@ApplicationScoped
public class DesiredStateDeliveryHandler implements DeliveryHandler {
    @Override
    public String name() { return "desired-state"; }

    @Override
    public StepOutcome execute(String stepName, Map<String, Object> data,
                               DeliveryContext ctx) {
        String deviceId = (String) data.get("deviceId");
        Map<String, Object> properties = (Map<String, Object>) data.get("properties");
        // send desired-state command to device
        return StepOutcome.ok(stepName, Map.of("accepted", true));
    }
}
```

YAML usage:

```yaml
- name: set-thermostat
  delivery: desired-state
  deviceId: "${device.id}"
  properties:
    targetTemperature: 22
```

No changes to Pages required.

## Testing

- Handler discovery: test that all four built-in handlers are discovered
- Unknown delivery: test that an unregistered delivery type returns failure
- GraphQL handler: test field extraction from data map, endpoint resolution
- REST handler: test field extraction, base URL resolution, status checking
- Simulated handler: test no-op returns ok
- Aria handler: test delegation to AriaDispatcher
- Await wrapping: test that await conditions are applied by executor
- Batching: test that consecutive batchable aria steps are still batched
- Variable resolution: test that DeliveryContext resolves templates in data
- Parser: test that all delivery values produce GenericStep

## References

- `backend/scenario/src/main/java/io/casehub/pages/scenario/ScenarioStep.java` — sealed interface being extended
- `backend/scenario/src/main/java/io/casehub/pages/scenario/ScenarioParser.java:94` — hardcoded delivery switch
- `backend/scenario-runtime/src/main/java/io/casehub/pages/scenario/runtime/ScenarioExecutor.java:73` — hardcoded step dispatch
- `backend/data/src/main/java/io/casehub/pages/data/DataProvider.java` — established CDI SPI pattern
- `backend/data/src/main/java/io/casehub/pages/data/DataResource.java:42` — Instance<DataProvider> injection pattern
- casehubio/iot#126 — downstream DesiredStateDeliveryHandler
