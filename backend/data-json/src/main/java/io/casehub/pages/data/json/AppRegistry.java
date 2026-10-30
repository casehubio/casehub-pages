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

    private static final Logger LOG = Logger.getLogger(AppRegistry.class);
    static final String APPS_PREFIX = "org/apps/";

    private final Map<String, AppDescriptor> descriptors = new LinkedHashMap<>();
    private final Map<String, Map<String, CollectionSchema>> schemas = new LinkedHashMap<>();

    @PostConstruct
    void init() {
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
