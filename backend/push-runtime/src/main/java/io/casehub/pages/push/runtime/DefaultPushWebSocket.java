package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.PushConnectionListener;
import io.casehub.pages.push.PushMessage;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.PushRequestHandler;
import io.casehub.pages.push.StoredEvent;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.arc.properties.UnlessBuildProperty;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.List;

@WebSocket(path = "/ws/push")
@UnlessBuildProperty(name = "casehub.push.custom-endpoint", stringValue = "true", enableIfMissing = true)
public class DefaultPushWebSocket {

    private final Iterable<PushRequestHandler> handlers;
    private final ConnectionRegistry registry;
    private final TopicRegistry topicRegistry;
    private final EventStore eventStore;
    private final Iterable<PushConnectionListener> listeners;

    @Inject
    public DefaultPushWebSocket(Instance<PushRequestHandler> handlers,
                                ConnectionRegistry registry,
                                TopicRegistry topicRegistry,
                                EventStore eventStore,
                                Instance<PushConnectionListener> listeners) {
        this.handlers = handlers;
        this.registry = registry;
        this.topicRegistry = topicRegistry;
        this.eventStore = eventStore;
        this.listeners = listeners;
    }

    DefaultPushWebSocket(List<PushRequestHandler> handlers,
                         ConnectionRegistry registry,
                         TopicRegistry topicRegistry,
                         EventStore eventStore,
                         List<PushConnectionListener> listeners) {
        this.handlers = handlers;
        this.registry = registry;
        this.topicRegistry = topicRegistry;
        this.eventStore = eventStore;
        this.listeners = listeners;
    }

    @OnOpen
    void onOpen(WebSocketConnection connection) {
        registry.add(connection.id(), connection);
        for (PushConnectionListener l : listeners) {
            l.onConnect(connection.id());
        }
    }

    @OnTextMessage
    void onMessage(WebSocketConnection connection, String message) {
        PushRequest request = PushRequest.parse(message);
        dispatch(connection, request);
    }

    @OnClose
    void onClose(WebSocketConnection connection) {
        topicRegistry.removeConnection(connection.id());
        for (PushConnectionListener l : listeners) {
            l.onDisconnect(connection.id());
        }
        registry.remove(connection.id());
    }

    private void dispatch(WebSocketConnection conn, PushRequest request) {
        switch (request) {
            case PushRequest.Listen listen -> handleListen(conn, listen);
            case PushRequest.Unlisten unlisten -> handleUnlisten(conn, unlisten);
            default -> delegateToHandlers(conn.id(), request);
        }
    }

    private void handleListen(WebSocketConnection conn, PushRequest.Listen listen) {
        topicRegistry.listen(conn.id(), listen.topics());

        List<String> gaps = new ArrayList<>();
        for (var entry : listen.since().entrySet()) {
            String topic = entry.getKey();
            long sinceSeq = entry.getValue();
            List<StoredEvent> replayed = eventStore.replay(topic, sinceSeq, 500);
            if (replayed.isEmpty() && sinceSeq > 0) {
                gaps.add(topic);
            }
            for (StoredEvent event : replayed) {
                conn.sendTextAndAwait(
                        PushMessage.event(event.topic(), event.payloadJson(), event.seq()));
            }
        }

        conn.sendTextAndAwait(PushMessage.ack(listen.id(), listen.topics(), gaps));
    }

    private void handleUnlisten(WebSocketConnection conn, PushRequest.Unlisten unlisten) {
        topicRegistry.unlisten(conn.id(), unlisten.topics());
    }

    private void delegateToHandlers(String connId, PushRequest request) {
        for (PushRequestHandler h : handlers) {
            if (h.handles(request)) {
                h.handle(connId, request);
                return;
            }
        }
    }
}
