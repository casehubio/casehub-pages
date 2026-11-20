package io.casehub.pages.push.runtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.push.EventBroadcaster;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/push/publish")
@Authenticated
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PushPublishResource {

    public record PublishResponse(long seq) {}

    @Inject
    EventBroadcaster broadcaster;

    @POST
    @Path("/{topic}")
    public PublishResponse publish(@PathParam("topic") String topic, String body) {
        if (body == null || body.isBlank()) {
            throw new BadRequestException("request body must not be empty");
        }
        try {
            new ObjectMapper().readTree(body);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("request body must be valid JSON");
        }
        try {
            long seq = broadcaster.broadcast(topic, body);
            return new PublishResponse(seq);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage());
        }
    }
}
