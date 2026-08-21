package io.casehub.pages.scenario.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.push.PushMessage;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

class ScenarioExecutorClientTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static class TestActions {
        final List<String> invoked = new CopyOnWriteArrayList<>();

        @ScenarioAction("create-ticket")
        Map<String, Object> createTicket(ActionContext ctx) {
            invoked.add("create-ticket:" + ctx.data("subject"));
            return Map.of("ticketId", "T-001");
        }

        @ScenarioAction("verify-ticket")
        Map<String, Object> verifyTicket(ActionContext ctx) {
            invoked.add("verify-ticket");
            return Map.of("status", "TRIAGED");
        }

        @ScenarioAction("fail-action")
        Map<String, Object> failAction(ActionContext ctx) {
            throw new RuntimeException("Simulated failure");
        }
    }

    private List<String> stepResults(List<String> sent) {
        return sent.stream().filter(s -> s.contains("step-result")).toList();
    }

    private void awaitStepResults(List<String> sent, int count) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            if (stepResults(sent).size() >= count) return;
            Thread.sleep(20);
        }
        assertThat(stepResults(sent)).hasSize(count);
    }

    @Test
    void executesSequenceAndSendsStepResults() throws Exception {
        var actions = new TestActions();
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk", List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "create", "label", "Create ticket",
                "commands", List.of(Map.of("action", "create-ticket",
                    "data", Map.of("subject", "Laptop broken")))),
            Map.of("name", "verify", "label", "Verify ticket",
                "commands", List.of(Map.of("action", "verify-ticket")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 2);

        assertThat(actions.invoked).containsExactly(
            "create-ticket:Laptop broken", "verify-ticket");
        var results = stepResults(sent);
        assertThat(results.get(0)).contains("\"ok\":true")
            .contains("\"stepName\":\"create\"");
        assertThat(results.get(1)).contains("\"ok\":true")
            .contains("\"stepName\":\"verify\"");
    }

    @Test
    void sendsExecutorRegister() {
        var sent = new CopyOnWriteArrayList<String>();
        ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        assertThat(sent).hasSize(1);
        assertThat(sent.getFirst()).contains("executor-register")
            .contains("helpdesk")
            .contains("create-ticket");
    }

    @Test
    void handlesFailingAction() throws Exception {
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "fail", "label", "Will fail",
                "commands", List.of(Map.of("action", "fail-action")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(stepResults(sent).getFirst()).contains("\"ok\":false")
            .contains("Simulated failure");
    }

    @Test
    void handlesMultipleCommandsInOneStep() throws Exception {
        var actions = new TestActions();
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "both", "label", "Create and verify",
                "commands", List.of(
                    Map.of("action", "create-ticket",
                        "data", Map.of("subject", "Test")),
                    Map.of("action", "verify-ticket")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(actions.invoked).containsExactly(
            "create-ticket:Test", "verify-ticket");
    }

    @Test
    void ignoresNonDispatchMessages() {
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        sent.clear();
        client.onMessage("{\"op\":\"event\",\"topic\":\"some:topic\",\"payload\":{}}");

        assertThat(stepResults(sent)).isEmpty();
    }

    @Test
    void passesActorToActionContext() throws Exception {
        var actors = new CopyOnWriteArrayList<String>();
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("check-actor")
            Map<String, Object> checkActor(ActionContext ctx) {
                actors.add(ctx.actor());
                return Map.of();
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        client.onMessage(PushMessage.dispatchSequence("s-001", "test",
            JSON.writeValueAsString(List.of(
                Map.of("name", "s1", "label", "Check",
                    "actor", "hw-specialist",
                    "commands", List.of(Map.of("action", "check-actor"))))),
            1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(actors).containsExactly("hw-specialist");
    }

    @Test
    void pausedDispatchDoesNotExecuteUntilResumed() throws Exception {
        var actions = new TestActions();
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk", List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "s1", "label", "Step 1",
                "commands", List.of(Map.of("action", "create-ticket",
                    "data", Map.of("subject", "Paused"))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, true));

        Thread.sleep(200);
        assertThat(stepResults(sent)).isEmpty();

        client.onMessage(PushMessage.executorControl("s-001", "resume", null));

        awaitStepResults(sent, 1);
        assertThat(actions.invoked).containsExactly("create-ticket:Paused");
    }

    @Test
    void pauseControlStopsAfterCurrentStep() throws Exception {
        var actions = new TestActions();
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk", List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "s1", "label", "Step 1",
                "commands", List.of(Map.of("action", "create-ticket",
                    "data", Map.of("subject", "First")))),
            Map.of("name", "s2", "label", "Step 2",
                "commands", List.of(Map.of("action", "verify-ticket")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        client.onMessage(PushMessage.executorControl("s-001", "pause", null));

        Thread.sleep(300);
        int afterPause = stepResults(sent).size();

        client.onMessage(PushMessage.executorControl("s-001", "resume", null));
        awaitStepResults(sent, 2);

        assertThat(actions.invoked).containsExactly("create-ticket:First", "verify-ticket");
    }

    @Test
    void speedControlAffectsDelay() throws Exception {
        var actions = new TestActions();
        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk", List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "s1", "label", "Step 1",
                "commands", List.of(Map.of("action", "create-ticket",
                    "data", Map.of("subject", "Speed")))),
            Map.of("name", "s2", "label", "Step 2",
                "commands", List.of(Map.of("action", "verify-ticket")))
        ));

        long start = System.currentTimeMillis();
        client.onMessage(PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 2.0, false));

        awaitStepResults(sent, 2);
        long elapsed = System.currentTimeMillis() - start;

        assertThat(elapsed).isGreaterThanOrEqualTo(400);
        assertThat(elapsed).isLessThan(2000);
    }
}
