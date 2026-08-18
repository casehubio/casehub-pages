package io.casehub.pages.scenario;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ScenarioParser {

    private static final Set<String> KNOWN_ACTIONS =
        Set.of("navigate", "click", "fill", "select", "expand", "collapse", "assert", "wait");

    private static final JsonFactory YAML_FACTORY = new YAMLFactory();

    private ScenarioParser() {}

    public static Scenario parse(String yaml) {
        try (JsonParser p = YAML_FACTORY.createParser(yaml)) {
            return parseRoot(p);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to parse scenario YAML: " + e.getMessage(), e);
        }
    }

    private static Scenario parseRoot(JsonParser p) throws IOException {
        expect(p, JsonToken.START_OBJECT);
        String name = null;
        List<ScenarioStep> steps = null;

        while (p.nextToken() != JsonToken.END_OBJECT) {
            String field = p.currentName();
            p.nextToken();
            switch (field) {
                case "scenario" -> name = p.getText();
                case "steps" -> steps = parseSteps(p);
                default -> p.skipChildren();
            }
        }

        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Missing or empty 'scenario' name");
        }
        if (steps == null) {
            throw new IllegalArgumentException("Missing 'steps' array");
        }
        return new Scenario(name, steps);
    }

    private static List<ScenarioStep> parseSteps(JsonParser p) throws IOException {
        if (p.currentToken() != JsonToken.START_ARRAY) {
            throw new IllegalArgumentException("'steps' must be an array");
        }
        List<ScenarioStep> steps = new ArrayList<>();
        while (p.nextToken() != JsonToken.END_ARRAY) {
            steps.add(parseStep(p));
        }
        return steps;
    }

    private static ScenarioStep parseStep(JsonParser p) throws IOException {
        if (p.currentToken() != JsonToken.START_OBJECT) {
            throw new IllegalArgumentException("Each step must be an object");
        }

        p.nextToken();
        String action = p.currentName();
        p.nextToken();

        if (!KNOWN_ACTIONS.contains(action)) {
            throw new IllegalArgumentException("Unknown action: " + action);
        }

        ScenarioStep step;
        if ("navigate".equals(action)) {
            step = new ScenarioStep(action, null, p.getText(), null, null);
        } else {
            step = parseTargetedStep(action, p);
        }

        while (p.nextToken() != JsonToken.END_OBJECT) {
            p.skipChildren();
        }
        return step;
    }

    private static ScenarioStep parseTargetedStep(String action, JsonParser p) throws IOException {
        if (p.currentToken() != JsonToken.START_OBJECT) {
            throw new IllegalArgumentException(action + " step must have an object body");
        }

        String role = null;
        String name = null;
        AriaTarget within = null;
        String value = null;
        Map<String, Object> state = null;
        Integer timeout = null;

        while (p.nextToken() != JsonToken.END_OBJECT) {
            String field = p.currentName();
            p.nextToken();
            switch (field) {
                case "role" -> role = p.getText();
                case "name" -> name = p.getText();
                case "within" -> within = parseAriaTarget(p);
                case "value" -> value = p.getText();
                case "state" -> state = parseState(p);
                case "timeout" -> timeout = p.getIntValue();
                default -> p.skipChildren();
            }
        }

        AriaTarget target = (role != null && name != null) ? new AriaTarget(role, name, within) : null;
        return new ScenarioStep(action, target, value, state, timeout);
    }

    private static AriaTarget parseAriaTarget(JsonParser p) throws IOException {
        if (p.currentToken() != JsonToken.START_OBJECT) {
            throw new IllegalArgumentException("AriaTarget must be an object");
        }
        String role = null;
        String name = null;
        AriaTarget within = null;

        while (p.nextToken() != JsonToken.END_OBJECT) {
            String field = p.currentName();
            p.nextToken();
            switch (field) {
                case "role" -> role = p.getText();
                case "name" -> name = p.getText();
                case "within" -> within = parseAriaTarget(p);
                default -> p.skipChildren();
            }
        }

        if (role == null || name == null) {
            throw new IllegalArgumentException("AriaTarget requires 'role' and 'name'");
        }
        return new AriaTarget(role, name, within);
    }

    private static Map<String, Object> parseState(JsonParser p) throws IOException {
        if (p.currentToken() != JsonToken.START_OBJECT) {
            throw new IllegalArgumentException("'state' must be an object");
        }
        Map<String, Object> state = new HashMap<>();
        while (p.nextToken() != JsonToken.END_OBJECT) {
            String key = p.currentName();
            p.nextToken();
            state.put(key, readScalar(p));
        }
        return state;
    }

    private static Object readScalar(JsonParser p) throws IOException {
        return switch (p.currentToken()) {
            case VALUE_STRING -> p.getText();
            case VALUE_NUMBER_INT -> p.getIntValue();
            case VALUE_NUMBER_FLOAT -> p.getDoubleValue();
            case VALUE_TRUE -> true;
            case VALUE_FALSE -> false;
            case VALUE_NULL -> null;
            default -> throw new IllegalArgumentException("State values must be scalars, got: " + p.currentToken());
        };
    }

    private static void expect(JsonParser p, JsonToken expected) throws IOException {
        JsonToken token = p.nextToken();
        if (token != expected) {
            throw new IllegalArgumentException("Expected " + expected + " but got " + token);
        }
    }
}
