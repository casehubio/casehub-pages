package io.casehub.pages.examples;

import com.fasterxml.jackson.databind.JsonNode;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.MutableDataProvider;
import io.casehub.pages.data.MutationException;
import io.casehub.pages.data.json.AppRegistry;
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

import java.net.URI;
import java.util.Map;
import java.util.OptionalInt;

@Path("/api/apps/{appId}/{collection}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DemoCollectionResource {

    @Inject
    @Any
    Instance<MutableDataProvider> providers;

    @Inject
    AppRegistry registry;

    @POST
    public Response create(@PathParam("appId") String appId,
                           @PathParam("collection") String collection,
                           @QueryParam("slugField") @DefaultValue("title") String slugField,
                           JsonNode document) {
        DataContext ctx = new DataContext(appId);
        MutableDataProvider provider = resolveProvider(appId, collection);
        if (provider == null) return noProviderResponse(appId, collection);

        registry.ensureSeeded(ctx, appId, collection);
        String slug = provider.create(ctx, collection, document, slugField);

        JsonNode created = provider.get(ctx, collection, slug).orElse(null);
        int version = created != null && created.has("_version")
            ? created.get("_version").asInt() : 1;

        return Response.created(URI.create("/api/apps/" + appId + "/" + collection + "/" + slug))
            .entity(created)
            .header("ETag", "\"" + version + "\"")
            .build();
    }

    @GET
    public Response list(@PathParam("appId") String appId,
                         @PathParam("collection") String collection) {
        DataContext ctx = new DataContext(appId);
        MutableDataProvider provider = resolveProvider(appId, collection);
        if (provider == null) return noProviderResponse(appId, collection);

        registry.ensureSeeded(ctx, appId, collection);

        var lookup = new io.casehub.pages.data.DataSetLookup(
            "json:" + appId + "/" + collection,
            java.util.List.of(), null);
        var result = provider.query(lookup);

        var ds = result.result();
        var docs = new java.util.ArrayList<java.util.Map<String, String>>();
        for (var row : ds.rows()) {
            var doc = new java.util.LinkedHashMap<String, String>();
            for (int i = 0; i < ds.columns().size(); i++) {
                doc.put(ds.columns().get(i).id(), row.get(i));
            }
            docs.add(doc);
        }
        return Response.ok(docs).build();
    }

    @GET
    @Path("/{id}")
    public Response get(@PathParam("appId") String appId,
                        @PathParam("collection") String collection,
                        @PathParam("id") String id) {
        DataContext ctx = new DataContext(appId);
        MutableDataProvider provider = resolveProvider(appId, collection);
        if (provider == null) return noProviderResponse(appId, collection);

        registry.ensureSeeded(ctx, appId, collection);

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
        DataContext ctx = new DataContext(appId);
        MutableDataProvider provider = resolveProvider(appId, collection);
        if (provider == null) return noProviderResponse(appId, collection);

        OptionalInt expectedVersion = parseIfMatch(ifMatch);
        provider.update(ctx, collection, id, changes, expectedVersion);

        JsonNode updated = provider.get(ctx, collection, id).orElse(null);
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
        DataContext ctx = new DataContext(appId);
        MutableDataProvider provider = resolveProvider(appId, collection);
        if (provider == null) return noProviderResponse(appId, collection);

        if (provider.hasReferences(ctx, collection, id)) {
            throw new MutationException("REF_DELETE_BLOCKED",
                "Document is referenced by other documents");
        }

        provider.delete(ctx, collection, id);
        return Response.noContent().build();
    }

    private MutableDataProvider resolveProvider(String appId, String collection) {
        String dataSetId = "json:" + appId + "/" + collection;
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

    private Response noProviderResponse(String appId, String collection) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(Map.of("error", "No provider found for: " + appId + "/" + collection))
            .build();
    }
}
