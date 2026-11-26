package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushConnectionListener;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.PushRequestHandler;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.websockets.next.WebSocketConnection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DefaultPushWebSocketTest {

    private ConnectionRegistry registry;
    private TopicRegistry topicRegistry;
    private EventStore eventStore;
    private List<String> handledOps;
    private List<String> listenerEvents;
    private DefaultPushWebSocket endpoint;

    @BeforeEach
    void setUp() {
        registry = new ConnectionRegistry();
        topicRegistry = new TopicRegistry();
        eventStore = new InMemoryEventStore(100);
        handledOps = new ArrayList<>();
        listenerEvents = new ArrayList<>();

        PushRequestHandler testHandler = new PushRequestHandler() {
            @Override
            public boolean handles(PushRequest request) {
                return request instanceof PushRequest.Subscribe;
            }

            @Override
            public void handle(String connectionId, PushRequest request) {
                handledOps.add(request.op());
            }
        };

        PushConnectionListener testListener = new PushConnectionListener() {
            @Override
            public void onConnect(String connectionId) {
                listenerEvents.add("connect:" + connectionId);
            }

            @Override
            public void onDisconnect(String connectionId) {
                listenerEvents.add("disconnect:" + connectionId);
            }
        };

        endpoint = new DefaultPushWebSocket(
                List.of(testHandler), registry, topicRegistry,
                eventStore, List.of(testListener));
    }

    @Test
    void onOpen_registers_connection_and_notifies_listeners() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);
        assertThat(registry.get("c1")).isSameAs(conn);
        assertThat(listenerEvents).containsExactly("connect:c1");
    }

    @Test
    void onClose_removes_connection_and_notifies_listeners() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);
        listenerEvents.clear();

        endpoint.onClose(conn);

        assertThat(registry.get("c1")).isNull();
        assertThat(listenerEvents).containsExactly("disconnect:c1");
    }

    @Test
    void listen_request_is_handled_directly() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);

        String msg = "{\"op\":\"listen\",\"id\":\"r1\",\"topics\":[\"t1\"]}";
        endpoint.onMessage(conn, msg);

        assertThat(topicRegistry.connections("t1")).contains("c1");
    }

    @Test
    void unlisten_request_is_handled_directly() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);
        topicRegistry.listen("c1", List.of("t1"));

        String msg = "{\"op\":\"unlisten\",\"id\":\"r1\",\"topics\":[\"t1\"]}";
        endpoint.onMessage(conn, msg);

        assertThat(topicRegistry.connections("t1")).isEmpty();
    }

    @Test
    void unknown_request_delegates_to_handler_chain() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);

        String msg = "{\"op\":\"subscribe\",\"id\":\"r1\",\"dataset\":\"events\"}";
        endpoint.onMessage(conn, msg);

        assertThat(handledOps).containsExactly("subscribe");
    }

    @Test
    void unhandled_request_is_silently_ignored() {
        WebSocketConnection conn = stubConnection("c1");
        endpoint.onOpen(conn);

        String msg = "{\"op\":\"command-result\",\"id\":\"r1\",\"ok\":true}";
        endpoint.onMessage(conn, msg);

        assertThat(handledOps).isEmpty();
    }

    private static WebSocketConnection stubConnection(String id) {
        return (WebSocketConnection) Proxy.newProxyInstance(
                WebSocketConnection.class.getClassLoader(),
                new Class<?>[]{WebSocketConnection.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "id" -> id;
                    case "sendTextAndAwait" -> null;
                    case "toString" -> "StubConnection[" + id + "]";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }
}
