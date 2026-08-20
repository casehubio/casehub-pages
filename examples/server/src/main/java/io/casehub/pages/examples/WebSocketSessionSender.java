package io.casehub.pages.examples;

import io.casehub.pages.push.SessionSender;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class WebSocketSessionSender implements SessionSender {
    @Inject ConnectionRegistry registry;

    @Override
    public void send(String connectionId, String message) {
        var conn = registry.get(connectionId);
        if (conn != null) {
            conn.sendTextAndAwait(message);
        }
    }
}
