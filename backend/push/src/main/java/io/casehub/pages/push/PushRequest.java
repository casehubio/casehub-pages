package io.casehub.pages.push;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public sealed interface PushRequest {

    String op();
    String id();

    record Subscribe(String id, String dataset, String since) implements PushRequest {
        public Subscribe {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(dataset, "dataset");
        }
        public String op() { return "subscribe"; }
    }

    record Unsubscribe(String id, String dataset) implements PushRequest {
        public Unsubscribe {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(dataset, "dataset");
        }
        public String op() { return "unsubscribe"; }
    }

    record Listen(String id, List<String> topics, Map<String, Long> since) implements PushRequest {
        public Listen {
            Objects.requireNonNull(id, "id");
            topics = topics != null ? List.copyOf(topics) : List.of();
            since = since != null ? Map.copyOf(since) : Map.of();
        }
        public String op() { return "listen"; }
    }

    record Unlisten(String id, List<String> topics) implements PushRequest {
        public Unlisten {
            Objects.requireNonNull(id, "id");
            topics = topics != null ? List.copyOf(topics) : List.of();
        }
        public String op() { return "unlisten"; }
    }

    record CommandResult(String id, boolean ok, String error,
                         Map<String, Object> result) implements PushRequest {
        public CommandResult(String id, boolean ok, String error) {
            this(id, ok, error, null);
        }
        public CommandResult {
            Objects.requireNonNull(id, "id");
        }
        public String op() { return "command-result"; }
    }

    record ExecutorRegister(String id, String name,
                            List<String> actions) implements PushRequest {
        public ExecutorRegister {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(name, "name");
            actions = actions != null ? List.copyOf(actions) : List.of();
        }

        public String op() {return "executor-register";}
    }

    record StepResult(String id, String sessionId, String stepName,
                      boolean ok, String error,
                      Map<String, Object> result) implements PushRequest {
        public StepResult {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(sessionId, "sessionId");
            Objects.requireNonNull(stepName, "stepName");
        }

        public String op() {return "step-result";}
    }


    static PushRequest parse(String json) {
        JsonFactory factory = new JsonFactory();
        try (JsonParser p = factory.createParser(json)) {
            if (p.nextToken() != JsonToken.START_OBJECT) {
                throw new IllegalArgumentException("Expected JSON object");
            }
            String              op          = null;
            String              id          = null;
            String              dataset     = null;
            String              stringSince = null;
            Map<String, Long>   mapSince    = null;
            List<String>        topics      = null;
            Boolean             ok          = null;
            String              error       = null;
            Map<String, Object> result      = null;
            String              name        = null;
            List<String>        actions     = null;
            String              sessionId   = null;
            String              stepName    = null;

            while (p.nextToken() != JsonToken.END_OBJECT) {
                String field = p.currentName();
                p.nextToken();
                switch (field) {
                    case "op" -> op = p.getText();
                    case "id" -> id = p.getText();
                    case "dataset" -> dataset = p.getText();
                    case "since" -> {
                        if (p.currentToken() == JsonToken.VALUE_STRING) {
                            stringSince = p.getText();
                        } else if (p.currentToken() == JsonToken.START_OBJECT) {
                            mapSince = new HashMap<>();
                            while (p.nextToken() != JsonToken.END_OBJECT) {
                                String key = p.currentName();
                                p.nextToken();
                                mapSince.put(key, p.getLongValue());
                            }
                        } else {
                            p.skipChildren();
                        }
                    }
                    case "topics" -> {
                        topics = new ArrayList<>();
                        while (p.nextToken() != JsonToken.END_ARRAY) {
                            if (p.currentToken() == JsonToken.VALUE_NULL) {
                                throw new IllegalArgumentException("topic must not be null");
                            }
                            topics.add(p.getText());
                        }
                    }
                    case "ok" -> ok = p.getBooleanValue();
                    case "error" -> error = p.getText();
                    case "result" -> {
                        if (p.currentToken() == JsonToken.START_OBJECT) {
                            result = new HashMap<>();
                            while (p.nextToken() != JsonToken.END_OBJECT) {
                                String rKey = p.currentName();
                                p.nextToken();
                                result.put(rKey, p.currentToken() == JsonToken.VALUE_NULL ? null : p.getText());
                            }
                        } else {
                            p.skipChildren();
                        }
                    }
                    case "name" -> name = p.getText();
                    case "actions" -> {
                        actions = new ArrayList<>();
                        while (p.nextToken() != JsonToken.END_ARRAY) {
                            actions.add(p.getText());
                        }
                    }
                    case "sessionId" -> sessionId = p.getText();
                    case "stepName" -> stepName = p.getText();
                    default -> p.skipChildren();
                }
            }

            if (op == null) {
                throw new IllegalArgumentException("Missing 'op' field");
            }
            if (id == null) {
                throw new IllegalArgumentException("Missing 'id' field");
            }

            return switch (op) {
                case "subscribe" -> new Subscribe(id, dataset, stringSince);
                case "unsubscribe" -> new Unsubscribe(id, dataset);
                case "listen" -> new Listen(id, topics != null ? List.copyOf(topics) : List.of(), mapSince);
                case "unlisten" -> new Unlisten(id, topics != null ? List.copyOf(topics) : List.of());
                case "command-result" -> new CommandResult(id, ok != null && ok, error, result);
                case "executor-register" -> new ExecutorRegister(id, name, actions);
                case "step-result" -> new StepResult(id, sessionId, stepName, ok != null && ok, error, result);
                default -> throw new IllegalArgumentException("Unknown op: " + op);
            };
        } catch (IOException e) {
            throw new IllegalArgumentException("Malformed JSON: " + e.getMessage(), e);
        }}
}
