package io.casehub.pages.push;

@FunctionalInterface
public interface SessionSender {
    void send(String connectionId, String message);
}
