package io.casehub.pages.terminal.runtime;

import io.casehub.pages.terminal.SessionLogger;
import io.casehub.pages.terminal.TmuxManager;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.nio.file.Path;

@ApplicationScoped
public class TerminalProducers {

    @Produces
    @DefaultBean
    @ApplicationScoped
    public TmuxManager tmuxManager(
            @ConfigProperty(name = "casehub.pages.terminal.prefix", defaultValue = "pages-") String prefix) {
        return new TmuxManager(prefix);
    }

    @Produces
    @DefaultBean
    @ApplicationScoped
    public SessionLogger sessionLogger(
            @ConfigProperty(name = "casehub.pages.terminal.log-dir",
                    defaultValue = "${java.io.tmpdir}/pages-terminal-sessions") Path logDir) {
        return new SessionLogger(logDir);
    }
}
