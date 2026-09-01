package io.casehub.pages.terminal;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

public class FifoRelay {

    private final InputStream input;
    private final Consumer<String> sink;
    private boolean skipInitialNewline = true;

    public FifoRelay(InputStream input, Consumer<String> sink) {
        this.input = input;
        this.sink = sink;
    }

    public void relay() throws IOException {
        try (var reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8), 4096)) {
            var cbuf = new char[4096];
            int n;
            while ((n = reader.read(cbuf)) != -1) {
                int start = 0;
                if (skipInitialNewline) {
                    skipInitialNewline = false;
                    if (n > 0 && cbuf[0] == '\r') start++;
                    if (start < n && cbuf[start] == '\n') start++;
                    if (start >= n) continue;
                }
                sink.accept(new String(cbuf, start, n - start));
            }
        }
    }
}
