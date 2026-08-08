package io.casehub.pages.push.store.redis;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.stream.StreamRange;
import io.quarkus.redis.datasource.stream.XAddArgs;
import io.quarkus.redis.datasource.stream.XTrimArgs;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Alternative
@Priority(1)
@ApplicationScoped
public class RedisEventStore implements EventStore {

    @Inject
    RedisDataSource redis;

    @ConfigProperty(name = "casehub.pages.push.store.redis.max-events-per-topic",
                    defaultValue = "10000")
    int maxEventsPerTopic;

    @ConfigProperty(name = "casehub.pages.push.store.redis.key-prefix",
                    defaultValue = "push")
    String keyPrefix;

    private String seqKey(String topic) {
        return keyPrefix + ":seq:" + topic;
    }

    private String eventsKey(String topic) {
        return keyPrefix + ":events:" + topic;
    }

    private String topicsKey() {
        return keyPrefix + ":topics";
    }

    @Override
    public long append(String topic, String payloadJson) {
        Objects.requireNonNull(topic, "topic");
        Objects.requireNonNull(payloadJson, "payloadJson");

        long seq = redis.value(Long.class).incr(seqKey(topic));

        redis.set(String.class).sadd(topicsKey(), topic);

        long createdAtMillis = Instant.now().toEpochMilli();
        String streamId = seq + "-0";

        redis.stream(String.class)
                .xadd(eventsKey(topic),
                        new XAddArgs().id(streamId),
                        Map.of("payload", payloadJson,
                               "createdAt", String.valueOf(createdAtMillis)));

        redis.stream(String.class)
                .xtrim(eventsKey(topic),
                        new XTrimArgs().maxlen(maxEventsPerTopic));

        return seq;
    }

    @Override
    public List<StoredEvent> replay(String topic, long sinceSeq, int limit) {
        Objects.requireNonNull(topic, "topic");
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be positive");
        }

        String startId = "(" + sinceSeq + "-0";
        var entries = redis.stream(String.class)
                .xrange(eventsKey(topic),
                        StreamRange.of(startId, "+"),
                        limit);

        List<StoredEvent> results = new ArrayList<>();
        for (var entry : entries) {
            String id = entry.id();
            long seq = Long.parseLong(id.substring(0, id.indexOf('-')));
            String payload = entry.payload().get("payload");
            Instant created = Instant.ofEpochMilli(
                    Long.parseLong(entry.payload().get("createdAt")));
            results.add(new StoredEvent(topic, payload, seq, created));
        }
        return results;
    }

    @Override
    public Set<String> topics() {
        Set<String> members = redis.set(String.class).smembers(topicsKey());
        return members != null ? members : Set.of();
    }
}
