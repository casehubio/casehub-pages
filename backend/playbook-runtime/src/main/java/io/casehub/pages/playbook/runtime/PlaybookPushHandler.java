package io.casehub.pages.playbook.runtime;

import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.PushRequestHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class PlaybookPushHandler implements PushRequestHandler {

    private final PlaybookOrchestrator orchestrator;

    @Inject
    public PlaybookPushHandler(PlaybookOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @Override
    public boolean handles(PushRequest request) {
        return request instanceof PushRequest.ExecutorRegister
            || request instanceof PushRequest.StepResult;
    }

    @Override
    public void handle(String connectionId, PushRequest request) {
        switch (request) {
            case PushRequest.ExecutorRegister reg ->
                orchestrator.onExecutorRegister(connectionId, reg);
            case PushRequest.StepResult result ->
                orchestrator.onStepResult(result);
            default ->
                throw new IllegalArgumentException(
                    "Unhandled op: " + request.op());
        }
    }
}
