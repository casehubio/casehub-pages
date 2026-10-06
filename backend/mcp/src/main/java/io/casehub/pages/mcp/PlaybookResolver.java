package io.casehub.pages.mcp;

import io.casehub.pages.playbook.runtime.RunToResult;
import io.casehub.pages.playbook.runtime.PlaybookOrchestrator;
import io.casehub.pages.playbook.runtime.PlaybookState;
import io.casehub.platform.api.mcp.McpDomain;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Mutation;
import org.eclipse.microprofile.graphql.Query;
@McpDomain("playbook")
@GraphQLApi
@ApplicationScoped
public class PlaybookResolver {

    @Inject
    PlaybookOrchestrator orchestrator;

    @Mutation("playbookSubmit")
    public PlaybookState submit(String yaml, String callbackUrl,
                                String dispatchId, String callbackToken) {
        if (callbackUrl != null) {
            orchestrator.start(yaml, false, callbackUrl, dispatchId, callbackToken);
        } else {
            orchestrator.start(yaml);
        }
        return orchestrator.state();
    }

    @Mutation("playbookPause")
    public PlaybookState pause() {
        orchestrator.pause();
        return orchestrator.state();
    }

    @Mutation("playbookResume")
    public PlaybookState resume() {
        orchestrator.resume();
        return orchestrator.state();
    }

    @Mutation("playbookStep")
    public PlaybookState step() {
        orchestrator.step();
        return orchestrator.state();
    }

    @Mutation("playbookRunTo")
    public PlaybookState runTo(String label) {
        var result = orchestrator.runTo(label);
        if (result == RunToResult.NOT_FOUND) {
            throw new IllegalArgumentException("Label not found: " + label);
        }
        if (result == RunToResult.ALREADY_PAST) {
            throw new IllegalArgumentException("Already past: " + label);
        }
        return orchestrator.state();
    }

    @Mutation("playbookSpeed")
    public PlaybookState speed(double speed) {
        orchestrator.speed(speed);
        return orchestrator.state();
    }

    @Query("playbookStatus")
    public PlaybookState status() {
        return orchestrator.state();
    }
}
