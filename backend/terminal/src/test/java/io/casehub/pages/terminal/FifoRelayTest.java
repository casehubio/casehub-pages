package io.casehub.pages.terminal;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class FifoRelayTest {

    @Test
    void relay_delivers_text_to_sink() throws Exception {
        var input = new ByteArrayInputStream("hello world".getBytes(StandardCharsets.UTF_8));
        List<String> received = new ArrayList<>();
        new FifoRelay(input, received::add).relay();
        assertThat(String.join("", received)).isEqualTo("hello world");
    }

    @Test
    void relay_skips_initial_newline() throws Exception {
        var input = new ByteArrayInputStream("\r\nhello".getBytes(StandardCharsets.UTF_8));
        List<String> received = new ArrayList<>();
        new FifoRelay(input, received::add).relay();
        assertThat(String.join("", received)).isEqualTo("hello");
    }

    @Test
    void relay_handles_empty_input() throws Exception {
        var input = new ByteArrayInputStream(new byte[0]);
        List<String> received = new ArrayList<>();
        new FifoRelay(input, received::add).relay();
        assertThat(received).isEmpty();
    }
}
