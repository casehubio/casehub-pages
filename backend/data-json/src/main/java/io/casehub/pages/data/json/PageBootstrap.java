package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.casehub.pages.data.DataContext;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.OptionalInt;

public final class PageBootstrap {

    private static final Logger LOG = Logger.getLogger(PageBootstrap.class);
    private static final ObjectMapper YAML_MAPPER = new ObjectMapper(new YAMLFactory());
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

    private PageBootstrap() {}

    public static void seed(JsonCollectionStore store, String tenantId, String appId, Path appDir) {
        try (var files = Files.list(appDir)) {
            files.filter(p -> p.getFileName().toString().endsWith(".page.yaml"))
                 .forEach(pageFile -> seedFile(store, tenantId, appId, pageFile));
        } catch (IOException e) {
            LOG.warnf(e, "Failed to scan for .page.yaml files in %s", appDir);
        }
    }

    private static void seedFile(JsonCollectionStore store, String tenantId,
                                 String appId, Path pageFile) {
        try {
            String yamlContent = Files.readString(pageFile, StandardCharsets.UTF_8);

            JsonNode parsed = YAML_MAPPER.readTree(yamlContent);
            if (!parsed.isObject() || !parsed.has("pages") || !parsed.get("pages").isArray()) {
                LOG.warnf("Skipping %s — no 'pages' array found", pageFile);
                return;
            }

            for (JsonNode pageNode : parsed.get("pages")) {
                if (!pageNode.isObject() || !pageNode.has("name")) {continue;}
                String pageName = pageNode.get("name").asText();
                String pageYaml = YAML_MAPPER.writeValueAsString(pageNode);
                String pageHash = sha256(pageYaml);

                seedSinglePage(store, tenantId, appId, pageName, pageYaml, pageHash);
            }
        } catch (IOException e) {
            LOG.warnf(e, "Failed to seed pages from %s", pageFile);
        }
    }

    private static void seedSinglePage(JsonCollectionStore store, String tenantId,
                                        String appId, String name, String yaml, String fileHash) {
        DataContext ctx = new DataContext(tenantId);
        Optional<JsonNode> existing = store.get(ctx, tenantId, "_pages", name);

        if (existing.isPresent()) {
            JsonNode doc = existing.get();
            String existingHash = doc.has("sourceHash") ? doc.get("sourceHash").asText() : "";
            if (fileHash.equals(existingHash)) return;

            ObjectNode patch = JSON_MAPPER.createObjectNode();
            patch.put("yaml", yaml);
            patch.put("sourceHash", fileHash);
            store.update(ctx, tenantId, "_pages", name, patch, OptionalInt.empty(), MergeStrategy.RFC_7396);
            LOG.infof("Updated static page '%s' (hash changed)", name);
        } else {
            ObjectNode doc = JSON_MAPPER.createObjectNode();
            doc.put("name", name);
            doc.put("yaml", yaml);
            doc.put("source", "static");
            doc.put("sourceHash", fileHash);
            store.create(ctx, tenantId, "_pages", doc, "name");
            LOG.infof("Seeded static page '%s'", name);
        }
    }

    private static String sha256(String content) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
