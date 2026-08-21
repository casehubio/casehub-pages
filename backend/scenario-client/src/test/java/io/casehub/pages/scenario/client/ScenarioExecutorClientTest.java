package io.casehub.pages.scenario.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.push.PushMessage;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ScenarioExecutorClientTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static class TestActions {
        final List<String> invoked = new ArrayList<>();

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

    @Test
    void executesSequenceAndSendsStepResults() throws Exception {
        var actions = new TestActions();
        var sent = new ArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk", List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "create", "label", "Create ticket",
                "commands", List.of(Map.of("action", "create-ticket",
                    "data", Map.of("subject", "Laptop broken")))),
            Map.of("name", "verify", "label", "Verify ticket",
                "commands", List.of(Map.of("action", "verify-ticket")))
        ));

        String dispatch = PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false);

        client.onMessage(dispatch);

        assertThat(actions.invoked).containsExactly(
            "create-ticket:Laptop broken", "verify-ticket");

        var stepResults = sent.stream()
            .filter(s -> s.contains("step-result"))
            .toList();
        assertThat(stepResults).hasSize(2);
        assertThat(stepResults.get(0)).contains("\"ok\":true")
            .contains("\"stepName\":\"create\"");
        assertThat(stepResults.get(1)).contains("\"ok\":true")
            .contains("\"stepName\":\"verify\"");
    }

    @Test
    void sendsExecutorRegister() {
        var sent = new ArrayList<String>();
        ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        assertThat(sent).hasSize(1);
        assertThat(sent.getFirst()).contains("executor-register")
            .contains("helpdesk")
            .contains("create-ticket");
    }

    @Test
    void handlesFailingAction() throws Exception {
        var sent = new ArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "fail", "label", "Will fail",
                "commands", List.of(Map.of("action", "fail-action")))
        ));

        String dispatch = PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false);

        client.onMessage(dispatch);

        var stepResults = sent.stream()
            .filter(s -> s.contains("step-result"))
            .toList();
        assertThat(stepResults).hasSize(1);
        assertThat(stepResults.getFirst()).contains("\"ok\":false")
            .contains("Simulated failure");
    }

    @Test
    void handlesMultipleCommandsInOneStep() throws Exception {
        var actions = new TestActions();
        var sent = new ArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(actions), sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "both", "label", "Create and verify",
                "commands", List.of(
                    Map.of("action", "create-ticket",
                        "data", Map.of("subject", "Test")),
                    Map.of("action", "verify-ticket")))
        ));

        String dispatch = PushMessage.dispatchSequence("s-001", "helpdesk",
            stepsJson, 1000.0, false);

        client.onMessage(dispatch);

        assertThat(actions.invoked).containsExactly(
            "create-ticket:Test", "verify-ticket");

        var stepResults = sent.stream()
            .filter(s -> s.contains("step-result"))
            .toList();
        assertThat(stepResults).hasSize(1);
    }

    @Test
    void ignoresNonDispatchMessages() {
        var sent = new ArrayList<String>();
        var client = ScenarioExecutorClient.create("helpdesk",
            List.of(new TestActions()), sent::add);

        sent.clear();
        client.onMessage("{\"op\":\"event\",\"topic\":\"some:topic\",\"payload\":{}}");

        var stepResults = sent.stream()
            .filter(s -> s.contains("step-result"))
            .toList();
        assertThat(stepResults).isEmpty();
    }

    @Test
    void passesActorToActionContext() throws Exception {
        var actors = new ArrayList<String>();
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("check-actor")
            Map<String, Object> checkActor(ActionContext ctx) {
                actors.add(ctx.actor());
                return Map.of();
            }
        });

        var sent = new ArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "s1", "label", "Check",
                "actor", "hw-specialist",
                "commands", List.of(Map.of("action", "check-actor")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-001", "test",
            stepsJson, 1000.0, false));

        assertThat(actors).containsExactly("hw-specialist");
    }
}
