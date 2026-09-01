package io.casehub.pages.terminal.runtime;

import io.casehub.pages.terminal.SessionLogger;
import io.casehub.pages.terminal.TmuxManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TerminalRegistryTest {

    private static final String TEST_SESSION = "test-pages-registry";

    private final TmuxManager tmux = new TmuxManager("test-pages-");

    @AfterEach
    void cleanup() throws Exception {
        if (tmux.hasSession(TEST_SESSION)) tmux.killSession(TEST_SESSION);
    }

    @Test
    void list_empty_on_creation(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        var registry = new TerminalRegistry(tmux, logger);
        assertThat(registry.list()).isEmpty();
    }

    @Test
    void get_returns_empty_for_unknown(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        var registry = new TerminalRegistry(tmux, logger);
        assertThat(registry.get("nonexistent")).isEmpty();
    }

    @Test
    void createSession_registers_and_creates_tmux(@TempDir Path tmpDir) throws Exception {
        var logger = new SessionLogger(tmpDir);
        var registry = new TerminalRegistry(tmux, logger);
        registry.createSession(TEST_SESSION, System.getProperty("user.home"));
        assertThat(registry.get(TEST_SESSION)).isPresent();
        assertThat(registry.list()).hasSize(1);
        assertThat(tmux.hasSession(TEST_SESSION)).isTrue();
    }

    @Test
    void createSession_duplicate_throws_ISE(@TempDir Path tmpDir) throws Exception {
        var logger = new SessionLogger(tmpDir);
        var registry = new TerminalRegistry(tmux, logger);
        registry.createSession(TEST_SESSION, System.getProperty("user.home"));
        assertThatThrownBy(() -> registry.createSession(TEST_SESSION, "/tmp"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(TEST_SESSION);
    }

    @Test
    void destroySession_removes_from_registry_and_tmux(@TempDir Path tmpDir) throws Exception {
        var logger = new SessionLogger(tmpDir);
        var registry = new TerminalRegistry(tmux, logger);
        registry.createSession(TEST_SESSION, System.getProperty("user.home"));
        logger.append(TEST_SESSION, "some output");
        registry.destroySession(TEST_SESSION);
        assertThat(registry.get(TEST_SESSION)).isEmpty();
        assertThat(registry.list()).isEmpty();
        assertThat(tmux.hasSession(TEST_SESSION)).isFalse();
        assertThat(logger.tailLines(TEST_SESSION, 10)).isEmpty();
    }

    @Test
    void bootstrap_discovers_existing_tmux_sessions(@TempDir Path tmpDir) throws Exception {
        var logger = new SessionLogger(tmpDir);
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        var registry = new TerminalRegistry(tmux, logger);
        registry.bootstrap();
        assertThat(registry.get(TEST_SESSION)).isPresent();
    }
}
