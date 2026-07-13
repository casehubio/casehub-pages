package io.casehub.pages.push;

public class EventBroadcaster {
    private final EventStore    eventStore;
    private final TopicRegistry topicRegistry;
    private final SessionSender sessionSender;
    private final JsonWriter    jsonWriter;

    public EventBroadcaster(EventStore eventStore,
                            TopicRegistry topicRegistry,
                            SessionSender sessionSender,
                            JsonWriter jsonWriter) {
        this.eventStore    = java.util.Objects.requireNonNull(eventStore);
        this.topicRegistry = java.util.Objects.requireNonNull(topicRegistry);
        this.sessionSender = java.util.Objects.requireNonNull(sessionSender);
        this.jsonWriter    = java.util.Objects.requireNonNull(jsonWriter);
    }

    public long broadcast(String topic, String payloadJson) {
        if (topic.contains("*")) {
            throw new IllegalArgumentException(
                    "broadcast topic must not contain wildcards: " + topic);
        }
        long   seq  = eventStore.append(topic, payloadJson);
        String wire = PushMessage.event(topic, payloadJson, seq);
        for (String connId : topicRegistry.connections(topic)) {
            try {
                sessionSender.send(connId, wire);
            } catch (Exception e) {
                // Connection likely closed between connections() snapshot and send.
                // Event is persisted in EventStore; replay delivers on reconnect.
            }
        }
        return seq;
    }

    public <T> long broadcast(String topic, T event) {
        String json;
        try {
            json = jsonWriter.toJson(event);
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Failed to serialize event for topic: " + topic, e);
        }
        return broadcast(topic, json);
    }
}
