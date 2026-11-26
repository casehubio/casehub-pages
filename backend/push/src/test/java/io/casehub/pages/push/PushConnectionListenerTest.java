package io.casehub.pages.push;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PushConnectionListenerTest {

    @Test
    void default_methods_are_no_ops() {
        PushConnectionListener listener = new PushConnectionListener() {};
        listener.onConnect("conn-1");
        listener.onDisconnect("conn-1");
    }

    @Test
    void implementation_receives_callbacks() {
        List<String> events = new ArrayList<>();
        PushConnectionListener listener = new PushConnectionListener() {
            @Override
            public void onConnect(String connectionId) {
                events.add("connect:" + connectionId);
            }

            @Override
            public void onDisconnect(String connectionId) {
                events.add("disconnect:" + connectionId);
            }
        };

        listener.onConnect("conn-1");
        listener.onDisconnect("conn-1");

        assertThat(events).containsExactly("connect:conn-1", "disconnect:conn-1");
    }
}
