package io.casehub.pages.examples;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;

@Path("/api/playbooks")
public class PlaybookResource {

    @GET
    @Path("{path:.+}")
    public Response serve(@PathParam("path") String path) {
        if (path.contains("..")) {
            return Response.status(404).build();
        }
        String classpathPath = "/playbooks/" + path;
        try (InputStream stream = getClass().getResourceAsStream(classpathPath)) {
            if (stream == null) {
                return Response.status(404).build();
            }
            byte[] content = stream.readAllBytes();
            String contentType = path.endsWith(".json") ? "application/json" : "text/yaml";
            return Response.ok(content, contentType)
                    .header("Cache-Control", "max-age=300")
                    .build();
        } catch (IOException e) {
            return Response.serverError().build();
        }
    }
}
