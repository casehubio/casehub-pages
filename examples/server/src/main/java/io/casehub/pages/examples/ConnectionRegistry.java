package io.casehub.pages.examples;

import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class ConnectionRegistry {
    private final ConcurrentHashMap<String, WebSocketConnection> connections = new ConcurrentHashMap<>();

    public void add(String id, WebSocketConnection connection) {
        connections.put(id, connection);
    }

    public void remove(String id) {
        connections.remove(id);
    }

    public WebSocketConnection get(String id) {
        return connections.get(id);
    }
}
