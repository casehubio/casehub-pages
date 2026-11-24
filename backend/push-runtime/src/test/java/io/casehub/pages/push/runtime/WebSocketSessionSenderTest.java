package io.casehub.pages.push.runtime;

import org.junit.jupiter.api.Test;


import static org.assertj.core.api.Assertions.assertThat;

class WebSocketSessionSenderTest {

    @Test
    void sendToUnknownConnectionIsNoOp() {
        var registry = new ConnectionRegistry();
        var sender = new WebSocketSessionSender(registry);
        // should not throw
        sender.send("nonexistent", "hello");
    }

    @Test
    void registryAddRemoveLifecycle() {
        var registry = new ConnectionRegistry();
        assertThat(registry.get("conn-1")).isNull();

        // We cannot easily create a real WebSocketConnection in a unit test,
        // but we can verify the map operations via add/remove/get null-safety
        registry.remove("conn-1"); // no-op on missing key
        assertThat(registry.get("conn-1")).isNull();
    }
}
