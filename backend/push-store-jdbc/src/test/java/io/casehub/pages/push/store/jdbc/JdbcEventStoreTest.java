package io.casehub.pages.push.store.jdbc;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@QuarkusTest
class JdbcEventStoreTest {

    @Inject EventStore eventStore;

    @Test
    void is_jdbc_implementation() {
        assertThat(eventStore).isInstanceOf(JdbcEventStore.class);
    }

    @Test
    void append_assigns_monotonic_seq() {
        long seq1 = eventStore.append("jdbc-mono", "{\"v\":1}");
        long seq2 = eventStore.append("jdbc-mono", "{\"v\":2}");
        long seq3 = eventStore.append("jdbc-mono", "{\"v\":3}");

        assertThat(seq1).isEqualTo(1);
        assertThat(seq2).isEqualTo(2);
        assertThat(seq3).isEqualTo(3);
    }

    @Test
    void append_per_topic_isolation() {
        long seqA = eventStore.append("jdbc-iso-a", "{\"a\":1}");
        long seqB = eventStore.append("jdbc-iso-b", "{\"b\":1}");

        assertThat(seqA).isEqualTo(1);
        assertThat(seqB).isEqualTo(1);
    }

    @Test
    void replay_returns_events_after_sinceSeq() {
        eventStore.append("jdbc-replay", "{\"v\":1}");
        eventStore.append("jdbc-replay", "{\"v\":2}");
        eventStore.append("jdbc-replay", "{\"v\":3}");
        eventStore.append("jdbc-replay", "{\"v\":4}");

        List<StoredEvent> events = eventStore.replay("jdbc-replay", 2, Integer.MAX_VALUE);

        assertThat(events).hasSize(2);
        assertThat(events.get(0).seq()).isEqualTo(3);
        assertThat(events.get(1).seq()).isEqualTo(4);
    }

    @Test
    void replay_respects_limit() {
        for (int i = 0; i < 10; i++) {
            eventStore.append("jdbc-limit", "{\"i\":" + i + "}");
        }

        List<StoredEvent> events = eventStore.replay("jdbc-limit", 0, 3);

        assertThat(events).hasSize(3);
        assertThat(events.get(0).seq()).isEqualTo(1);
        assertThat(events.get(2).seq()).isEqualTo(3);
    }

    @Test
    void replay_empty_topic() {
        List<StoredEvent> events = eventStore.replay("jdbc-nonexistent", 0, Integer.MAX_VALUE);
        assertThat(events).isEmpty();
    }

    @Test
    void replay_rejects_non_positive_limit() {
        assertThatThrownBy(() -> eventStore.replay("t", 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void topics_returns_all_with_events() {
        eventStore.append("jdbc-topics-a", "{}");
        eventStore.append("jdbc-topics-b", "{}");

        Set<String> topics = eventStore.topics();

        assertThat(topics).contains("jdbc-topics-a", "jdbc-topics-b");
    }

    @Test
    void stored_event_has_timestamp() {
        Instant before = Instant.now().minusSeconds(1);
        eventStore.append("jdbc-ts", "{\"v\":1}");
        Instant after = Instant.now().plusSeconds(1);

        List<StoredEvent> events = eventStore.replay("jdbc-ts", 0, Integer.MAX_VALUE);

        assertThat(events.get(0).createdAt()).isAfter(before).isBefore(after);
    }

    @Test
    void bounded_capacity_eviction() {
        for (int i = 0; i < 110; i++) {
            eventStore.append("jdbc-cap", "{\"i\":" + i + "}");
        }

        List<StoredEvent> events = eventStore.replay("jdbc-cap", 0, Integer.MAX_VALUE);

        assertThat(events).hasSize(100);
        assertThat(events.get(0).seq()).isEqualTo(11);
    }

    @Test
    void concurrent_append_thread_safety() throws InterruptedException {
        int threadCount = 5;
        int appendsPerThread = 10;
        int totalAppends = threadCount * appendsPerThread;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        long seqBefore = eventStore.append("jdbc-concurrent", "{\"before\":true}");

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < appendsPerThread; j++) {
                        eventStore.append("jdbc-concurrent", "{\"j\":" + j + "}");
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertThat(latch.await(30, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        List<StoredEvent> all = eventStore.replay("jdbc-concurrent", seqBefore, Integer.MAX_VALUE);
        assertThat(all).hasSize(totalAppends);

        for (int i = 1; i < all.size(); i++) {
            assertThat(all.get(i).seq()).isGreaterThan(all.get(i - 1).seq());
        }
    }
}
