package io.casehub.pages.scenario.client;

import java.util.Map;
import java.util.Objects;

public interface ActionContext {

    String actor();

    String data(String key);

    @SuppressWarnings("unchecked")
    default <T> T data(String key, Class<T> type) {
        Object val = dataMap().get(key);
        if (val == null) return null;
        if (type.isInstance(val)) return (T) val;
        if (type == String.class) return type.cast(val.toString());
        throw new ClassCastException("Cannot cast " + val.getClass() + " to " + type);
    }

    Map<String, Object> dataMap();

    String awaitMatch(String key);

    Map<String, Object> awaitMatchMap();

    static ActionContext of(String actor, Map<String, Object> data, Map<String, Object> awaitMatch) {
        Objects.requireNonNull(data, "data");
        return new ActionContext() {
            @Override public String actor() { return actor; }
            @Override public String data(String key) {
                Object val = data.get(key);
                return val != null ? val.toString() : null;
            }
            @Override public Map<String, Object> dataMap() { return data; }
            @Override public String awaitMatch(String key) {
                Object val = awaitMatch.get(key);
                return val != null ? val.toString() : null;
            }
            @Override public Map<String, Object> awaitMatchMap() { return awaitMatch; }
        };
    }
}
