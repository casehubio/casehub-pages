package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
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
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.net.URI;
import java.util.Map;
import java.util.OptionalInt;

@Path("/api/collections/{appId}/{collection}")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CollectionResource {

    @Inject
    JsonWebToken jwt;

    @ConfigProperty(name = "casehub.pages.data.tenant-claim", defaultValue = "tenant_id")
    String tenantClaim;

    @Inject
    @Any
    Instance<MutableDataProvider> providers;

    @Inject
    DataCacheService cacheService;

    @POST
    public Response create(@PathParam("appId") String appId,
                           @PathParam("collection") String collection,
                           @QueryParam("slugField") @DefaultValue("title") String slugField,
                           JsonNode document) {
        String tenantId = extractTenant();
        if (tenantId == null) return missingTenantResponse();

        DataContext ctx = new DataContext(tenantId);
        String dataSetId = dataSetId(appId, collection);
        MutableDataProvider provider = resolveProvider(dataSetId);
        if (provider == null) return noProviderResponse(dataSetId);

        String slug = provider.create(ctx, collection, document, slugField);

        JsonNode created = provider.get(ctx, collection, slug).orElse(null);
        cacheService.invalidate(tenantId, dataSetId);

        int version = created != null && created.has("_version")
            ? created.get("_version").asInt() : 1;

        return Response.created(URI.create("/api/collections/" + appId + "/" + collection + "/" + slug))
            .entity(created)
            .header("ETag", "\"" + version + "\"")
            .build();
    }

    @GET
    @Path("/{id}")
    public Response get(@PathParam("appId") String appId,
                        @PathParam("collection") String collection,
                        @PathParam("id") String id) {
        String tenantId = extractTenant();
        if (tenantId == null) return missingTenantResponse();

        DataContext ctx = new DataContext(tenantId);
        String dataSetId = dataSetId(appId, collection);
        MutableDataProvider provider = resolveProvider(dataSetId);
        if (provider == null) return noProviderResponse(dataSetId);

        return provider.get(ctx, collection, id)
            .map(doc -> {
                int version = doc.has("_version") ? doc.get("_version").asInt() : 1;
                return Response.ok(doc)
                    .header("ETag", "\"" + version + "\"")
                    .build();
            })
            .orElseThrow(() -> new MutationException("NOT_FOUND", "Not found"));
    }

    @PATCH
    @Path("/{id}")
    public Response update(@PathParam("appId") String appId,
                           @PathParam("collection") String collection,
                           @PathParam("id") String id,
                           @HeaderParam("If-Match") String ifMatch,
                           JsonNode changes) {
        String tenantId = extractTenant();
        if (tenantId == null) return missingTenantResponse();

        DataContext ctx = new DataContext(tenantId);
        String dataSetId = dataSetId(appId, collection);
        MutableDataProvider provider = resolveProvider(dataSetId);
        if (provider == null) return noProviderResponse(dataSetId);

        OptionalInt expectedVersion = parseIfMatch(ifMatch);
        provider.update(ctx, collection, id, changes, expectedVersion);

        JsonNode updated = provider.get(ctx, collection, id).orElse(null);
        cacheService.invalidate(tenantId, dataSetId);

        int version = updated != null && updated.has("_version")
            ? updated.get("_version").asInt() : 1;

        return Response.ok(updated)
            .header("ETag", "\"" + version + "\"")
            .build();
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("appId") String appId,
                           @PathParam("collection") String collection,
                           @PathParam("id") String id) {
        String tenantId = extractTenant();
        if (tenantId == null) return missingTenantResponse();

        DataContext ctx = new DataContext(tenantId);
        String dataSetId = dataSetId(appId, collection);
        MutableDataProvider provider = resolveProvider(dataSetId);
        if (provider == null) return noProviderResponse(dataSetId);

        if (provider.hasReferences(ctx, collection, id)) {
            throw new MutationException("REF_DELETE_BLOCKED",
                "Document is referenced by other documents");
        }

        provider.delete(ctx, collection, id);
        cacheService.invalidate(tenantId, dataSetId);

        return Response.noContent().build();
    }

    private static String dataSetId(String appId, String collection) {
        return "json:" + appId + "/" + collection;
    }

    private MutableDataProvider resolveProvider(String dataSetId) {
        for (MutableDataProvider p : providers) {
            if (p.canHandle(dataSetId)) return p;
        }
        return null;
    }

    private static OptionalInt parseIfMatch(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) return OptionalInt.empty();
        String stripped = ifMatch.replace("\"", "").trim();
        try {
            return OptionalInt.of(Integer.parseInt(stripped));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    private String extractTenant() {
        Object claim = jwt.getClaim(tenantClaim);
        return claim != null ? claim.toString() : null;
    }

    private Response missingTenantResponse() {
        return Response.status(Response.Status.UNAUTHORIZED)
            .entity(Map.of("error", "Missing claim: " + tenantClaim))
            .build();
    }

    private Response noProviderResponse(String dataSetId) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(Map.of("error", "No provider found for dataset: " + dataSetId))
            .build();
    }
}
