package io.casehub.pages.push;

public interface PushRequestHandler {
    boolean handles(PushRequest request);
    void handle(String connectionId, PushRequest request);
}
