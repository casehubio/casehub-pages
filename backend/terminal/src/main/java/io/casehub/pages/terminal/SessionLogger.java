package io.casehub.pages.terminal;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

public class SessionLogger {

    private final Path sessionsDir;

    public SessionLogger(Path sessionsDir) {
        this.sessionsDir = sessionsDir;
        try {
            Files.createDirectories(sessionsDir);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void append(String terminalName, String text) {
        try {
            Files.writeString(logPath(terminalName), text,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            // Log write failure is non-fatal
        }
    }

    public String tailLines(String terminalName, int lines) {
        return tailLinesWithOffset(terminalName, lines, 0);
    }

    public String tailLinesWithOffset(String terminalName, int lines, int offset) {
        var path = logPath(terminalName);
        if (!Files.exists(path)) return "";

        try (var raf = new RandomAccessFile(path.toFile(), "r")) {
            long fileLength = raf.length();
            if (fileLength == 0) return "";

            int totalLines = lines + offset;
            int newlinesFound = 0;
            long pos = fileLength - 1;

            raf.seek(pos);
            if (raf.readByte() == '\n') pos--;

            while (pos > 0 && newlinesFound < totalLines) {
                raf.seek(pos);
                if (raf.readByte() == '\n') newlinesFound++;
                pos--;
            }

            long startPos;
            if (pos == 0 && newlinesFound < totalLines) {
                raf.seek(0);
                if (raf.readByte() == '\n') newlinesFound++;
                startPos = (newlinesFound >= totalLines) ? 1 : 0;
            } else {
                startPos = pos + 2;
            }

            long endPos = fileLength;
            if (offset > 0) {
                int skipLines = 0;
                long ep = fileLength - 1;
                raf.seek(ep);
                if (raf.readByte() == '\n') ep--;
                while (ep > startPos && skipLines < offset) {
                    raf.seek(ep);
                    if (raf.readByte() == '\n') skipLines++;
                    ep--;
                }
                endPos = ep + 2;
            }

            int len = (int) (endPos - startPos);
            if (len <= 0) return "";
            raf.seek(startPos);
            byte[] buf = new byte[len];
            raf.readFully(buf);
            return new String(buf);
        } catch (IOException e) {
            return "";
        }
    }

    public Path logPath(String terminalName) {
        return sessionsDir.resolve(terminalName + ".log");
    }

    public void delete(String terminalName) {
        try {
            Files.deleteIfExists(logPath(terminalName));
        } catch (IOException e) {
            // Delete failure is non-fatal
        }
    }
}
