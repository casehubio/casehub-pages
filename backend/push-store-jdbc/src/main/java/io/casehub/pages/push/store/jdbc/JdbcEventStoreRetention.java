package io.casehub.pages.push.store.jdbc;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Duration;

@ApplicationScoped
public class JdbcEventStoreRetention {

    @Inject
    DataSource dataSource;

    @ConfigProperty(name = "casehub.pages.push.store.jdbc.ttl", defaultValue = "P7D")
    Duration ttl;

    @Scheduled(every = "${casehub.pages.push.store.jdbc.cleanup-interval:PT1H}",
               concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void cleanup() {
        if (ttl.isZero() || ttl.isNegative()) {
            return;
        }
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "DELETE FROM push_events WHERE created_at < now() - make_interval(secs => ?)")) {
            ps.setLong(1, ttl.toSeconds());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to run TTL cleanup", e);
        }
    }
}
