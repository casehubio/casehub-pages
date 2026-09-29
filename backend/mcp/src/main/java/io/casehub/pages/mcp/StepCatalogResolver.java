package io.casehub.pages.mcp;

import io.casehub.pages.scenario.runtime.CatalogActionDetail;
import io.casehub.pages.scenario.runtime.CatalogActionSummary;
import io.casehub.pages.scenario.runtime.StepCatalogService;
import io.casehub.platform.api.mcp.McpDomain;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Query;

import java.util.List;

@McpDomain("step-catalog")
@GraphQLApi
@ApplicationScoped
public class StepCatalogResolver {

    @Inject
    StepCatalogService catalog;

    @Query("catalogActions")
    public List<CatalogActionSummary> actions() {
        return catalog.listActions();
    }

    @Query("catalogAction")
    public CatalogActionDetail action(String name) {
        return catalog.getAction(name).orElse(null);
    }
}
