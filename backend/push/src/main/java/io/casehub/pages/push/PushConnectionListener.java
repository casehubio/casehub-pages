package io.casehub.pages.push;

public interface PushConnectionListener {
    default void onConnect(String connectionId) {}
    default void onDisconnect(String connectionId) {}
}
