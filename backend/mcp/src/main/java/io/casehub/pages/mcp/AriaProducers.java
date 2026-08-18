package io.casehub.pages.mcp;

import io.casehub.pages.push.EventBroadcaster;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AriaProducers {

    @Produces
    @ApplicationScoped
    @DefaultBean
    AriaCommandBridge ariaCommandBridge(
            EventBroadcaster broadcaster,
            @ConfigProperty(name = "casehub.pages.aria.command-timeout-ms",
                            defaultValue = "10000") long timeoutMs) {
        return new AriaCommandBridge(broadcaster, timeoutMs);
    }
}
