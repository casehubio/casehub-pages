package io.casehub.pages.layout.sqlite;

import io.casehub.pages.layout.LayoutPersistenceStore;
import io.casehub.pages.sqlite.SqliteConnectionFactory;
import io.casehub.pages.sqlite.SqliteMigrationRunner;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@ApplicationScoped
public class SqliteLayoutPersistenceStore implements LayoutPersistenceStore {

    @Inject
    SqliteConnectionFactory connectionFactory;

    @PostConstruct
    void init() {
        SqliteMigrationRunner.migrate(
            connectionFactory.getDataSource(),
            "classpath:db/layout-sqlite/migration");
    }

    @Override
    public Optional<String> load(String key, String tenantId, String userId) {
        String sql = "SELECT payload FROM layout_state WHERE key=? AND tenant_id=? AND user_id=?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key);
            ps.setString(2, tenantId);
            ps.setString(3, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(rs.getString("payload"));
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new IllegalStateException("load() failed", e);
        }
    }

    @Override
    public void save(String key, String tenantId, String userId, String payload) {
        String sql = "INSERT INTO layout_state (key, tenant_id, user_id, payload, updated_at) VALUES (?,?,?,?,?) " +
                     "ON CONFLICT(key, tenant_id, user_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at";
        String updatedAt = Instant.now().truncatedTo(ChronoUnit.MILLIS).toString();
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key);
            ps.setString(2, tenantId);
            ps.setString(3, userId);
            ps.setString(4, payload);
            ps.setString(5, updatedAt);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("save() failed", e);
        }
    }

    @Override
    public void delete(String key, String tenantId, String userId) {
        String sql = "DELETE FROM layout_state WHERE key=? AND tenant_id=? AND user_id=?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key);
            ps.setString(2, tenantId);
            ps.setString(3, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("delete() failed", e);
        }
    }
}
