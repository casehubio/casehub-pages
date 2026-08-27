package io.casehub.pages.scenario.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Consumer;

public class ScenarioExecutorClient {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final String name;
    private final ActionRegistry actionRegistry;
    private final Consumer<String> sender;

    private final ReentrantLock lock = new ReentrantLock();
    private final Condition resumeCondition = lock.newCondition();
    private volatile boolean paused;
    private volatile int stepPermits;
    private volatile double speed = 1.0;
    private volatile String sessionId;

    private ScenarioExecutorClient(String name, ActionRegistry actionRegistry,
                                    Consumer<String> sender) {
        this.name = name;
        this.actionRegistry = actionRegistry;
        this.sender = sender;
    }

    public static ScenarioExecutorClient create(String name, List<Object> beans,
                                                  Consumer<String> sender) {
        var registry = ActionRegistry.scan(beans);
        var client = new ScenarioExecutorClient(name, registry, sender);
        client.sendRegister();
        return client;
    }

    public void onMessage(String message) {
        try {
            JsonNode root = JSON.readTree(message);
            String op = root.path("op").asText(null);

            switch (op) {
                case "dispatch-sequence" -> handleDispatch(root);
                case "executor-control" -> handleControl(root);
                default -> {}
            }
        } catch (IOException e) {
            // Malformed message — ignore
        }
    }

    private void handleDispatch(JsonNode root) {
        sessionId = root.path("sessionId").asText();
        speed = root.path("speed").asDouble(1.0);
        paused = root.path("paused").asBoolean(false);

        JsonNode stepsNode = root.get("steps");
        if (stepsNode == null || !stepsNode.isArray()) return;

        var steps = new ArrayList<JsonNode>();
        stepsNode.forEach(steps::add);

        Thread.ofVirtual().name("scenario-executor-" + name).start(() -> {
            for (int i = 0; i < steps.size(); i++) {
                waitIfPaused();
                executeStep(sessionId, steps.get(i));
                consumeStepPermit();

                if (i < steps.size() - 1 && !paused) {
                    sleepForSpeed();
                }
            }
        });
    }

    private void handleControl(JsonNode root) {
        String ctrlSessionId = root.path("sessionId").asText(null);
        if (sessionId != null && ctrlSessionId != null
                && !sessionId.equals(ctrlSessionId)) return;

        String command = root.path("command").asText("");
        switch (command) {
            case "pause" -> {
                paused = true;
            }
            case "resume" -> {
                lock.lock();
                try {
                    paused = false;
                    resumeCondition.signalAll();
                } finally {
                    lock.unlock();
                }
            }
            case "step" -> {
                lock.lock();
                try {
                    stepPermits++;
                    paused = false;
                    resumeCondition.signalAll();
                } finally {
                    lock.unlock();
                }
            }
            case "speed" -> {
                double newSpeed = root.path("speed").asDouble(1.0);
                speed = Math.max(0.01, newSpeed);
            }
        }
    }

