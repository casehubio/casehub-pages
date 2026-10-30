package io.casehub.pages.data.json;

import io.casehub.pages.data.CollectionSchema;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@ApplicationScoped
public class AppRegistry {
    @jakarta.inject.Inject
    io.casehub.pages.sqlite.SqliteConnectionFactory connectionFactory;
    private JsonCollectionStore store;


    private static final Logger LOG = Logger.getLogger(AppRegistry.class);
    static final String APPS_PREFIX = "org/apps/";

    private final Map<String, AppDescriptor> descriptors = new LinkedHashMap<>();
    private final Map<String, Map<String, CollectionSchema>> schemas = new LinkedHashMap<>();

    @PostConstruct
    void init() {
        store = new JsonCollectionStore(connectionFactory);
        scanClasspath();
    }

    public Set<String> getRegisteredApps() {
        return Set.copyOf(descriptors.keySet());
    }

    public Optional<AppDescriptor> getDescriptor(String appId) {
        return Optional.ofNullable(descriptors.get(appId));
    }

    public Optional<CollectionSchema> getSchema(String appId, String collection) {
        Map<String, CollectionSchema> appSchemas = schemas.get(appId);
        if (appSchemas == null) return Optional.empty();
        return Optional.ofNullable(appSchemas.get(collection));
    }

    public Optional<CollectionSchema> getSchemaForCollection(String collection) {
        for (Map<String, CollectionSchema> appSchemas : schemas.values()) {
            CollectionSchema schema = appSchemas.get(collection);
            if (schema != null) return Optional.of(schema);
        }
        return Optional.empty();
    }

    public void ensureSeeded(io.casehub.pages.data.DataContext ctx, String appId, String collection) {
        AppDescriptor descriptor = descriptors.get(appId);
        if (descriptor == null) {return;}

        CollectionDef colDef = descriptor.collections().stream()
                                         .filter(c -> c.name().equals(collection))
                                         .findFirst().orElse(null);
        if (colDef == null || colDef.dataFiles().isEmpty()) {return;}

        String storeAppId = ctx.tenantId();
        if (store.countDocuments(ctx.tenantId(), storeAppId, collection) > 0) {return;}

        loadSeedData(ctx, appId, storeAppId, collection, colDef.dataFiles());
    }

    private void loadSeedData(io.casehub.pages.data.DataContext ctx, String descriptorAppId,
                              String storeAppId, String collection, java.util.List<String> dataFiles) {
        try (java.sql.Connection conn = connectionFactory.getConnection()) {
            try (var stmt = conn.createStatement()) {
                stmt.execute("BEGIN IMMEDIATE");
            }

            String countSql = "SELECT COUNT(*) FROM json_documents WHERE tenant_id = ? AND app_id = ? AND collection = ?";
            try (var ps = conn.prepareStatement(countSql)) {
                ps.setString(1, ctx.tenantId());
                ps.setString(2, storeAppId);
                ps.setString(3, collection);
                try (var rs = ps.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        conn.createStatement().execute("ROLLBACK");
                        return;
                    }
                }
            }

            String                                      insertSql = "INSERT INTO json_documents (tenant_id, app_id, collection, doc_id, data, _version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)";
            com.fasterxml.jackson.databind.ObjectMapper mapper    = new com.fasterxml.jackson.databind.ObjectMapper();
            String                                      now       = java.time.Instant.now().toString();

            for (String dataFile : dataFiles) {
                String resourcePath = APPS_PREFIX + descriptorAppId + "/" + dataFile;
                try (java.io.InputStream is = Thread.currentThread().getContextClassLoader()
                                                    .getResourceAsStream(resourcePath)) {
                    if (is == null) {
                        LOG.warnf("Seed data file not found: %s", resourcePath);
                        continue;
                    }
                    com.fasterxml.jackson.databind.JsonNode array = mapper.readTree(is);
                    if (!array.isArray()) {continue;}
                    for (com.fasterxml.jackson.databind.JsonNode doc : array) {
                        String docId = io.casehub.pages.data.SlugUtils.resolveSlug(doc, "title")
                                                                      .orElse(java.util.UUID.randomUUID().toString());
                        String json = mapper.writeValueAsString(doc);
                        try (var ps = conn.prepareStatement(insertSql)) {
                            ps.setString(1, ctx.tenantId());
                            ps.setString(2, storeAppId);
                            ps.setString(3, collection);
                            ps.setString(4, docId);
                            ps.setString(5, json);
                            ps.setString(6, now);
                            ps.setString(7, now);
                            ps.executeUpdate();
                        }
                    }
                }
            }
            conn.createStatement().execute("COMMIT");
        } catch (Exception e) {
            LOG.warnf(e, "Failed to load seed data for %s/%s", descriptorAppId, collection);
        }
    }


    private void scanClasspath() {
        try {
            Enumeration<URL> resources = Thread.currentThread().getContextClassLoader()
                .getResources(APPS_PREFIX);

            while (resources.hasMoreElements()) {
                URL url = resources.nextElement();
                if ("file".equals(url.getProtocol())) {
                    Path appsDir = Path.of(url.toURI());
                    if (Files.isDirectory(appsDir)) {
                        try (var dirs = Files.list(appsDir)) {
                            dirs.filter(Files::isDirectory).forEach(this::loadApp);
                        }
                    }
                }
            }
        } catch (Exception e) {
            LOG.warn("Failed to scan classpath for app descriptors", e);
        }
    }

    private void loadApp(Path appDir) {
        Path yamlFile = appDir.resolve("app.yaml");
        if (!Files.exists(yamlFile)) return;

        String appId = appDir.getFileName().toString();
        try (InputStream is = Files.newInputStream(yamlFile)) {
            AppDescriptor descriptor = AppDescriptorParser.parse(appId, is);
            descriptors.put(appId, descriptor);
            registerSchemas(descriptor);
            LOG.infof("Registered app '%s' with %d collections", appId, descriptor.collections().size());
        } catch (IOException e) {
            LOG.warnf(e, "Failed to load app descriptor for '%s'", appId);
        }
    }

    private void registerSchemas(AppDescriptor descriptor) {
        Map<String, CollectionSchema> appSchemas = new LinkedHashMap<>();
        for (CollectionDef col : descriptor.collections()) {
            CollectionSchema schema = toSchema(col);
            appSchemas.put(col.name(), schema);
        }
        schemas.put(descriptor.appId(), appSchemas);
    }

    private CollectionSchema toSchema(CollectionDef col) {
        Map<String, String> fieldTypes = new LinkedHashMap<>();
        Map<String, Object> defaults = new LinkedHashMap<>();
        Map<String, String> refs = new LinkedHashMap<>();

        for (FieldDef field : col.fields()) {
            String typeStr = switch (field.type()) {
                case ENUM -> "enum:" + String.join(",", field.enumValues());
                default -> field.type().toJson();
            };
            fieldTypes.put(field.name(), typeStr);

            if (field.defaultValue() != null) {
                defaults.put(field.name(), field.defaultValue());
            }
            if (field.ref() != null) {
                refs.put(field.name(), field.ref());
            }
        }
        return new CollectionSchema(col.name(), fieldTypes, defaults, refs);
    }
}
