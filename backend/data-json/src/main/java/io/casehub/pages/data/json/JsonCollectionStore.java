package io.casehub.pages.data.json;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.MutationException;
import io.casehub.pages.data.SlugUtils;
import io.casehub.pages.sqlite.SqliteConnectionFactory;
import io.casehub.pages.sqlite.SqliteMigrationRunner;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;

public class JsonCollectionStore {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_DOC_SIZE = 1_048_576;
    private static final int MAX_DOCS_PER_COLLECTION = 100_000;
    private static final int MAX_COLLECTIONS_PER_APP = 50;
    private static final int MAX_SLUG_RETRIES = 99;

    private final SqliteConnectionFactory connectionFactory;

    public JsonCollectionStore(SqliteConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
        SqliteMigrationRunner.migrate(
            connectionFactory.getDataSource(),
            "classpath:db/data-json/migration");
    }

    public String create(DataContext ctx, String appId, String collection,
                         JsonNode document, String slugField) {
        String docId = SlugUtils.resolveSlug(document, slugField)
            .orElse(UUID.randomUUID().toString());

        ObjectNode data = stripSystemFields(document);
        String json = serialize(data);
        checkDocSize(json);
        checkCollectionDocCount(ctx, appId, collection);
        checkCollectionCount(ctx, appId, collection);

        String now = Instant.now().toString();
        String sql = "INSERT INTO json_documents (tenant_id, app_id, collection, doc_id, data, _version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)";

        for (int attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
            String candidateId = attempt == 0 ? docId : docId + "-" + (attempt + 1);
            try (Connection conn = connectionFactory.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, ctx.tenantId());
                ps.setString(2, appId);
                ps.setString(3, collection);
                ps.setString(4, candidateId);
                ps.setString(5, json);
                ps.setString(6, now);
                ps.setString(7, now);
                ps.executeUpdate();
                return candidateId;
            } catch (SQLException e) {
                if (e.getMessage() != null && e.getMessage().contains("UNIQUE constraint failed")) {
                    if (attempt == MAX_SLUG_RETRIES) {
                        throw new MutationException("SLUG_CONFLICT",
                            "Could not generate unique slug for '" + docId + "'");
                    }
                    continue;
                }
                throw new MutationException("STORAGE_ERROR", "Failed to create document: " + e.getMessage(), e);
            }
        }
        throw new MutationException("SLUG_CONFLICT", "Could not generate unique slug for '" + docId + "'");
    }

    public Optional<JsonNode> get(DataContext ctx, String appId, String collection, String docId) {
        String sql = "SELECT data, _version, created_at, updated_at FROM json_documents WHERE tenant_id = ? AND app_id = ? AND collection = ? AND doc_id = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ctx.tenantId());
            ps.setString(2, appId);
            ps.setString(3, collection);
            ps.setString(4, docId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                ObjectNode doc = (ObjectNode) MAPPER.readTree(rs.getString("data"));
                doc.put("_id", docId);
                doc.put("_version", rs.getInt("_version"));
                doc.put("_created_at", rs.getString("created_at"));
                doc.put("_updated_at", rs.getString("updated_at"));
                return Optional.of(doc);
            }
        } catch (SQLException | JsonProcessingException e) {
            throw new MutationException("STORAGE_ERROR", "Failed to get document: " + e.getMessage(), e);
        }
    }

    public void update(DataContext ctx, String appId, String collection, String docId,
                       JsonNode changes, OptionalInt expectedVersion, MergeStrategy strategy) {
        Optional<JsonNode> existing = get(ctx, appId, collection, docId);
        if (existing.isEmpty()) {
            throw new MutationException("NOT_FOUND", "Document not found: " + docId);
        }

        ObjectNode existingData = stripSystemFields(existing.get());
        JsonNode merged = strategy.merge(existingData, changes);
        String json = serialize(merged);
        checkDocSize(json);

        int currentVersion = existing.get().get("_version").asInt();
        if (expectedVersion.isPresent() && expectedVersion.getAsInt() != currentVersion) {
            throw new MutationException("VERSION_CONFLICT",
                "Expected version " + expectedVersion.getAsInt() + ", found " + currentVersion);
        }

        String sql = "UPDATE json_documents SET data = ?, _version = _version + 1, updated_at = ? WHERE tenant_id = ? AND app_id = ? AND collection = ? AND doc_id = ? AND _version = ?";
        String now = Instant.now().toString();
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, json);
            ps.setString(2, now);
            ps.setString(3, ctx.tenantId());
            ps.setString(4, appId);
            ps.setString(5, collection);
            ps.setString(6, docId);
            ps.setInt(7, currentVersion);
            int updated = ps.executeUpdate();
            if (updated == 0) {
                throw new MutationException("VERSION_CONFLICT", "Concurrent modification detected");
            }
        } catch (SQLException e) {
            throw new MutationException("STORAGE_ERROR", "Failed to update document: " + e.getMessage(), e);
        }
    }

    public void delete(DataContext ctx, String appId, String collection, String docId) {
        String sql = "DELETE FROM json_documents WHERE tenant_id = ? AND app_id = ? AND collection = ? AND doc_id = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ctx.tenantId());
            ps.setString(2, appId);
            ps.setString(3, collection);
            ps.setString(4, docId);
            int deleted = ps.executeUpdate();
            if (deleted == 0) {
                throw new MutationException("NOT_FOUND", "Document not found: " + docId);
            }
        } catch (SQLException e) {
            throw new MutationException("STORAGE_ERROR", "Failed to delete document: " + e.getMessage(), e);
        }
    }

    <T> T executeQuery(PreparedQuery query, ResultSetProcessor<T> processor) {
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(query.sql())) {
            for (int i = 0; i < query.params().size(); i++) {
                ps.setObject(i + 1, query.params().get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                return processor.process(rs);
            }
        } catch (SQLException e) {
            throw new MutationException("STORAGE_ERROR", "Query failed: " + e.getMessage(), e);
        }
    }

    @FunctionalInterface
    interface ResultSetProcessor<T> {
        T process(ResultSet rs) throws SQLException;
    }

    private void checkDocSize(String json) {
        if (json.length() > MAX_DOC_SIZE) {
            throw new MutationException("DOC_TOO_LARGE",
                "Document size " + json.length() + " exceeds limit of " + MAX_DOC_SIZE);
        }
    }

    private void checkCollectionDocCount(DataContext ctx, String appId, String collection) {
        String sql = "SELECT COUNT(*) FROM json_documents WHERE tenant_id = ? AND app_id = ? AND collection = ?";
        int count = countQuery(ctx, sql, appId, collection);
        if (count >= MAX_DOCS_PER_COLLECTION) {
            throw new MutationException("COLLECTION_FULL",
                "Collection '" + collection + "' has reached the limit of " + MAX_DOCS_PER_COLLECTION + " documents");
        }
    }

    private void checkCollectionCount(DataContext ctx, String appId, String collection) {
        String existsCheck = "SELECT COUNT(*) FROM json_documents WHERE tenant_id = ? AND app_id = ? AND collection = ?";
        int existingDocs = countQuery(ctx, existsCheck, appId, collection);
        if (existingDocs > 0) return;

        String sql = "SELECT COUNT(DISTINCT collection) FROM json_documents WHERE tenant_id = ? AND app_id = ?";
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ctx.tenantId());
            ps.setString(2, appId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next() && rs.getInt(1) >= MAX_COLLECTIONS_PER_APP) {
                    throw new MutationException("TOO_MANY_COLLECTIONS",
                        "App '" + appId + "' has reached the limit of " + MAX_COLLECTIONS_PER_APP + " collections");
                }
            }
        } catch (SQLException e) {
            throw new MutationException("STORAGE_ERROR", "Failed to check collection count: " + e.getMessage(), e);
        }
    }

    private int countQuery(DataContext ctx, String sql, String appId, String collection) {
        try (Connection conn = connectionFactory.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ctx.tenantId());
            ps.setString(2, appId);
            ps.setString(3, collection);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            throw new MutationException("STORAGE_ERROR", "Count query failed: " + e.getMessage(), e);
        }
    }

    private ObjectNode stripSystemFields(JsonNode doc) {
        ObjectNode copy = doc.deepCopy();
        copy.remove("_id");
        copy.remove("_version");
        copy.remove("_created_at");
        copy.remove("_updated_at");
        return copy;
    }

    private String serialize(JsonNode node) {
        try {
            return MAPPER.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new MutationException("VALIDATION_ERROR", "Failed to serialize document: " + e.getMessage(), e);
        }
    }
}
