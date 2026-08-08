package io.casehub.pages.push;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable event record with topic, payload, assigned sequence number, and timestamp.
 *
 * @param topic       topic name (not null)
 * @param payloadJson JSON payload string (not null)
 * @param seq         assigned monotonic sequence number for this topic (starts at 1)
 * @param createdAt   timestamp when the event was stored (not null)
 */
public record StoredEvent(String topic, String payloadJson, long seq, Instant createdAt) {
    public StoredEvent {
        Objects.requireNonNull(topic, "topic");
        Objects.requireNonNull(payloadJson, "payloadJson");
        Objects.requireNonNull(createdAt, "createdAt");
    }
}
