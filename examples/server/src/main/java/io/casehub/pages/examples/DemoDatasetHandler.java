package io.casehub.pages.examples;

import io.casehub.pages.push.PushMessage;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.PushRequestHandler;
import io.casehub.pages.push.runtime.ConnectionRegistry;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class DemoDatasetHandler implements PushRequestHandler {

    private final DatasetRegistry datasetRegistry;
    private final DemoEventGenerator eventGenerator;
    private final ConnectionRegistry connectionRegistry;

    @Inject
    public DemoDatasetHandler(DatasetRegistry datasetRegistry,
                              DemoEventGenerator eventGenerator,
                              ConnectionRegistry connectionRegistry) {
        this.datasetRegistry = datasetRegistry;
        this.eventGenerator = eventGenerator;
        this.connectionRegistry = connectionRegistry;
    }

    @Override
    public boolean handles(PushRequest request) {
        return request instanceof PushRequest.Subscribe
                || request instanceof PushRequest.Unsubscribe;
    }

    @Override
    public void handle(String connectionId, PushRequest request) {
        switch (request) {
            case PushRequest.Subscribe subscribe -> {
                datasetRegistry.subscribe(connectionId, subscribe.dataset());
                if (connectionRegistry != null) {
                    WebSocketConnection conn = connectionRegistry.get(connectionId);
                    if (conn != null) {
                        conn.sendTextAndAwait(PushMessage.ack(subscribe.id()));
                        if (eventGenerator != null) {
                            String snapshot = eventGenerator.initialSnapshot(subscribe.dataset());
                            if (snapshot != null) {
                                conn.sendTextAndAwait(snapshot);
                            }
                        }
                    }
                }
            }
            case PushRequest.Unsubscribe unsubscribe ->
                    datasetRegistry.unsubscribe(connectionId, unsubscribe.dataset());
            default ->
                    throw new IllegalArgumentException("Unhandled op: " + request.op());
        }
    }
}
