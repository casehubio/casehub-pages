package io.casehub.pages.push.store.redis;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.stream.StreamRange;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

@ApplicationScoped
public class RedisEventStoreRetention {

    @Inject
    RedisDataSource redis;

    @ConfigProperty(name = "casehub.pages.push.store.redis.ttl", defaultValue = "P7D")
    Duration ttl;

    @ConfigProperty(name = "casehub.pages.push.store.redis.key-prefix", defaultValue = "push")
    String keyPrefix;

    @Scheduled(every = "${casehub.pages.push.store.redis.cleanup-interval:PT1H}",
               concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void cleanup() {
        if (ttl.isZero() || ttl.isNegative()) {
            return;
        }

        long thresholdMillis = Instant.now().minus(ttl).toEpochMilli();
        Set<String> topics = redis.set(String.class).smembers(keyPrefix + ":topics");
        if (topics == null || topics.isEmpty()) {
            return;
        }

        var commands = redis.stream(String.class);
        for (String topic : topics) {
            String streamKey = keyPrefix + ":events:" + topic;
            boolean done = false;
            while (!done) {
                var entries = commands.xrange(streamKey, StreamRange.of("-", "+"), 100);
                if (entries.isEmpty()) {
                    done = true;
                    continue;
                }
                for (var entry : entries) {
                    String createdAtStr = entry.payload().get("createdAt");
                    if (createdAtStr != null && Long.parseLong(createdAtStr) < thresholdMillis) {
                        commands.xdel(streamKey, entry.id());
                    } else {
                        done = true;
                        break;
                    }
                }
            }
        }
    }
}
