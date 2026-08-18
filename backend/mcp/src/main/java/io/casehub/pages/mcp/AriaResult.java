package io.casehub.pages.mcp;

import io.casehub.pages.push.PushRequest;

public record AriaResult(boolean ok, String error) {

    static AriaResult from(PushRequest.CommandResult result) {
        return new AriaResult(result.ok(), result.error());
    }

    static AriaResult success() {
        return new AriaResult(true, null);
    }

    static AriaResult failure(String error) {
        return new AriaResult(false, error);
    }
}
