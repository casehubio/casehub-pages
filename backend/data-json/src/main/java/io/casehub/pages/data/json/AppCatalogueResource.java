package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.CollectionSchema;
import io.casehub.pages.data.DataCacheService;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.SchemaViolationException;
import io.casehub.pages.data.SlugUtils;
import io.casehub.platform.api.identity.TenancyConstants;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.net.URI;
import java.util.Map;
import java.util.OptionalInt;
import java.util.Set;

@Path("/api/apps/{appId}/apps")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AppCatalogueResource {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String APPS_COLLECTION = "_apps";
    private static final String STORE_ID = TenancyConstants.PLATFORM_TENANT_ID;

    @Inject
    JsonWebToken jwt;

    @Inject
    AppRegistry appRegistry;

    @Inject
    DataCacheService cacheService;

    @GET
    public Response list(@PathParam("appId") String appId,
                         @QueryParam("label") String labelFilter) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        AppAccessPolicy access = resolveAccess(appId);
        if (!access.read().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient read permissions")).build();
        }

        var docs = appRegistry.getStore().listAll(STORE_ID, STORE_ID, APPS_COLLECTION);
        ArrayNode result = MAPPER.createArrayNode();
        for (JsonNode doc : docs) {
            if (labelFilter != null && !ResourceUtils.matchesLabel(doc, labelFilter)) { continue; }
            ObjectNode meta = MAPPER.createObjectNode();
            ResourceUtils.copyIfPresent(doc, meta, "appId");
            ResourceUtils.copyIfPresent(doc, meta, "name");
            ResourceUtils.copyIfPresent(doc, meta, "description");
            ResourceUtils.copyIfPresent(doc, meta, "icon");
            ResourceUtils.copyIfPresent(doc, meta, "order");
            ResourceUtils.copyIfPresent(doc, meta, "route");
            ResourceUtils.copyIfPresent(doc, meta, "labels");
            ResourceUtils.copyIfPresent(doc, meta, "source");
            result.add(meta);
        }
        return Response.ok(result).build();
    }

    @GET
    @Path("/{childAppId}")
    public Response get(@PathParam("appId") String appId,
                        @PathParam("childAppId") String childAppId) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        AppAccessPolicy access = resolveAccess(appId);
        if (!access.read().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient read permissions")).build();
        }

        DataContext ctx = new DataContext(STORE_ID);
        return appRegistry.getStore().get(ctx, STORE_ID, APPS_COLLECTION, childAppId)
                          .map(doc -> {
                              int version = doc.has("_version") ? doc.get("_version").asInt() : 1;
                              return Response.ok(doc).header("ETag", "\"" + version + "\"").build();
                          })
                          .orElse(Response.status(404).entity(Map.of("error", "App not found: " + childAppId)).build());
    }

    @POST
    public Response create(@PathParam("appId") String appId, JsonNode body) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        if (!(body instanceof ObjectNode obj)) {
            return Response.status(400).entity(Map.of("error", "Expected JSON object")).build();
        }

        AppAccessPolicy access = resolveAccess(appId);
        Set<String>     roles  = ResourceUtils.extractRoles(jwt);
        if (!access.write().isSatisfiedBy(roles)) {
            return Response.status(403).entity(Map.of("error", "Insufficient write permissions")).build();
        }

        String childAppId = obj.has("appId") ? obj.get("appId").asText() : null;
        if (childAppId == null || childAppId.isBlank()) {
            return Response.status(400).entity(Map.of("error", "App appId is required")).build();
        }

        String name = obj.has("name") ? obj.get("name").asText() : null;
        if (name == null || name.isBlank()) {
            return Response.status(400).entity(Map.of("error", "App name is required")).build();
        }

        try {
            validateSchema(appId, obj);
        } catch (SchemaViolationException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        }

        DataContext         ctx   = new DataContext(STORE_ID);
        JsonCollectionStore store = appRegistry.getStore();

        String sluggedId = SlugUtils.slugify(childAppId);
        if (store.get(ctx, STORE_ID, APPS_COLLECTION, sluggedId).isPresent()) {
            return Response.status(409).entity(Map.of("error", "App already exists: " + childAppId)).build();
        }

        String   slug    = store.create(ctx, STORE_ID, APPS_COLLECTION, obj, "appId");
        JsonNode created = store.get(ctx, STORE_ID, APPS_COLLECTION, slug).orElse(null);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_apps");

        return Response.created(URI.create("/api/apps/" + appId + "/apps/" + slug))
                       .entity(created).build();
    }

    @PATCH
    @Path("/{childAppId}")
    public Response update(@PathParam("appId") String appId,
                           @PathParam("childAppId") String childAppId,
                           @HeaderParam("If-Match") String ifMatch,
                           JsonNode changes) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        if (!(changes instanceof ObjectNode changesObj)) {
            return Response.status(400).entity(Map.of("error", "Expected JSON object")).build();
        }

        AppAccessPolicy access = resolveAccess(appId);
        if (!access.write().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient write permissions")).build();
        }

        DataContext         ctx   = new DataContext(STORE_ID);
        JsonCollectionStore store = appRegistry.getStore();

        if (store.get(ctx, STORE_ID, APPS_COLLECTION, childAppId).isEmpty()) {
            return Response.status(404).entity(Map.of("error", "App not found: " + childAppId)).build();
        }

        if (isStaticApp(childAppId)) {
            return Response.status(409).entity(Map.of("error", "Static apps are immutable: " + childAppId)).build();
        }

        try {
            validateSchema(appId, changesObj);
        } catch (SchemaViolationException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        }

        OptionalInt expectedVersion = ResourceUtils.parseIfMatch(ifMatch);
        store.update(ctx, STORE_ID, APPS_COLLECTION, childAppId, changesObj, expectedVersion, MergeStrategy.RFC_7396);
        JsonNode updated = store.get(ctx, STORE_ID, APPS_COLLECTION, childAppId).orElse(null);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_apps");

        int version = updated != null && updated.has("_version") ? updated.get("_version").asInt() : 1;
        return Response.ok(updated).header("ETag", "\"" + version + "\"").build();
    }

    @DELETE
    @Path("/{childAppId}")
    public Response delete(@PathParam("appId") String appId,
                           @PathParam("childAppId") String childAppId) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        AppAccessPolicy access = resolveAccess(appId);
        if (!access.write().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient write permissions")).build();
        }

        if (isStaticApp(childAppId)) {
            return Response.status(409).entity(Map.of("error", "Cannot delete static app: " + childAppId)).build();
        }

        DataContext ctx = new DataContext(STORE_ID);
        appRegistry.getStore().delete(ctx, STORE_ID, APPS_COLLECTION, childAppId);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_apps");
        return Response.noContent().build();
    }

    private AppAccessPolicy resolveAccess(String appId) {
        return appRegistry.getDescriptor(appId)
                          .map(AppDescriptor::access)
                          .orElse(AppAccessPolicy.DEFAULT);
    }

    private boolean isStaticApp(String childAppId) {
        DataContext ctx = new DataContext(STORE_ID);
        return appRegistry.getStore().get(ctx, STORE_ID, APPS_COLLECTION, childAppId)
                          .map(doc -> doc.has("source") && "static".equals(doc.get("source").asText()))
                          .orElse(false);
    }

    private void validateSchema(String appId, ObjectNode doc) {
        java.util.Optional<CollectionSchema> schema = appRegistry.getSchema(appId, APPS_COLLECTION);
        schema.ifPresent(s -> s.validate(doc));
    }


    private Response checkAppEnabled(String appId) {
        if (!appRegistry.isAppEnabled(appId)) {
            return Response.status(404)
                           .entity(Map.of("error", "App is disabled: " + appId)).build();
        }
        return null;
    }
}

