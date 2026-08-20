package io.casehub.pages.push;

@FunctionalInterface
public interface CommandResultHandler {
    void handle(PushRequest.CommandResult result);
}
