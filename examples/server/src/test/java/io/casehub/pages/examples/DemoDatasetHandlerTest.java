package io.casehub.pages.examples;

import io.casehub.pages.push.PushRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DemoDatasetHandlerTest {

    private DatasetRegistry datasetRegistry;
    private DemoDatasetHandler handler;

    @BeforeEach
    void setUp() {
        datasetRegistry = new DatasetRegistry();
        handler = new DemoDatasetHandler(datasetRegistry, null, null);
    }

    @Test
    void handles_subscribe_and_unsubscribe() {
        assertTrue(handler.handles(
                new PushRequest.Subscribe("r1", "events", null)));
        assertTrue(handler.handles(
                new PushRequest.Unsubscribe("r1", "events")));
    }

    @Test
    void does_not_handle_listen() {
        assertFalse(handler.handles(
                new PushRequest.Listen("r1", List.of("t"), null)));
    }

    @Test
    void handle_subscribe_registers_connection() {
        handler.handle("c1",
                new PushRequest.Subscribe("r1", "events", null));
        assertTrue(datasetRegistry.connections("events").contains("c1"));
    }

    @Test
    void handle_unsubscribe_removes_connection() {
        datasetRegistry.subscribe("c1", "events");
        handler.handle("c1",
                new PushRequest.Unsubscribe("r1", "events"));
        assertTrue(datasetRegistry.connections("events").isEmpty());
    }
}
