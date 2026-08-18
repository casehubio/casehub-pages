package io.casehub.pages.mcp;

import io.casehub.platform.api.mcp.McpDomain;
import io.casehub.platform.api.mcp.ModelEnricher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.Map;

@McpDomain("aria")
@ApplicationScoped
public class AriaModelEnricher implements ModelEnricher {

    @Inject
    AriaCommandBridge bridge;

    @Override
    public String summary() {
        return "ARIA interaction model — find, click, fill, and assert UI elements by role and accessible name. "
             + "Commands are dispatched to the browser via push protocol and executed by the in-page ARIA executor.";
    }

    @Override
    public Map<String, Object> state() {
        return Map.of("pendingCommands", bridge.pendingCount());
    }
}
