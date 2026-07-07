package io.casehub.pages.push;

public class EventBroadcaster {
    private final EventStore eventStore;
    private final TopicRegistry topicRegistry;
    private final SessionSender sessionSender;

    public EventBroadcaster(EventStore eventStore,
                            TopicRegistry topicRegistry,
                            SessionSender sessionSender) {
        this.eventStore = eventStore;
        this.topicRegistry = topicRegistry;
        this.sessionSender = sessionSender;
    }

    public long broadcast(String topic, String payloadJson) {
        if (topic.contains("*")) {
            throw new IllegalArgumentException(
                "broadcast topic must not contain wildcards: " + topic);
        }
        long seq = eventStore.append(topic, payloadJson);
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
}
