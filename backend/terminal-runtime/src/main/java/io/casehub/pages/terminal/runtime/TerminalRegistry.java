package io.casehub.pages.terminal.runtime;

import io.casehub.pages.terminal.SessionLogger;
import io.casehub.pages.terminal.TerminalSession;
import io.casehub.pages.terminal.TmuxManager;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class TerminalRegistry {

    private final TmuxManager tmux;
    private final SessionLogger logger;
    private final ConcurrentHashMap<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    @Inject
    public TerminalRegistry(TmuxManager tmux, SessionLogger logger) {
        this.tmux = tmux;
        this.logger = logger;
    }

    void onStart(@jakarta.enterprise.event.Observes io.quarkus.runtime.StartupEvent event) {
        bootstrap();
    }

    public void createSession(String name, String workingDir)
            throws IOException, InterruptedException {
        var session = new TerminalSession(name, workingDir);
        if (sessions.putIfAbsent(name, session) != null) {
            throw new IllegalStateException("Terminal already exists: " + name);
        }
        try {
            tmux.createSession(name, workingDir);
        } catch (IOException | InterruptedException e) {
            sessions.remove(name);
            throw e;
        }
    }

    public void destroySession(String name) throws IOException, InterruptedException {
        tmux.killSession(name);
        sessions.remove(name);
        logger.delete(name);
    }

    public void sendKeys(String name, String text) throws IOException, InterruptedException {
        tmux.sendKeys(name, text);
    }

    public void resize(String name, int cols, int rows) throws IOException, InterruptedException {
        tmux.resizeWindow(name, cols, rows);
    }

    public Optional<TerminalSession> get(String name) {
        return Optional.ofNullable(sessions.get(name));
    }

    public List<TerminalSession> list() {
        return List.copyOf(sessions.values());
    }

    public void bootstrap() {
        try {
            for (String name : tmux.listSessions()) {
                sessions.put(name, new TerminalSession(name, null));
            }
        } catch (IOException | InterruptedException e) {
            // Bootstrap failure is non-fatal
        }
    }
}
