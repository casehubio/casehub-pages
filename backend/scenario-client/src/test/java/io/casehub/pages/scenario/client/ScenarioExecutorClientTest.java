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

    @Test
    void bulkModePassesAllItemsAtOnce() throws Exception {
        var received = new CopyOnWriteArrayList<Map<String, Object>>();
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("ingest")
            Map<String, Object> ingest(ActionContext ctx) {
                received.add(ctx.dataMap());
                return Map.of("count", received.size());
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "bulk-step", "label", "Bulk ingest",
                "commands", List.of(Map.of(
                    "action", "ingest",
                    "mode", "bulk",
                    "data", List.of(
                        Map.of("id", 1, "name", "Alice"),
                        Map.of("id", 2, "name", "Bob")))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-bulk", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(received).hasSize(1);
        assertThat(received.getFirst()).containsKey("items");
    }

    @Test
    void steppedModeInvokesPerItem() throws Exception {
        var received = new CopyOnWriteArrayList<Map<String, Object>>();
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("process")
            Map<String, Object> process(ActionContext ctx) {
                received.add(new java.util.HashMap<>(ctx.dataMap()));
                return Map.of();
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "stepped-step", "label", "Stepped",
                "commands", List.of(Map.of(
                    "action", "process",
                    "mode", "stepped",
                    "data", List.of(
                        Map.of("ticket", "T-001"),
                        Map.of("ticket", "T-002"),
                        Map.of("ticket", "T-003")))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-stepped", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(received).hasSize(3);
        assertThat(received.get(0)).containsEntry("ticket", "T-001");
        assertThat(received.get(1)).containsEntry("ticket", "T-002");
        assertThat(received.get(2)).containsEntry("ticket", "T-003");
        assertThat(received.get(0)).containsEntry("_index", 0);
        assertThat(received.get(2)).containsEntry("_total", 3);
    }

    @Test
    void awaitPollsUntilMatchSucceeds() throws Exception {
        var callCount = new java.util.concurrent.atomic.AtomicInteger(0);
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("poll-action")
            Map<String, Object> pollAction(ActionContext ctx) {
                int n = callCount.incrementAndGet();
                return n >= 3
                    ? Map.of("status", "TRIAGED", "category", "HARDWARE")
                    : Map.of("status", "OPEN");
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "poll-step", "label", "Poll",
                "commands", List.of(Map.of(
                    "action", "poll-action",
                    "await", Map.of(
                        "match", Map.of("status", "TRIAGED", "category", "HARDWARE"),
                        "timeout", 5000,
                        "interval", 100))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-poll", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(callCount.get()).isGreaterThanOrEqualTo(3);
        assertThat(stepResults(sent).getFirst()).contains("\"ok\":true");
    }

    @Test
    void awaitTimesOutWhenMatchNeverSucceeds() throws Exception {
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("never-match")
            Map<String, Object> neverMatch(ActionContext ctx) {
                return Map.of("status", "OPEN");
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "timeout-step", "label", "Timeout",
                "commands", List.of(Map.of(
                    "action", "never-match",
                    "await", Map.of(
                        "match", Map.of("status", "TRIAGED"),
                        "timeout", 500,
                        "interval", 100))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-timeout", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(stepResults(sent).getFirst()).contains("\"ok\":false")
            .contains("Await timed out");
    }

    @Test
    void awaitRetriesAfterActionThrows() throws Exception {
        var callCount = new java.util.concurrent.atomic.AtomicInteger(0);
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("flaky-action")
            Map<String, Object> flakyAction(ActionContext ctx) {
                int n = callCount.incrementAndGet();
                if (n < 3) throw new RuntimeException("Not ready yet");
                return Map.of("ready", "true");
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "flaky-step", "label", "Flaky",
                "commands", List.of(Map.of(
                    "action", "flaky-action",
                    "await", Map.of(
                        "match", Map.of("ready", "true"),
                        "timeout", 5000,
                        "interval", 100))))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-flaky", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(callCount.get()).isGreaterThanOrEqualTo(3);
        assertThat(stepResults(sent).getFirst()).contains("\"ok\":true");
    }

    @Test
    void noAwaitExecutesSingleShot() throws Exception {
        var callCount = new java.util.concurrent.atomic.AtomicInteger(0);
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("single-shot")
            Map<String, Object> singleShot(ActionContext ctx) {
                callCount.incrementAndGet();
                return Map.of("done", "true");
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "single", "label", "Single",
                "commands", List.of(Map.of("action", "single-shot")))
        ));

        client.onMessage(PushMessage.dispatchSequence("s-single", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        assertThat(callCount.get()).isEqualTo(1);
    }

    @Test
    void streamModeEmitsAtInterval() throws Exception {
        var received = new CopyOnWriteArrayList<Map<String, Object>>();
        var beans = List.<Object>of(new Object() {
            @ScenarioAction("emit")
            Map<String, Object> emit(ActionContext ctx) {
                received.add(new java.util.HashMap<>(ctx.dataMap()));
                return Map.of();
            }
        });

        var sent = new CopyOnWriteArrayList<String>();
        var client = ScenarioExecutorClient.create("test", beans, sent::add);

        String stepsJson = JSON.writeValueAsString(List.of(
            Map.of("name", "stream-step", "label", "Stream",
                "commands", List.of(Map.of(
                    "action", "emit",
                    "mode", "stream",
                    "interval", 100,
                    "data", List.of(
                        Map.of("event", "A"),
                        Map.of("event", "B")))))
        ));

        long start = System.currentTimeMillis();
        client.onMessage(PushMessage.dispatchSequence("s-stream", "test",
            stepsJson, 1000.0, false));

        awaitStepResults(sent, 1);
        long elapsed = System.currentTimeMillis() - start;

        assertThat(received).hasSize(2);
        assertThat(elapsed).isGreaterThanOrEqualTo(80);
    }
}
