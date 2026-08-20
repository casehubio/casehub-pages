package io.casehub.pages.push.runtime;

import io.casehub.pages.push.PushRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

class CdiCommandResultHandlerTest {

    @Test
    void handleDelegatesToEventSink() {
        var captured = new ArrayList<PushRequest.CommandResult>();
        var handler = new CdiCommandResultHandler(captured::add);

        handler.handle(new PushRequest.CommandResult("cmd-1", true, null));

        assertThat(captured).hasSize(1);
        assertThat(captured.getFirst().id()).isEqualTo("cmd-1");
        assertThat(captured.getFirst().ok()).isTrue();
    }

    @Test
    void handleForwardsErrorResult() {
        var captured = new ArrayList<PushRequest.CommandResult>();
        var handler = new CdiCommandResultHandler(captured::add);

        handler.handle(new PushRequest.CommandResult("cmd-2", false, "Element not found"));

        assertThat(captured).hasSize(1);
        assertThat(captured.getFirst().ok()).isFalse();
        assertThat(captured.getFirst().error()).isEqualTo("Element not found");
    }
}
