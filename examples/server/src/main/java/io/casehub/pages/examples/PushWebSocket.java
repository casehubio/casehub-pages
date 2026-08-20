package io.casehub.pages.examples;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.PushMessage;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.StoredEvent;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;

@WebSocket(path = "/ws/push")
public class PushWebSocket {
    @Inject TopicRegistry topicRegistry;
    @Inject EventStore eventStore;
    @Inject ConnectionRegistry connectionRegistry;
    @Inject DatasetRegistry datasetRegistry;

    @OnOpen
    void onOpen(WebSocketConnection connection) {
        connectionRegistry.add(connection.id(), connection);
    }

    @OnTextMessage
    void onMessage(WebSocketConnection connection, String message) {
        PushRequest request = PushRequest.parse(message);
        switch (request) {
            case PushRequest.Listen listen -> handleListen(connection, listen);
            case PushRequest.Unlisten unlisten -> handleUnlisten(connection, unlisten);
            case PushRequest.Subscribe subscribe -> handleSubscribe(connection, subscribe);
            case PushRequest.Unsubscribe unsubscribe -> handleUnsubscribe(connection, unsubscribe);
            default -> { }
        }
    }

    @OnClose
    void onClose(WebSocketConnection connection) {
        topicRegistry.removeConnection(connection.id());
        datasetRegistry.removeConnection(connection.id());
        connectionRegistry.remove(connection.id());
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

    private void handleSubscribe(WebSocketConnection conn, PushRequest.Subscribe subscribe) {
        datasetRegistry.subscribe(conn.id(), subscribe.dataset());
        conn.sendTextAndAwait(PushMessage.ack(subscribe.id()));
    }

    private void handleUnsubscribe(WebSocketConnection conn, PushRequest.Unsubscribe unsubscribe) {
        datasetRegistry.unsubscribe(conn.id(), unsubscribe.dataset());
    }
}
