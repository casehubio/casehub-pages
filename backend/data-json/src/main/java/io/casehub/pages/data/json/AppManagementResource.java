package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.DataCacheService;
import io.casehub.pages.data.DataContext;
import io.casehub.platform.api.identity.TenancyConstants;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;
import java.util.OptionalInt;
import java.util.Set;

@Path("/api/apps")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class AppManagementResource {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String STORE_ID = TenancyConstants.PLATFORM_TENANT_ID;

    @Inject
    AppRegistry appRegistry;
    @Inject
    DataCacheService cacheService;


    @GET
    public Response list() {
        ArrayNode result = MAPPER.createArrayNode();
        DataContext ctx = new DataContext(STORE_ID);
        JsonCollectionStore store = appRegistry.getStore();

        for (String appId : appRegistry.getRegisteredApps()) {
            result.add(buildAppInfo(ctx, store, appId));
        }
        return Response.ok(result).build();
    }

    @GET
    @Path("/{appId}")
    public Response get(@PathParam("appId") String appId) {
        if (!appRegistry.getRegisteredApps().contains(appId)) {
            return Response.status(404)
                .entity(Map.of("error", "App not found: " + appId)).build();
        }
        DataContext ctx = new DataContext(STORE_ID);
        JsonCollectionStore store = appRegistry.getStore();
        return Response.ok(buildAppInfo(ctx, store, appId)).build();
    }

    @POST
    @Path("/{appId}/lifecycle")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response lifecycle(@PathParam("appId") String appId, JsonNode body) {
        if (body == null || !body.has("action")) {
            return Response.status(400)
                           .entity(Map.of("error", "Missing 'action' field")).build();
        }

        String action = body.get("action").asText();
        if (!Set.of("start", "stop").contains(action)) {
            return Response.status(400)
                           .entity(Map.of("error", "Invalid action: " + action
                                                   + ". Must be 'start' or 'stop'")).build();
        }

        DataContext         ctx   = new DataContext(STORE_ID);
        JsonCollectionStore store = appRegistry.getStore();

        var appsDoc = store.get(ctx, STORE_ID, "_apps", appId).orElse(null);
        if (appsDoc == null) {
            return Response.status(404)
                           .entity(Map.of("error", "App not found: " + appId)).build();
        }

        if (appsDoc.has("source")
            && "static".equals(appsDoc.get("source").asText())) {
            return Response.status(409)
                           .entity(Map.of("error",
                                          "Cannot change lifecycle of static app: " + appId)).build();
        }

        boolean    enable = "start".equals(action);
        ObjectNode patch  = MAPPER.createObjectNode();
        patch.put("enabled", enable);
        store.update(ctx, STORE_ID, "_apps", appId, patch,
                     OptionalInt.empty(), MergeStrategy.RFC_7396);

        if (!enable) {
            cacheService.invalidate(STORE_ID, "json:" + appId);
        }

        if (enable) {
            var descriptor = appRegistry.getDescriptor(appId).orElse(null);
            if (descriptor != null) {
                boolean autoSeed = !appsDoc.has("autoSeed")
                                   || appsDoc.get("autoSeed").asBoolean(true);
                if (autoSeed) {
                    for (var col : descriptor.collections()) {
                        appRegistry.ensureSeeded(ctx, appId, col.name());
                    }
                }
            }
        }

        return Response.ok(buildAppInfo(ctx, store, appId)).build();
    }


    private ObjectNode buildAppInfo(DataContext ctx, JsonCollectionStore store, String appId) {
        ObjectNode info = MAPPER.createObjectNode();
        info.put("appId", appId);

        var appsDoc = store.get(ctx, STORE_ID, "_apps", appId).orElse(null);

        if (appsDoc != null) {
            ResourceUtils.copyIfPresent(appsDoc, info, "name");
            ResourceUtils.copyIfPresent(appsDoc, info, "displayName");
            ResourceUtils.copyIfPresent(appsDoc, info, "description");
            ResourceUtils.copyIfPresent(appsDoc, info, "icon");
            ResourceUtils.copyIfPresent(appsDoc, info, "source");
            info.put("enabled",
                !appsDoc.has("enabled") || appsDoc.get("enabled").asBoolean(true));
        } else {
            info.put("enabled", true);
        }

        int collectionCount = 0;
        int totalDocuments = 0;
        var descriptor = appRegistry.getDescriptor(appId).orElse(null);
        if (descriptor != null) {
            collectionCount = descriptor.collections().size();
            for (var col : descriptor.collections()) {
                totalDocuments += store.countDocuments(STORE_ID, STORE_ID, col.name());
            }
        }
        info.put("collectionCount", collectionCount);
        info.put("totalDocuments", totalDocuments);

        return info;
    }
}
