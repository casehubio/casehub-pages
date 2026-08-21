package io.casehub.pages.scenario.client;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

public class ScenarioExecutorClient {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final JsonFactory JSON_FACTORY = new JsonFactory();

    private final String name;
    private final ActionRegistry actionRegistry;
    private final Consumer<String> sender;

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
            if (!"dispatch-sequence".equals(op)) return;

            String sessionId = root.path("sessionId").asText();
            JsonNode stepsNode = root.get("steps");
            if (stepsNode == null || !stepsNode.isArray()) return;

            for (JsonNode stepNode : stepsNode) {
                executeStep(sessionId, stepNode);
            }
        } catch (IOException e) {
            // Malformed message — ignore
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
            Map<String, Object> data = cmdNode.has("data")
                ? toMap(cmdNode.get("data")) : Map.of();
            Map<String, Object> awaitMatch = Map.of();
            if (cmdNode.has("await") && cmdNode.get("await").has("match")) {
                awaitMatch = toMap(cmdNode.get("await").get("match"));
            }

            var ctx = ActionContext.of(actor, data, awaitMatch);

            try {
                lastResult = actionRegistry.invoke(action, ctx);
            } catch (Exception e) {
                sendStepResult(sessionId, stepName, false, e.getMessage(), Map.of());
                return;
            }
        }

        sendStepResult(sessionId, stepName, true, null, lastResult);
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
