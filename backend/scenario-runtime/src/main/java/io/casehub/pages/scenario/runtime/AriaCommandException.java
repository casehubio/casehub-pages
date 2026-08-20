package io.casehub.pages.scenario.runtime;

public class AriaCommandException extends RuntimeException {

    public AriaCommandException(String message) {
        super(message);
    }

    public AriaCommandException(String message, Throwable cause) {
        super(message, cause);
    }
}
