package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.AriaTarget;
import io.casehub.pages.scenario.Scenario;
import io.casehub.pages.scenario.ScenarioStep;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ScenarioExecutor {

    private static final Set<String> NON_BATCHABLE_ACTIONS =
            Set.of("navigate", "wait", "assert");

    private final GraphQLDispatcher graphQLDispatcher;
    private final AriaDispatcher ariaDispatcher;
    private final RestDispatcher restDispatcher;

    public ScenarioExecutor(GraphQLDispatcher graphQLDispatcher,
                            AriaDispatcher ariaDispatcher,
                            RestDispatcher restDispatcher) {
        this.graphQLDispatcher = graphQLDispatcher;
        this.ariaDispatcher = ariaDispatcher;
        this.restDispatcher = restDispatcher;
    }

    public ScenarioExecutor(GraphQLDispatcher graphQLDispatcher,
                            AriaDispatcher ariaDispatcher) {
        this(graphQLDispatcher, ariaDispatcher, null);
    }

    public ScenarioExecutor(GraphQLDispatcher graphQLDispatcher) {
        this(graphQLDispatcher, null, null);
    }

    public List<ExecutionResult> execute(Scenario scenario, ScenarioConfig config) {
        var context = new VariableContext();
        var results = new ArrayList<ExecutionResult>();
        var steps = scenario.steps();

        int i = 0;
        while (i < steps.size()) {
            ScenarioStep step = steps.get(i);

            if (step instanceof ScenarioStep.AriaStep as && isBatchable(as)) {
                var batch = collectBatch(steps, i);
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
        return switch (step) {
            case ScenarioStep.GraphQLStep gs -> executeGraphQL(gs, config, context);
            case ScenarioStep.AriaStep as -> executeAria(as, context);
            case ScenarioStep.SimulatedStep ss -> ExecutionResult.ok(ss.name(), Map.of());
            case ScenarioStep.RestStep rs -> executeRest(rs, config, context);
        };}

    private ExecutionResult executeAria(ScenarioStep.AriaStep step,
                                         VariableContext context) {
        if (ariaDispatcher == null) {
            return ExecutionResult.ok(step.name(), Map.of());
        }
        try {
            var resolved  = resolveAriaStep(step, context);
            var result    = ariaDispatcher.send(resolved);
            var resultMap = result.result() != null ? result.result() : Map.<String, Object>of();
            return ExecutionResult.ok(step.name(), resultMap);
        } catch (AriaCommandException e) {
            return ExecutionResult.fail(step.name(), e.getMessage());
        }}

    private ExecutionResult executeBatch(List<ScenarioStep.AriaStep> batch) {
        if (ariaDispatcher == null) {
            return ExecutionResult.ok(null, Map.of());
        }
        try {
            var result = ariaDispatcher.sendBatch(batch);
            return ExecutionResult.ok(null, result.result() != null
                    ? result.result() : Map.of());
        } catch (AriaCommandException e) {
            return ExecutionResult.fail(null, e.getMessage());
        }
    }

    private ExecutionResult executeGraphQL(ScenarioStep.GraphQLStep step,
                                           ScenarioConfig config,
                                           VariableContext context) {
        try {
            String endpoint = config.graphQLEndpoint(step.domain());
            Map<String, Object> result;
            if (step.await() != null) {
                var awaitEngine = new AwaitEngine(() ->
                        graphQLDispatcher.dispatch(step, endpoint, context));
                result = awaitEngine.poll(step.await());
            } else {
                result = graphQLDispatcher.dispatch(step, endpoint, context);
            }
            return ExecutionResult.ok(step.name(), result);
        } catch (Exception e) {
            return ExecutionResult.fail(step.name(), e.getMessage());
        }
    }

    private ExecutionResult executeRest(ScenarioStep.RestStep step,
                                         ScenarioConfig config,
                                         VariableContext context) {
        if (restDispatcher == null) {
            return ExecutionResult.ok(step.name(), Map.of());
        }
        try {
            String baseUrl = config.restBaseUrl();
            Map<String, Object> result;
            if (step.await() != null) {
                var awaitEngine = new AwaitEngine(() ->
                        restDispatcher.dispatch(step, baseUrl, context));
                result = awaitEngine.poll(step.await());
            } else {
                result = restDispatcher.dispatch(step, baseUrl, context);
            }
            return ExecutionResult.ok(step.name(), result);
        } catch (Exception e) {
            return ExecutionResult.fail(step.name(), e.getMessage());
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

    @SuppressWarnings("unchecked")
    private ScenarioStep.AriaStep resolveAriaStep(ScenarioStep.AriaStep step,
                                                  VariableContext context) {
        var resolvedTarget = step.target() != null
                             ? resolveAriaTarget(step.target(), context)
                             : null;
        var resolvedValue = step.value() != null
                            ? context.resolve(step.value())
                            : null;
        var resolvedState = step.state() != null
                            ? context.resolveMap(step.state())
                            : null;
        if (resolvedTarget == step.target() && resolvedValue == step.value()
            && resolvedState == step.state()) {
            return step;
        }
        return new ScenarioStep.AriaStep(step.name(), step.action(),
                                         resolvedTarget, resolvedValue, resolvedState, step.timeout());
    }

    private AriaTarget resolveAriaTarget(AriaTarget target, VariableContext context) {
        var resolvedName = context.resolve(target.name());
        var resolvedWithin = target.within() != null
                             ? resolveAriaTarget(target.within(), context)
                             : null;
        if (resolvedName.equals(target.name()) && resolvedWithin == target.within()) {
            return target;
        }
        return new AriaTarget(target.role(), resolvedName, resolvedWithin);
    }

}
