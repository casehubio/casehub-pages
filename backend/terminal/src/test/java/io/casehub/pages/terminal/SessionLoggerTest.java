package io.casehub.pages.terminal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;

class SessionLoggerTest {

    @Test
    void append_and_tail(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "line1\nline2\nline3\n");
        assertThat(logger.tailLines("test", 2)).isEqualTo("line2\nline3\n");
    }

    @Test
    void tail_empty_session(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        assertThat(logger.tailLines("nonexistent", 10)).isEmpty();
    }

    @Test
    void delete_removes_log(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "data");
        logger.delete("test");
        assertThat(logger.tailLines("test", 10)).isEmpty();
    }
}
