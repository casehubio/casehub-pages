package io.casehub.pages.examples;

import io.casehub.pages.data.DataProvider;
import io.casehub.pages.data.DataQueryException;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.QueryResult;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

@Path("/api/demo")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DemoQueryResource {

    @Inject
    @Any
    Instance<DataProvider> providers;

    @POST
    @Path("/query")
    public Response query(DataSetLookup lookup) {
        DataProvider provider = null;
        for (DataProvider p : providers) {
            if (p.canHandle(lookup.dataSetId())) {
                provider = p;
                break;
            }
        }

        if (provider == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", "No provider for dataset: " + lookup.dataSetId()))
                .build();
        }

        try {
            QueryResult result = provider.query(lookup);
            return Response.ok(result).build();
        } catch (DataQueryException e) {
            Response.Status status = switch (e.code()) {
                case "INVALID_QUERY" -> Response.Status.BAD_REQUEST;
                case "RESULT_TOO_LARGE" -> Response.Status.fromStatusCode(413);
                case "FETCH_FAILED" -> Response.Status.fromStatusCode(502);
                default -> Response.Status.INTERNAL_SERVER_ERROR;
            };
            return Response.status(status)
                .entity(Map.of("error", e.getMessage(), "code", e.code()))
                .build();
        }
    }
}
