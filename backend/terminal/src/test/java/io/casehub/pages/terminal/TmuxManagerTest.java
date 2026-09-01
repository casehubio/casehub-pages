package io.casehub.pages.terminal;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;

class TmuxManagerTest {

    private static final String TEST_SESSION = "test-pages-tmux";
    private final TmuxManager tmux = new TmuxManager("test-pages-");

    @AfterEach
    void cleanup() throws Exception {
        if (tmux.hasSession(TEST_SESSION)) tmux.killSession(TEST_SESSION);
    }

    @Test
    void sessionDoesNotExistBeforeCreation() throws Exception {
        assertThat(tmux.hasSession(TEST_SESSION)).isFalse();
    }

    @Test
    void createAndKillSession() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        assertThat(tmux.hasSession(TEST_SESSION)).isTrue();
        tmux.killSession(TEST_SESSION);
        assertThat(tmux.hasSession(TEST_SESSION)).isFalse();
    }

    @Test
    void listSessionsIncludesCreatedSession() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        assertThat(tmux.listSessions()).contains(TEST_SESSION);
    }

    @Test
    void capturePaneReturnsOutput() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        tmux.sendKeys(TEST_SESSION, "echo tmux-capture-marker\n");
        awaitUntil(() -> {
            try { return tmux.capturePane(TEST_SESSION, 20).contains("tmux-capture-marker"); }
            catch (Exception e) { return false; }
        }, "tmux-capture-marker to appear in pane output");
    }

    @Test
    void setAndGetOption_roundTrips() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        tmux.setOption(TEST_SESSION, "@pages_test_key", "test-value-42");
        var result = tmux.getOption(TEST_SESSION, "@pages_test_key");
        assertThat(result).isPresent().hasValue("test-value-42");
    }

    @Test
    void getOption_returnsEmpty_whenKeyAbsent() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        var result = tmux.getOption(TEST_SESSION, "@nonexistent_key");
        assertThat(result).isEmpty();
    }

    @Test
    void sendKeysLiteralModeDoesNotInterpretTmuxKeyNames() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        tmux.sendKeys(TEST_SESSION, "echo literal-test-Escape\n");
        awaitUntil(() -> {
            try { return tmux.capturePane(TEST_SESSION, 20).contains("literal-test-Escape"); }
            catch (Exception e) { return false; }
        }, "literal 'Escape' text to appear in pane (not interpreted as key)");
    }

    @Test
    void resizeWindowChangesPane() throws Exception {
        tmux.createSession(TEST_SESSION, System.getProperty("user.home"));
        tmux.resizeWindow(TEST_SESSION, 120, 40);
        // No exception means success; tmux accepted the resize
        assertThat(tmux.hasSession(TEST_SESSION)).isTrue();
    }

    private static void awaitUntil(BooleanSupplier condition, String message) {
        long deadline = System.currentTimeMillis() + Duration.ofSeconds(3).toMillis();
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) return;
            try { Thread.sleep(50); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError("Interrupted: " + message, e);
            }
        }
        throw new AssertionError("Timed out after 3s: " + message);
    }
}
