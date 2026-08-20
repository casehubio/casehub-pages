package io.casehub.pages.examples;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.PushColumn;
import io.casehub.pages.push.PushMessage;
import io.quarkus.scheduler.Scheduled;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@ApplicationScoped
public class DemoEventGenerator {
    @Inject EventBroadcaster broadcaster;
    @Inject DatasetRegistry datasetRegistry;
    @Inject ConnectionRegistry connectionRegistry;

    private static final String[] EVENT_TYPES = {
        "claim.created", "claim.updated", "claim.resolved",
        "alert.triggered", "metric.recorded"
    };
    private static final String[] SEVERITIES = {"info", "warning", "critical"};

    private static final List<PushColumn> EVENT_COLUMNS = List.of(
        new PushColumn("type", "Type", "LABEL"),
        new PushColumn("severity", "Severity", "LABEL"),
        new PushColumn("value", "Value", "NUMBER"),
        new PushColumn("timestamp", "Timestamp", "LABEL")
    );

    @Scheduled(every = "2s")
    void generateEvents() {
        var rng = ThreadLocalRandom.current();
        String type = EVENT_TYPES[rng.nextInt(EVENT_TYPES.length)];
        String severity = SEVERITIES[rng.nextInt(SEVERITIES.length)];
        String value = String.valueOf(Math.round(rng.nextDouble() * 1000.0) / 10.0);
        String timestamp = Instant.now().toString();

        String payload = String.format(
            "{\"type\":\"%s\",\"severity\":\"%s\",\"value\":%s,\"timestamp\":\"%s\"}",
            type, severity, value, timestamp);

        broadcaster.broadcast("demo:events", payload);
        broadcaster.broadcast("demo:persistence", payload);

        List<List<String>> rows = List.of(List.of(type, severity, value, timestamp));
        sendToDatasetSubscribers("events", EVENT_COLUMNS, rows);
    }

    private void sendToDatasetSubscribers(String dataset, List<PushColumn> columns, List<List<String>> rows) {
        String message = PushMessage.append(dataset, columns, rows);
        for (String connId : datasetRegistry.connections(dataset)) {
            WebSocketConnection conn = connectionRegistry.get(connId);
            if (conn != null) {
                try {
                    conn.sendTextAndAwait(message);
                } catch (Exception e) {
                    // Connection likely closed
                }
            }
        }
    }
}
