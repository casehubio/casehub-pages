package io.casehub.pages.playbook.runtime;

import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

@Path("/playbook/activations")
@Produces(MediaType.APPLICATION_JSON)
public class ActivationResource {

    @Inject
    TriggerDispatcher dispatcher;

    @GET
    public List<ActivationRecord> recent(
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return dispatcher.activationLog().recent(limit);
    }

    @GET
    @Path("/{playbook}")
    public List<ActivationRecord> forPlaybook(
            @PathParam("playbook") String playbook,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return dispatcher.activationLog().forPlaybook(playbook, limit);
    }
}
