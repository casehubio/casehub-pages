package io.casehub.pages.terminal;

import java.time.Instant;

public record TerminalSession(String name, String workingDir, Instant createdAt) {
    public TerminalSession(String name, String workingDir) {
        this(name, workingDir, Instant.now());
    }
}
