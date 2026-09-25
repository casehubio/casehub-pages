package io.casehub.pages.data;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.Map;

@Provider
public class DataQueryExceptionMapper implements ExceptionMapper<DataQueryException> {
    @Override
    public Response toResponse(DataQueryException e) {
        Response.Status status = switch (e.code()) {
            case "INVALID_QUERY" -> Response.Status.BAD_REQUEST;
            case "RESULT_TOO_LARGE" -> Response.Status.fromStatusCode(413);
            case "FETCH_FAILED" -> Response.Status.fromStatusCode(502);
            default -> Response.Status.INTERNAL_SERVER_ERROR;
        };
        return Response.status(status)
            .entity(Map.of("error", e.getMessage(), "code", e.code()))
            .type(MediaType.APPLICATION_JSON)
            .build();
    }
}
