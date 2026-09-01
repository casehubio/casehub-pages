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

    @Test
    void tailLinesWithOffset_skipsTrailingLines(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "line1\nline2\nline3\nline4\nline5\n");
        assertThat(logger.tailLinesWithOffset("test", 2, 1)).isEqualTo("line3\nline4\n");
    }

    @Test
    void tailLinesWithOffset_zero_offset_matches_tailLines(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "aaa\nbbb\nccc\n");
        assertThat(logger.tailLinesWithOffset("test", 2, 0))
                .isEqualTo(logger.tailLines("test", 2));
    }

    @Test
    void tailLinesWithOffset_large_offset_returns_empty(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "line1\nline2\n");
        assertThat(logger.tailLinesWithOffset("test", 2, 10)).isEmpty();
    }

    @Test
    void multiple_appends_then_tail(@TempDir Path tmpDir) {
        var logger = new SessionLogger(tmpDir);
        logger.append("test", "chunk1\n");
        logger.append("test", "chunk2\n");
        logger.append("test", "chunk3\n");
        assertThat(logger.tailLines("test", 3)).isEqualTo("chunk1\nchunk2\nchunk3\n");
    }
}
