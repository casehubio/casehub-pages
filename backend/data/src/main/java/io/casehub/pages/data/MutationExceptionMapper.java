package io.casehub.pages.data;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.Map;

@Provider
public class MutationExceptionMapper implements ExceptionMapper<MutationException> {
    @Override
    public Response toResponse(MutationException e) {
        int status = switch (e.code()) {
            case "VALIDATION_ERROR" -> 422;
            case "VERSION_CONFLICT", "SLUG_CONFLICT", "REF_DELETE_BLOCKED" -> 409;
            case "NOT_FOUND" -> 404;
            case "DOC_TOO_LARGE", "COLLECTION_FULL", "TOO_MANY_COLLECTIONS" -> 413;
            case "STORAGE_ERROR" -> 500;
            default -> 500;
        };
        return Response.status(status)
            .entity(Map.of("error", e.getMessage(), "code", e.code()))
            .type(MediaType.APPLICATION_JSON)
            .build();
    }
}
