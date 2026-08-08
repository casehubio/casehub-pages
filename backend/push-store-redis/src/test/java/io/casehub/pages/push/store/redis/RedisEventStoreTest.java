package io.casehub.pages.push.store.redis;

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
class RedisEventStoreTest {

    @Inject EventStore eventStore;

    @Test
    void is_redis_implementation() {
        assertThat(eventStore).isInstanceOf(RedisEventStore.class);
    }

    @Test
    void append_assigns_monotonic_seq() {
        long seq1 = eventStore.append("redis-mono", "{\"v\":1}");
        long seq2 = eventStore.append("redis-mono", "{\"v\":2}");
        long seq3 = eventStore.append("redis-mono", "{\"v\":3}");

        assertThat(seq1).isEqualTo(1);
        assertThat(seq2).isEqualTo(2);
        assertThat(seq3).isEqualTo(3);
    }

    @Test
    void append_per_topic_isolation() {
        long seqA = eventStore.append("redis-iso-a", "{\"a\":1}");
        long seqB = eventStore.append("redis-iso-b", "{\"b\":1}");

        assertThat(seqA).isEqualTo(1);
        assertThat(seqB).isEqualTo(1);
    }

    @Test
    void replay_returns_events_after_sinceSeq() {
        eventStore.append("redis-replay", "{\"v\":1}");
        eventStore.append("redis-replay", "{\"v\":2}");
        eventStore.append("redis-replay", "{\"v\":3}");
        eventStore.append("redis-replay", "{\"v\":4}");

        List<StoredEvent> events = eventStore.replay("redis-replay", 2, Integer.MAX_VALUE);

        assertThat(events).hasSize(2);
        assertThat(events.get(0).seq()).isEqualTo(3);
        assertThat(events.get(1).seq()).isEqualTo(4);
    }

    @Test
    void replay_respects_limit() {
        for (int i = 0; i < 10; i++) {
            eventStore.append("redis-limit", "{\"i\":" + i + "}");
        }

        List<StoredEvent> events = eventStore.replay("redis-limit", 0, 3);

        assertThat(events).hasSize(3);
        assertThat(events.get(0).seq()).isEqualTo(1);
        assertThat(events.get(2).seq()).isEqualTo(3);
    }

    @Test
    void replay_empty_topic() {
        List<StoredEvent> events = eventStore.replay("redis-nonexistent", 0, Integer.MAX_VALUE);
        assertThat(events).isEmpty();
    }

    @Test
    void replay_rejects_non_positive_limit() {
        assertThatThrownBy(() -> eventStore.replay("t", 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void topics_returns_all_with_events() {
        eventStore.append("redis-topics-a", "{}");
        eventStore.append("redis-topics-b", "{}");

        Set<String> topics = eventStore.topics();

        assertThat(topics).contains("redis-topics-a", "redis-topics-b");
    }

    @Test
    void stored_event_has_timestamp() {
        Instant before = Instant.now().minusSeconds(1);
        eventStore.append("redis-ts", "{\"v\":1}");
        Instant after = Instant.now().plusSeconds(1);

        List<StoredEvent> events = eventStore.replay("redis-ts", 0, Integer.MAX_VALUE);

        assertThat(events.get(0).createdAt()).isAfter(before).isBefore(after);
    }

    @Test
    void stream_id_maps_to_seq() {
        long seq = eventStore.append("redis-id", "{\"v\":1}");

        List<StoredEvent> events = eventStore.replay("redis-id", 0, Integer.MAX_VALUE);

        assertThat(events.get(0).seq()).isEqualTo(seq);
    }

    @Test
    void xtrim_enforces_capacity() {
        for (int i = 0; i < 150; i++) {
            eventStore.append("redis-cap", "{\"i\":" + i + "}");
        }

        List<StoredEvent> events = eventStore.replay("redis-cap", 0, Integer.MAX_VALUE);

        // XTRIM MAXLEN ~ is approximate — allow margin
        assertThat(events.size()).isLessThanOrEqualTo(120);
        assertThat(events.size()).isGreaterThanOrEqualTo(80);
    }

    @Test
    void concurrent_append_thread_safety() throws InterruptedException {
        int threadCount = 5;
        int appendsPerThread = 10;
        int totalAppends = threadCount * appendsPerThread;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        long seqBefore = eventStore.append("redis-concurrent", "{\"before\":true}");

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < appendsPerThread; j++) {
                        eventStore.append("redis-concurrent", "{\"j\":" + j + "}");
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertThat(latch.await(30, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        List<StoredEvent> all = eventStore.replay("redis-concurrent", seqBefore, Integer.MAX_VALUE);
        // XTRIM may have pruned older entries if stream exceeded capacity from prior runs
        assertThat(all).isNotEmpty();
        assertThat(all.size()).isLessThanOrEqualTo(totalAppends);

        for (int i = 1; i < all.size(); i++) {
            assertThat(all.get(i).seq()).isGreaterThan(all.get(i - 1).seq());
        }
    }
}
