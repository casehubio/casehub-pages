package io.casehub.pages.push.runtime;

import io.casehub.pages.push.SessionSender;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
@DefaultBean
public class WebSocketSessionSender implements SessionSender {

    private final ConnectionRegistry registry;

    @Inject
    public WebSocketSessionSender(ConnectionRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void send(String connectionId, String message) {
        var conn = registry.get(connectionId);
        if (conn != null) {
            conn.sendTextAndAwait(message);
        }
    }
}
