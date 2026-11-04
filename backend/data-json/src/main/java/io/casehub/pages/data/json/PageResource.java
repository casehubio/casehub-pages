package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.CollectionSchema;
import io.casehub.pages.data.DataCacheService;
import io.casehub.pages.data.DataContext;
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

@Path("/api/apps/{appId}/pages")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PageResource {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String PAGES_COLLECTION = "_pages";
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

        var       docs   = appRegistry.getStore().listAll(STORE_ID, STORE_ID, PAGES_COLLECTION);
        ArrayNode result = MAPPER.createArrayNode();
        for (JsonNode doc : docs) {
            if (labelFilter != null && !ResourceUtils.matchesLabel(doc, labelFilter)) {continue;}
            ObjectNode meta = MAPPER.createObjectNode();
            ResourceUtils.copyIfPresent(doc, meta, "name");
            ResourceUtils.copyIfPresent(doc, meta, "description");
            ResourceUtils.copyIfPresent(doc, meta, "icon");
            ResourceUtils.copyIfPresent(doc, meta, "order");
            ResourceUtils.copyIfPresent(doc, meta, "author");
            ResourceUtils.copyIfPresent(doc, meta, "labels");
            ResourceUtils.copyIfPresent(doc, meta, "source");
            result.add(meta);
        }
        return Response.ok(result).build();
    }

    @GET
    @Path("/{name}")
    public Response get(@PathParam("appId") String appId,
                        @PathParam("name") String name) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        AppAccessPolicy access = resolveAccess(appId);
        if (!access.read().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient read permissions")).build();
        }

        DataContext ctx = new DataContext(STORE_ID);
        return appRegistry.getStore().get(ctx, STORE_ID, PAGES_COLLECTION, name)
                          .map(doc -> {
                              int version = doc.has("_version") ? doc.get("_version").asInt() : 1;
                              return Response.ok(doc).header("ETag", "\"" + version + "\"").build();
                          })
                          .orElse(Response.status(404).entity(Map.of("error", "Page not found: " + name)).build());
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

        String name = obj.has("name") ? obj.get("name").asText() : null;
        if (name == null || name.isBlank()) {
            return Response.status(400).entity(Map.of("error", "Page name is required")).build();
        }

        String yaml = obj.has("yaml") ? obj.get("yaml").asText() : null;
        if (yaml == null || yaml.isBlank()) {
            return Response.status(400).entity(Map.of("error", "Page yaml is required")).build();
        }

        try {
            PageYamlValidator.validate(yaml);
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        }

        validateSchema(appId, obj);

        String sluggedName = SlugUtils.slugify(name);
        if (isStaticPage(sluggedName)) {
            return Response.status(409).entity(Map.of("error", "Cannot override static page: " + name)).build();
        }

        DataContext         ctx     = new DataContext(STORE_ID);
        JsonCollectionStore store   = appRegistry.getStore();
        String              slug    = store.create(ctx, STORE_ID, PAGES_COLLECTION, obj, "name");
        JsonNode            created = store.get(ctx, STORE_ID, PAGES_COLLECTION, slug).orElse(null);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_pages");

        return Response.created(URI.create("/api/apps/" + appId + "/pages/" + slug))
                       .entity(created).build();
    }

    @PATCH
    @Path("/{name}")
    public Response update(@PathParam("appId") String appId,
                           @PathParam("name") String name,
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

        if (isStaticPage(name)) {
            return Response.status(409).entity(Map.of("error", "Static pages are immutable: " + name)).build();
        }

        if (changesObj.has("yaml")) {
            try {
                PageYamlValidator.validate(changesObj.get("yaml").asText());
            } catch (IllegalArgumentException e) {
                return Response.status(400).entity(Map.of("error", e.getMessage())).build();
            }
        }

        validateSchema(appId, changesObj);

        DataContext         ctx             = new DataContext(STORE_ID);
        JsonCollectionStore store           = appRegistry.getStore();
        OptionalInt         expectedVersion = ResourceUtils.parseIfMatch(ifMatch);
        store.update(ctx, STORE_ID, PAGES_COLLECTION, name, changesObj, expectedVersion, MergeStrategy.RFC_7396);
        JsonNode updated = store.get(ctx, STORE_ID, PAGES_COLLECTION, name).orElse(null);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_pages");

        int version = updated != null && updated.has("_version") ? updated.get("_version").asInt() : 1;
        return Response.ok(updated).header("ETag", "\"" + version + "\"").build();
    }

    @DELETE
    @Path("/{name}")
    public Response delete(@PathParam("appId") String appId,
                           @PathParam("name") String name) {
        Response gate = checkAppEnabled(appId);
        if (gate != null) return gate;
        AppAccessPolicy access = resolveAccess(appId);
        if (!access.write().isSatisfiedBy(ResourceUtils.extractRoles(jwt))) {
            return Response.status(403).entity(Map.of("error", "Insufficient write permissions")).build();
        }

        if (isStaticPage(name)) {
            return Response.status(409).entity(Map.of("error", "Cannot delete static page: " + name)).build();
        }

        DataContext ctx = new DataContext(STORE_ID);
        appRegistry.getStore().delete(ctx, STORE_ID, PAGES_COLLECTION, name);
        cacheService.invalidate(STORE_ID, "json:" + appId + "/_pages");
        return Response.noContent().build();
    }

    private AppAccessPolicy resolveAccess(String appId) {
        return appRegistry.getDescriptor(appId)
            .map(AppDescriptor::access)
            .orElse(AppAccessPolicy.DEFAULT);
    }

    private boolean isStaticPage(String name) {
        DataContext ctx = new DataContext(STORE_ID);
        return appRegistry.getStore().get(ctx, STORE_ID, PAGES_COLLECTION, name)
                          .map(doc -> doc.has("source") && "static".equals(doc.get("source").asText()))
                          .orElse(false);
    }

    private void validateSchema(String appId, ObjectNode doc) {
        java.util.Optional<CollectionSchema> schema = appRegistry.getSchema(appId, PAGES_COLLECTION);
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

