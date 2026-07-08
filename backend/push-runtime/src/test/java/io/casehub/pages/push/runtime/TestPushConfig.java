package io.casehub.pages.push.runtime;

import io.casehub.pages.push.SessionSender;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@ApplicationScoped
public class TestPushConfig {

    private final List<SentMessage> sent = new CopyOnWriteArrayList<>();

    @Produces
    @ApplicationScoped
    SessionSender sessionSender() {
        return (connectionId, message) -> sent.add(new SentMessage(connectionId, message));
    }

    public List<SentMessage> sent() {
        return List.copyOf(sent);
    }

    public void clear() {
        sent.clear();
    }

    public record SentMessage(String connectionId, String message) {}
}
