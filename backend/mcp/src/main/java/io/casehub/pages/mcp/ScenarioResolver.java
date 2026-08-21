package io.casehub.pages.mcp;

import io.casehub.pages.scenario.runtime.RunToResult;
import io.casehub.pages.scenario.runtime.ScenarioOrchestrator;
import io.casehub.pages.scenario.runtime.ScenarioState;
import io.casehub.platform.api.mcp.McpDomain;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Mutation;
import org.eclipse.microprofile.graphql.Query;

@McpDomain("scenario")
@GraphQLApi
@ApplicationScoped
public class ScenarioResolver {

    @Inject
    ScenarioOrchestrator orchestrator;

    @Mutation("scenarioSubmit")
    public ScenarioState submit(String yaml) {
        orchestrator.start(yaml);
        return orchestrator.state();
    }

    @Mutation("scenarioPause")
    public ScenarioState pause() {
        orchestrator.pause();
        return orchestrator.state();
    }

    @Mutation("scenarioResume")
    public ScenarioState resume() {
        orchestrator.resume();
        return orchestrator.state();
    }

    @Mutation("scenarioStep")
    public ScenarioState step() {
        orchestrator.step();
        return orchestrator.state();
    }

    @Mutation("scenarioRunTo")
    public ScenarioState runTo(String label) {
        var result = orchestrator.runTo(label);
        if (result == RunToResult.NOT_FOUND) {
            throw new IllegalArgumentException("Label not found: " + label);
        }
        if (result == RunToResult.ALREADY_PAST) {
            throw new IllegalArgumentException("Already past: " + label);
        }
        return orchestrator.state();
    }

    @Mutation("scenarioSpeed")
    public ScenarioState speed(double speed) {
        orchestrator.speed(speed);
        return orchestrator.state();
    }

    @Query("scenarioStatus")
    public ScenarioState status() {
        return orchestrator.state();
    }
}
