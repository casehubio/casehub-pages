package io.casehub.pages.playbook.runtime;

import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;

@Path("/playbook")
public class PlaybookControlResource {

    @Inject
    PlaybookOrchestrator orchestrator;

    public record StartRequest(String yaml, boolean paused,
                               String callbackUrl, String dispatchId,
                               String callbackToken) {}
    public record RunToRequest(String label) {}
    public record SpeedRequest(double speed) {}

    @POST
    @Path("/start")
    public PlaybookState start(StartRequest req) {
        if (req.callbackUrl() != null) {
            orchestrator.start(req.yaml(), req.paused(),
                req.callbackUrl(), req.dispatchId(), req.callbackToken());
        } else {
            orchestrator.start(req.yaml(), req.paused());
        }
        return orchestrator.state();
    }

    @POST
    @Path("/stop")
    public PlaybookState stop() {
        orchestrator.stop();
        return orchestrator.state();}

    @POST
    @Path("/pause")
    public PlaybookState pause() {
        orchestrator.pause();
        return orchestrator.state();
    }

    @POST
    @Path("/resume")
    public PlaybookState resume() {
        orchestrator.resume();
        return orchestrator.state();
    }

    @POST
    @Path("/step")
    public PlaybookState step() {
        orchestrator.step();
        return orchestrator.state();
    }

    @POST
    @Path("/run-to")
    public PlaybookState runTo(RunToRequest req) {
        var result = orchestrator.runTo(req.label());
        if (result == RunToResult.NOT_FOUND) {
            throw new NotFoundException("Label not found: " + req.label());
        }
        if (result == RunToResult.ALREADY_PAST) {
            throw new BadRequestException("Already past: " + req.label());
        }
        return orchestrator.state();
    }

    @POST
    @Path("/speed")
    public PlaybookState speed(SpeedRequest req) {
        orchestrator.speed(req.speed());
        return orchestrator.state();
    }

    @GET
    @Path("/state")
    public PlaybookState state() {
        return orchestrator.state();
    }

    @GET
    @Path("/outline")
    public java.util.List<io.casehub.pages.playbook.OutlineNode> outline() {
        var result = orchestrator.outline();
        if (result.isEmpty() && orchestrator.sessionId() == null) {
            throw new NotFoundException("No active playbook");
        }
        return result;
    }

    @GET
    @Path("/content")
    @jakarta.ws.rs.Produces("text/markdown")
    public String content(@jakarta.ws.rs.QueryParam("path") String path) {
        if (path == null || path.isBlank()) {
            throw new BadRequestException("path parameter required");
        }
        if (path.contains("..")) {
            throw new BadRequestException("path traversal not allowed");
        }
        var resource = Thread.currentThread().getContextClassLoader()
                             .getResourceAsStream("META-INF/resources/playbook/content/" + path);
        if (resource == null) {
            throw new NotFoundException("Content not found: " + path);
        }
        try (resource) {
            return new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException e) {
            throw new jakarta.ws.rs.InternalServerErrorException("Failed to read content", e);
        }
    }


}
