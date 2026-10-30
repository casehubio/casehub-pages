package io.casehub.pages.data;

public class MutationException extends RuntimeException {
    private final String code;

    public MutationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MutationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() { return code; }
}
