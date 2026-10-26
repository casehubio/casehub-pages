package io.casehub.pages.examples;

import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.stream.Stream;

@Path("/api/themes")
public class ThemeResource {

    @ConfigProperty(name = "casehub.pages.themes.directory", defaultValue = "themes")
    String themesDirectory;

    private java.nio.file.Path resolveThemeFile(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return null;
        }
        return java.nio.file.Path.of(themesDirectory).resolve(name + ".json");
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<String> list() throws IOException {
        java.nio.file.Path dir = java.nio.file.Path.of(themesDirectory);
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        try (Stream<java.nio.file.Path> files = Files.list(dir)) {
            return files
                    .filter(p -> p.toString().endsWith(".json"))
                    .map(p -> {
                        String fileName = p.getFileName().toString();
                        return fileName.substring(0, fileName.length() - 5);
                    })
                    .sorted()
                    .toList();
        }
    }

    @GET
    @Path("{name}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response load(@PathParam("name") String name) throws IOException {
        java.nio.file.Path file = resolveThemeFile(name);
        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        if (!Files.exists(file)) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        String content = Files.readString(file);
        return Response.ok(content, MediaType.APPLICATION_JSON).build();
    }

    @PUT
    @Path("{name}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response save(@PathParam("name") String name, String body) throws IOException {
        java.nio.file.Path file = resolveThemeFile(name);
        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        Files.createDirectories(file.getParent());
        Files.writeString(file, body);
        return Response.noContent().build();
    }

    @DELETE
    @Path("{name}")
    public Response remove(@PathParam("name") String name) throws IOException {
        java.nio.file.Path file = resolveThemeFile(name);
        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        Files.deleteIfExists(file);
        return Response.noContent().build();
    }
}
