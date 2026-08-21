package io.casehub.pages.scenario.runtime;

import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;

@Path("/scenario")
public class ScenarioControlResource {

    @Inject
    ScenarioOrchestrator orchestrator;

    public record StartRequest(String yaml) {}
    public record RunToRequest(String label) {}
    public record SpeedRequest(double speed) {}

    @POST
    @Path("/start")
    public ScenarioState start(StartRequest req) {
        orchestrator.start(req.yaml());
        return orchestrator.state();
    }

    @POST
    @Path("/stop")
    public ScenarioState stop() {
        return orchestrator.state();
    }

    @POST
    @Path("/pause")
    public ScenarioState pause() {
        orchestrator.pause();
        return orchestrator.state();
    }

    @POST
    @Path("/resume")
    public ScenarioState resume() {
        orchestrator.resume();
        return orchestrator.state();
    }

    @POST
    @Path("/step")
    public ScenarioState step() {
        orchestrator.step();
        return orchestrator.state();
    }

    @POST
    @Path("/run-to")
    public ScenarioState runTo(RunToRequest req) {
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
    public ScenarioState speed(SpeedRequest req) {
        orchestrator.speed(req.speed());
        return orchestrator.state();
    }

    @GET
    @Path("/state")
    public ScenarioState state() {
        return orchestrator.state();
    }
}
