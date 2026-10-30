package io.casehub.pages.sqlite;

import org.flywaydb.core.Flyway;

import javax.sql.DataSource;

public final class SqliteMigrationRunner {

    private SqliteMigrationRunner() {}

    public static void migrate(DataSource dataSource, String... locations) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations(locations)
            .load()
            .migrate();
    }
}
