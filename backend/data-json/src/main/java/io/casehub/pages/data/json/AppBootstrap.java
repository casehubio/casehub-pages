package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataContext;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.Optional;

public final class AppBootstrap {

    private static final Logger LOG = Logger.getLogger(AppBootstrap.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AppBootstrap() {}

    public static void seedKnownApps(JsonCollectionStore store, String tenantId, Map<String, AppDescriptor> descriptors) {
        DataContext ctx = new DataContext(tenantId);
        for (Map.Entry<String, AppDescriptor> entry : descriptors.entrySet()) {
            String             appId      = entry.getKey();
            AppDescriptor      descriptor = entry.getValue();
            Optional<JsonNode> existing   = store.get(ctx, tenantId, "_apps", appId);
            if (existing.isPresent()) {continue;}

            ObjectNode doc = MAPPER.createObjectNode();
            doc.put("appId", appId);
            doc.put("name", capitalize(appId));
            doc.put("description", buildDescription(descriptor));
            doc.put("route", "/" + appId);
            doc.put("source", "static");
            store.create(ctx, tenantId, "_apps", doc, "appId");
            LOG.infof("Seeded app catalogue entry '%s'", appId);
        }
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String buildDescription(AppDescriptor descriptor) {
        int colCount = descriptor.collections().size();
        if (colCount == 0) {return "Application";}
        String colNames = descriptor.collections().stream()
                                    .map(CollectionDef::name)
                                    .collect(java.util.stream.Collectors.joining(", "));
        return colCount + " collection" + (colCount > 1 ? "s" : "") + ": " + colNames;
    }

}
