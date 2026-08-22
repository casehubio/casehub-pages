package io.casehub.pages.push.store.jdbc;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@ApplicationScoped
public class JdbcEventStore implements EventStore {

    @Inject
    DataSource dataSource;

    @ConfigProperty(name = "casehub.pages.push.store.jdbc.max-events-per-topic",
                    defaultValue = "10000")
    int maxEventsPerTopic;

    @PostConstruct
    void initSchema() {
        try (Connection conn = dataSource.getConnection()) {
            try (var stmt = conn.createStatement()) {
                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS push_topic_seq (
                        topic       VARCHAR(255) PRIMARY KEY,
                        next_seq    BIGINT NOT NULL DEFAULT 0
                    )""");
                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS push_events (
                        topic        VARCHAR(255) NOT NULL,
                        seq          BIGINT NOT NULL,
                        payload_json TEXT NOT NULL,
                        created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                        PRIMARY KEY (topic, seq)
                    )""");
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to initialize push event store schema", e);
        }
    }

    @Override
    public long append(String topic, String payloadJson) {
        Objects.requireNonNull(topic, "topic");
        Objects.requireNonNull(payloadJson, "payloadJson");

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try {
                long seq;
                try (PreparedStatement ps = conn.prepareStatement(
                        "INSERT INTO push_topic_seq (topic, next_seq) VALUES (?, 1) " +
                        "ON CONFLICT (topic) DO UPDATE SET next_seq = push_topic_seq.next_seq + 1 " +
                        "RETURNING next_seq")) {
                    ps.setString(1, topic);
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        seq = rs.getLong(1);
                    }
                }

                try (PreparedStatement ps = conn.prepareStatement(
                        "INSERT INTO push_events (topic, seq, payload_json, created_at) " +
                        "VALUES (?, ?, ?, now())")) {
                    ps.setString(1, topic);
                    ps.setLong(2, seq);
                    ps.setString(3, payloadJson);
                    ps.executeUpdate();
                }

                long threshold = seq - maxEventsPerTopic;
                if (threshold > 0) {
                    try (PreparedStatement ps = conn.prepareStatement(
                            "DELETE FROM push_events WHERE topic = ? AND seq <= ?")) {
                        ps.setString(1, topic);
                        ps.setLong(2, threshold);
                        ps.executeUpdate();
                    }
                }

                conn.commit();
                return seq;
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to append event to topic: " + topic, e);
        }
    }

    @Override
    public List<StoredEvent> replay(String topic, long sinceSeq, int limit) {
        Objects.requireNonNull(topic, "topic");
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be positive");
        }

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT topic, seq, payload_json, created_at " +
                     "FROM push_events WHERE topic = ? AND seq > ? " +
                     "ORDER BY seq ASC LIMIT ?")) {
            ps.setString(1, topic);
            ps.setLong(2, sinceSeq);
            ps.setInt(3, limit);

            List<StoredEvent> results = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(new StoredEvent(
                            rs.getString("topic"),
                            rs.getString("payload_json"),
                            rs.getLong("seq"),
                            rs.getTimestamp("created_at").toInstant()));
                }
            }
            return results;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to replay events for topic: " + topic, e);
        }
    }

    @Override
    public Set<String> topics() {
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT topic FROM push_topic_seq");
             ResultSet rs = ps.executeQuery()) {
            Set<String> topics = new HashSet<>();
            while (rs.next()) {
                topics.add(rs.getString("topic"));
            }
            return topics;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list topics", e);
        }
    }
}
