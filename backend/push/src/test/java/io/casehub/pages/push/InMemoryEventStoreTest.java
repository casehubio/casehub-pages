package io.casehub.pages.push;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for InMemoryEventStore — bounded ring buffer with per-topic sequences.
 * Per §3.1–§3.2 and §3.7 of 2026-07-05 spec.
 */
class InMemoryEventStoreTest {

    @Test
    void append_assigns_monotonic_seq() {
        var store = new InMemoryEventStore(10);

        long seq1 = store.append("topic-a", "{\"data\":1}");
        long seq2 = store.append("topic-a", "{\"data\":2}");
        long seq3 = store.append("topic-a", "{\"data\":3}");

        assertEquals(1, seq1, "First append should assign seq 1");
        assertEquals(2, seq2, "Second append should assign seq 2");
        assertEquals(3, seq3, "Third append should assign seq 3");
    }

    @Test
    void append_per_topic_isolation() {
        var store = new InMemoryEventStore(10);

        long seqA1 = store.append("topic-a", "{\"a\":1}");
        long seqB1 = store.append("topic-b", "{\"b\":1}");
        long seqA2 = store.append("topic-a", "{\"a\":2}");
        long seqB2 = store.append("topic-b", "{\"b\":2}");

        assertEquals(1, seqA1);
        assertEquals(1, seqB1, "Topic B should have independent sequence starting at 1");
        assertEquals(2, seqA2);
        assertEquals(2, seqB2);
    }

    @Test
    void replay_returns_events_after_sinceSeq() {
        var store = new InMemoryEventStore(10);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-a", "{\"data\":2}");
        store.append("topic-a", "{\"data\":3}");
        store.append("topic-a", "{\"data\":4}");

        List<StoredEvent> events = store.replay("topic-a", 2, Integer.MAX_VALUE);

        assertEquals(2, events.size(), "Should return events with seq > 2");
        assertEquals(3, events.get(0).seq());
        assertEquals("{\"data\":3}", events.get(0).payloadJson());
        assertEquals(4, events.get(1).seq());
        assertEquals("{\"data\":4}", events.get(1).payloadJson());
    }

    @Test
    void replay_empty_topic() {
        var store = new InMemoryEventStore(10);

        List<StoredEvent> events = store.replay("nonexistent", 0, Integer.MAX_VALUE);

        assertTrue(events.isEmpty(), "Replay on nonexistent topic should return empty list");
    }

    @Test
    void replay_sinceSeq_zero_returns_all() {
        var store = new InMemoryEventStore(10);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-a", "{\"data\":2}");

        List<StoredEvent> events = store.replay("topic-a", 0, Integer.MAX_VALUE);

        assertEquals(2, events.size(), "sinceSeq=0 should return all events");
    }

    @Test
    void bounded_eviction() {
        var store = new InMemoryEventStore(3);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-a", "{\"data\":2}");
        store.append("topic-a", "{\"data\":3}");
        store.append("topic-a", "{\"data\":4}"); // Evicts seq=1

        List<StoredEvent> events = store.replay("topic-a", 0, Integer.MAX_VALUE);

        assertEquals(3, events.size(), "Should retain only max entries");
        assertEquals(2, events.get(0).seq(), "Oldest event should be seq 2 (seq 1 evicted)");
        assertEquals(3, events.get(1).seq());
        assertEquals(4, events.get(2).seq());
    }

    @Test
    void topics_empty_on_fresh_store() {
        var store = new InMemoryEventStore(10);

        Set<String> topics = store.topics();

        assertTrue(topics.isEmpty(), "Fresh store should have no topics");
    }

    @Test
    void topics_returns_topic_after_append() {
        var store = new InMemoryEventStore(10);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-b", "{\"data\":2}");

        Set<String> topics = store.topics();

        assertEquals(2, topics.size());
        assertTrue(topics.contains("topic-a"));
        assertTrue(topics.contains("topic-b"));
    }

    @Test
    void topics_survives_eviction() {
        var store = new InMemoryEventStore(2);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-a", "{\"data\":2}");
        store.append("topic-a", "{\"data\":3}"); // Evicts seq=1, ring rotates

        Set<String> topics = store.topics();

        assertTrue(topics.contains("topic-a"), "Topic should remain listed even after eviction");
    }

    @Test
    void thread_safety_concurrent_append_and_replay() throws InterruptedException {
        var store = new InMemoryEventStore(1000);
        int threadCount = 10;
        int appendsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        // Concurrent append + replay on same topic
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < appendsPerThread; j++) {
                        // Append and replay concurrently to stress thread safety
                        store.append("shared-topic", "{\"data\":" + j + "}");
                        // Replay with random sinceSeq to exercise concurrent read/write
                        store.replay("shared-topic", j % 10, Integer.MAX_VALUE);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS), "Concurrent operations should complete");
        executor.shutdown();

        // Verify final state consistency
        List<StoredEvent> allEvents = store.replay("shared-topic", 0, Integer.MAX_VALUE);
        assertEquals(threadCount * appendsPerThread, allEvents.size(),
            "All appends should be present");

        // Verify monotonic sequences (no duplicates or gaps)
        for (int i = 1; i < allEvents.size(); i++) {
            assertEquals(allEvents.get(i - 1).seq() + 1, allEvents.get(i).seq(),
                "Sequences should be monotonic without gaps");
        }
    }

    @Test
    void replay_ordering() {
        var store = new InMemoryEventStore(10);

        store.append("topic-a", "{\"data\":1}");
        store.append("topic-a", "{\"data\":2}");
        store.append("topic-a", "{\"data\":3}");

        List<StoredEvent> events = store.replay("topic-a", 0, Integer.MAX_VALUE);

        assertEquals(1, events.get(0).seq());
        assertEquals(2, events.get(1).seq());
        assertEquals(3, events.get(2).seq());
        assertTrue(events.get(0).seq() < events.get(1).seq());
        assertTrue(events.get(1).seq() < events.get(2).seq());
    }

    @Test
    void replay_respects_limit() {
        var store = new InMemoryEventStore(100);
        for (int i = 0; i < 10; i++) {
            store.append("topic-a", "{\"i\":" + i + "}");
        }

        List<StoredEvent> events = store.replay("topic-a", 0, 3);

        assertEquals(3, events.size(), "Should return at most 3 events");
        assertEquals(1, events.get(0).seq());
        assertEquals(3, events.get(2).seq());
    }

    @Test
    void replay_limit_greater_than_available() {
        var store = new InMemoryEventStore(10);
        store.append("topic-a", "{\"i\":1}");
        store.append("topic-a", "{\"i\":2}");

        List<StoredEvent> events = store.replay("topic-a", 0, 100);

        assertEquals(2, events.size(), "Should return all available when limit exceeds count");
    }

    @Test
    void replay_rejects_non_positive_limit() {
        var store = new InMemoryEventStore(10);
        assertThrows(IllegalArgumentException.class, () -> store.replay("t", 0, 0));
        assertThrows(IllegalArgumentException.class, () -> store.replay("t", 0, -1));
    }

    @Test
    void stored_event_has_created_at() {
        var               store  = new InMemoryEventStore(10);
        java.time.Instant before = java.time.Instant.now();
        store.append("topic-a", "{\"data\":1}");
        java.time.Instant after = java.time.Instant.now();

        List<StoredEvent> events  = store.replay("topic-a", 0, Integer.MAX_VALUE);
        java.time.Instant created = events.get(0).createdAt();

        assertNotNull(created);
        assertFalse(created.isBefore(before), "createdAt should be >= test start");
        assertFalse(created.isAfter(after), "createdAt should be <= test end");
    }
}
