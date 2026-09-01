package io.casehub.pages.terminal.runtime;

import io.casehub.pages.terminal.FifoRelay;
import io.casehub.pages.terminal.SessionLogger;
import io.casehub.pages.terminal.TmuxManager;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ConcurrentHashMap;

@WebSocket(path = "/ws/terminal/{id}/{cols}/{rows}")
public class TerminalWebSocket {

    @Inject TmuxManager tmux;
    @Inject TerminalRegistry registry;
    @Inject SessionLogger logger;

    private final ConcurrentHashMap<String, String> sessionNames = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> fifoPaths = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, WebSocketConnection> activeBySession = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        var sessionName = connection.pathParam("id");
        if (registry.get(sessionName).isEmpty()) {
            try { connection.closeAndAwait(); } catch (Exception ignored) {}
            return;
        }

        int cols = parsePathInt(connection.pathParam("cols"));
        int rows = parsePathInt(connection.pathParam("rows"));
        var fifoPath = "/tmp/pages-terminal-" + connection.id() + ".pipe";

        sessionNames.put(connection.id(), sessionName);

        var previous = activeBySession.put(sessionName, connection);
        if (previous != null && !previous.id().equals(connection.id())) {
            cleanup(previous);
            try {
                previous.closeAndAwait(new io.quarkus.websockets.next.CloseReason(4001, "session-takeover"));
            } catch (Exception ignored) {}
        }

        try {
            tmux.stopPipePane(sessionName);

            var mkfifo = new ProcessBuilder("mkfifo", fifoPath).redirectErrorStream(true).start();
            mkfifo.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            mkfifo.waitFor();
            fifoPaths.put(connection.id(), fifoPath);

            if (cols > 0 && rows > 0) {
                tmux.forceRedraw(sessionName, cols, rows);
            }

            Thread.ofVirtual().name("pages-fifo-" + sessionName).start(() -> {
                try {
                    new FifoRelay(
                            new FileInputStream(fifoPath),
                            text -> {
                                connection.sendTextAndAwait(text);
                                logger.append(sessionName, text);
                            }
                    ).relay();
                } catch (IOException e) {
                    // FIFO stream ended
                }
            });

            tmux.pipePaneToFifo(sessionName, fifoPath);

        } catch (IOException | InterruptedException e) {
            cleanup(connection);
            try { connection.closeAndAwait(); } catch (Exception ignored) {}
        }
    }

    @OnTextMessage
    public void onMessage(WebSocketConnection connection, String message) {
        var sessionName = sessionNames.get(connection.id());
        if (sessionName == null) return;
        try {
            tmux.sendKeys(sessionName, message);
        } catch (IOException | InterruptedException e) {
            // Send failure is non-fatal
        }
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        cleanup(connection);
    }

    private void cleanup(WebSocketConnection connection) {
        var sessionName = sessionNames.remove(connection.id());
        if (sessionName != null) {
            try { tmux.stopPipePane(sessionName); } catch (Exception ignored) {}
            activeBySession.remove(sessionName, connection);
        }
        var fifoPath = fifoPaths.remove(connection.id());
        if (fifoPath != null) {
            try { Files.deleteIfExists(Path.of(fifoPath)); } catch (Exception ignored) {}
        }
    }

    private static int parsePathInt(String value) {
        try { return value != null ? Integer.parseInt(value) : 0; }
        catch (NumberFormatException e) { return 0; }
    }
}