    private void waitIfPaused() {
        lock.lock();
        try {
            while (paused && stepPermits <= 0) {
                resumeCondition.await(1, TimeUnit.SECONDS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            lock.unlock();
        }
    }

    private void consumeStepPermit() {
        lock.lock();
        try {
            if (stepPermits > 0) {
                stepPermits--;
                if (stepPermits <= 0) {
                    paused = true;
                }
            }
        } finally {
            lock.unlock();
        }
    }

    private void sleepForSpeed() {
        if (speed >= 1000) return;
        long delayMs = Math.max(10, (long) (1000 / speed));
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void executeStep(String sessionId, JsonNode stepNode) {
        String stepName = stepNode.path("name").asText("unknown");
        String actor = stepNode.path("actor").asText(null);
        JsonNode commandsNode = stepNode.get("commands");

        if (commandsNode == null || !commandsNode.isArray()) {
            sendStepResult(sessionId, stepName, true, null, Map.of());
            return;
        }

        Map<String, Object> lastResult = Map.of();
        for (JsonNode cmdNode : commandsNode) {
            String action = cmdNode.path("action").asText();
            String mode = cmdNode.path("mode").asText("single").toUpperCase();
            Map<String, Object> awaitMatch = Map.of();
            if (cmdNode.has("await") && cmdNode.get("await").has("match")) {
                awaitMatch = toMap(cmdNode.get("await").get("match"));
            }

            try {
                lastResult = switch (mode) {
                    case "BULK" -> executeBulk(action, actor, cmdNode, awaitMatch);
                    case "STEPPED" -> executeStepped(action, actor, cmdNode, awaitMatch);
                    case "STREAM" -> executeStream(action, actor, cmdNode, awaitMatch);
                    default -> executeSingle(action, actor, cmdNode, awaitMatch);
                };
            } catch (Exception e) {
                sendStepResult(sessionId, stepName, false, e.getMessage(), Map.of());
                return;
            }
        }

        sendStepResult(sessionId, stepName, true, null, lastResult);
    }

    private Map<String, Object> executeSingle(String action, String actor,
                                               JsonNode cmdNode,
                                               Map<String, Object> awaitMatch) throws Exception {
        Map<String, Object> data = cmdNode.has("data") ? toMap(cmdNode.get("data")) : Map.of();

        int timeoutMs = cmdNode.has("await") && cmdNode.get("await").has("timeout")
                ? cmdNode.get("await").get("timeout").asInt(5000) : 0;
        int intervalMs = cmdNode.has("await") && cmdNode.get("await").has("interval")
                ? cmdNode.get("await").get("interval").asInt(500) : 500;

        if (!awaitMatch.isEmpty() && timeoutMs > 0) {
            long deadline = System.currentTimeMillis() + timeoutMs;
            Exception lastError = null;
            while (System.currentTimeMillis() < deadline) {
                try {
                    var result = actionRegistry.invoke(action, ActionContext.of(actor, data, awaitMatch));
                    if (matchesAwait(result, awaitMatch)) return result;
                } catch (Exception e) {
                    lastError = e;
                }
                Thread.sleep(intervalMs);
            }
            if (lastError != null) throw lastError;
            throw new IllegalStateException("Await timed out after " + timeoutMs + "ms for " + action
                    + " — expected " + awaitMatch);
        }

        return actionRegistry.invoke(action, ActionContext.of(actor, data, awaitMatch));
    }

    private static boolean matchesAwait(Map<String, Object> result, Map<String, Object> awaitMatch) {
        for (var entry : awaitMatch.entrySet()) {
            Object actual = result.get(entry.getKey());
            if (actual == null || !actual.toString().equals(entry.getValue().toString())) return false;
        }
        return true;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeBulk(String action, String actor,
                                             JsonNode cmdNode,
                                             Map<String, Object> awaitMatch) throws Exception {
        List<Object> items = resolveItems(cmdNode);
        Map<String, Object> bulkData = Map.of("items", items, "mode", "bulk");
        return actionRegistry.invoke(action, ActionContext.of(actor, bulkData, awaitMatch));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeStepped(String action, String actor,
                                                JsonNode cmdNode,
                                                Map<String, Object> awaitMatch) throws Exception {
        List<Object> items = resolveItems(cmdNode);
        Map<String, Object> lastResult = Map.of();
        for (int i = 0; i < items.size(); i++) {
            waitIfPaused();
            Object item = items.get(i);
            Map<String, Object> itemData = item instanceof Map
                ? (Map<String, Object>) item
                : Map.of("value", item);
            itemData = new HashMap<>(itemData);
            itemData.put("_index", i);
            itemData.put("_total", items.size());
            lastResult = actionRegistry.invoke(action, ActionContext.of(actor, itemData, awaitMatch));
            if (i < items.size() - 1) {
                sleepForSpeed();
            }
        }
        return lastResult;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeStream(String action, String actor,
                                               JsonNode cmdNode,
                                               Map<String, Object> awaitMatch) throws Exception {
        List<Object> items = resolveItems(cmdNode);
        int intervalMs = cmdNode.path("interval").asInt(1000);
        Map<String, Object> lastResult = Map.of();
        for (int i = 0; i < items.size(); i++) {
            waitIfPaused();
            Object item = items.get(i);
            Map<String, Object> itemData = item instanceof Map
                ? (Map<String, Object>) item
                : Map.of("value", item);
            itemData = new HashMap<>(itemData);
            itemData.put("_index", i);
            itemData.put("_total", items.size());
            lastResult = actionRegistry.invoke(action, ActionContext.of(actor, itemData, awaitMatch));
            if (i < items.size() - 1) {
                try { Thread.sleep(intervalMs); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); break;
                }
            }
        }
        return lastResult;
    }

    @SuppressWarnings("unchecked")
    private List<Object> resolveItems(JsonNode cmdNode) {
        if (cmdNode.has("data")) {
            JsonNode dataNode = cmdNode.get("data");
            if (dataNode.isArray()) {
                return JSON.convertValue(dataNode, List.class);
            }
            Object items = toMap(dataNode).get("items");
            if (items instanceof List<?> list) {
                return (List<Object>) list;
            }
        }
        return List.of();
    }

    private void sendRegister() {
        try {
            var msg = new HashMap<String, Object>();
            msg.put("op", "executor-register");
            msg.put("id", UUID.randomUUID().toString());
            msg.put("name", name);
            msg.put("actions", new ArrayList<>(actionRegistry.actions()));
            sender.accept(JSON.writeValueAsString(msg));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize register message", e);
        }
    }

    private void sendStepResult(String sessionId, String stepName,
                                 boolean ok, String error,
                                 Map<String, Object> result) {
        try {
            var msg = new HashMap<String, Object>();
            msg.put("op", "step-result");
            msg.put("id", UUID.randomUUID().toString());
            msg.put("sessionId", sessionId);
            msg.put("stepName", stepName);
            msg.put("ok", ok);
            if (error != null) msg.put("error", error);
            if (result != null && !result.isEmpty()) msg.put("result", result);
            sender.accept(JSON.writeValueAsString(msg));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize step result", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> toMap(JsonNode node) {
        return JSON.convertValue(node, Map.class);
    }
}
