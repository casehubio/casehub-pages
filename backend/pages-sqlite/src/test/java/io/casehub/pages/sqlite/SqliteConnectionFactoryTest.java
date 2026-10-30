package io.casehub.pages.sqlite;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class SqliteConnectionFactoryTest {

    @Inject
    SqliteConnectionFactory factory;

    @Test
    void connectionIsUsable() throws SQLException {
        try (Connection conn = factory.getConnection()) {
            assertNotNull(conn);
            assertFalse(conn.isClosed());
        }
    }

    @Test
    void dataSourceIsAvailable() {
        assertNotNull(factory.getDataSource());
    }

    @Test
    void migrationRunnerCreatesTables() throws SQLException {
        SqliteMigrationRunner.migrate(
            factory.getDataSource(),
            "classpath:db/test-migration");

        try (Connection conn = factory.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_test'")) {
            assertTrue(rs.next(), "migration_test table should exist after migration");
        }
    }
}
