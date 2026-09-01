package io.casehub.pages.terminal.runtime;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.Map;

@Path("/api/terminals")
@Produces(MediaType.APPLICATION_JSON)
public class TerminalResource {

    @Inject TerminalRegistry registry;

    @GET
    public Response list() {
        return Response.ok(registry.list()).build();
    }

    @GET @Path("/{name}")
    public Response get(@PathParam("name") String name) {
        return registry.get(name)
                .map(t -> Response.ok(t).build())
                .orElse(Response.status(404).entity(Map.of("error", "not found: " + name)).build());
    }

    @POST @Consumes(MediaType.APPLICATION_JSON)
    public Response create(CreateRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            return Response.status(400).entity(Map.of("error", "name is required")).build();
        }
        try {
            registry.createSession(request.name(), request.workingDir() != null ? request.workingDir() : "/tmp");
            return Response.status(201).entity(registry.get(request.name()).orElseThrow()).build();
        } catch (IllegalStateException e) {
            return Response.status(409).entity(Map.of("error", "already exists: " + request.name())).build();
        } catch (IOException | InterruptedException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @DELETE @Path("/{name}")
    public Response destroy(@PathParam("name") String name) {
        if (registry.get(name).isEmpty()) {
            return Response.status(404).entity(Map.of("error", "not found: " + name)).build();
        }
        try {
            registry.destroySession(name);
            return Response.noContent().build();
        } catch (IOException | InterruptedException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST @Path("/{name}/input") @Consumes(MediaType.TEXT_PLAIN)
    public Response sendInput(@PathParam("name") String name, String text) {
        if (registry.get(name).isEmpty()) {
            return Response.status(404).entity(Map.of("error", "not found: " + name)).build();
        }
        try {
            registry.sendKeys(name, text);
            return Response.noContent().build();
        } catch (IOException | InterruptedException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST @Path("/{name}/resize") @Consumes(MediaType.APPLICATION_JSON)
    public Response resize(@PathParam("name") String name, ResizeRequest request) {
        if (registry.get(name).isEmpty()) {
            return Response.status(404).entity(Map.of("error", "not found: " + name)).build();
        }
        try {
            registry.resize(name, request.cols(), request.rows());
            return Response.noContent().build();
        } catch (IOException | InterruptedException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    public record CreateRequest(String name, String workingDir) {}
    public record ResizeRequest(int cols, int rows) {}
}
