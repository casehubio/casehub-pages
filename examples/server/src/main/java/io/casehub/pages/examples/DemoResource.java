package io.casehub.pages.examples;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;

@Path("/api/demo")
@Produces(MediaType.APPLICATION_JSON)
public class DemoResource {

    @Inject EventBroadcaster broadcaster;
    @Inject EventStore eventStore;

    @GET
    @Path("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "storeType", "jdbc");
    }

    @GET
    @Path("/info")
    public Map<String, Object> info() {
        var topics = eventStore.topics();
        long totalEvents = 0;
        for (String topic : topics) {
            var events = eventStore.replay(topic, 0, Integer.MAX_VALUE);
            totalEvents += events.size();
        }
        return Map.of(
            "storeType", "jdbc",
            "topicCount", topics.size(),
            "totalEvents", totalEvents,
            "topics", topics
        );
    }

    @POST
    @Path("/generate")
    public Map<String, Object> generate(
            @QueryParam("topic") @DefaultValue("demo:events") String topic,
            @QueryParam("count") @DefaultValue("10") int count) {
        for (int i = 0; i < count; i++) {
            broadcaster.broadcast(topic,
                String.format("{\"burst\":true,\"index\":%d,\"total\":%d}", i + 1, count));
        }
        return Map.of("generated", count, "topic", topic);
    }
}
