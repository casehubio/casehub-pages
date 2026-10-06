package io.casehub.pages.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.PushRequest;
import io.casehub.pages.push.TopicRegistry;
import io.casehub.pages.playbook.runtime.PlaybookOrchestrator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class PlaybookResolverTest {

    private PlaybookOrchestrator orchestrator;
    private PlaybookResolver resolver;

    @BeforeEach
    void setUp() {
        var sent = new ArrayList<String>();
        var sender = (io.casehub.pages.push.SessionSender) (connId, msg) -> sent.add(msg);
        var mapper = new ObjectMapper();
        var broadcaster = new EventBroadcaster(
                new InMemoryEventStore(100), new TopicRegistry(), sender,
                mapper::writeValueAsString);
        orchestrator = new PlaybookOrchestrator(sender, broadcaster);
        orchestrator.onExecutorRegister("conn-1",
            new PushRequest.ExecutorRegister("1", "browser", List.of("click", "ready")));
        orchestrator.onExecutorRegister("conn-2",
            new PushRequest.ExecutorRegister("2", "helpdesk",
                List.of("create-ticket", "verify-ticket")));

        resolver = new PlaybookResolver();
        try {
            var field = PlaybookResolver.class.getDeclaredField("orchestrator");
            field.setAccessible(true);
            field.set(resolver, orchestrator);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void submitStartsPlaybookAndReturnsState() {
        var yaml = """
            playbook: mcp-test
            steps:
              - label: "Click"
                target: browser
                commands:
                  - action: click
            """;
        var state = resolver.submit(yaml, null, null, null);
        assertThat(state.playbook()).isEqualTo("mcp-test");
        assertThat(state.progress()).isEqualTo(0.0);
    }

    @Test
    void statusReturnsCurrentState() {
        var state = resolver.status();
        assertThat(state.playbook()).isNull();

        resolver.submit("""
            playbook: status-test
            steps:
              - label: "Ready"
                target: browser
                commands:
                  - action: ready
            """, null, null, null);

        state = resolver.status();
        assertThat(state.playbook()).isEqualTo("status-test");
    }

    @Test
    void pauseAndResumeToggleState() {
        resolver.submit("""
            playbook: pause-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """, null, null, null);

        var paused = resolver.pause();
        assertThat(paused.paused()).isTrue();

        var resumed = resolver.resume();
        assertThat(resumed.paused()).isFalse();
    }

    @Test
    void speedChangesState() {
        resolver.submit("""
            playbook: speed-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """, null, null, null);

        var state = resolver.speed(2.0);
        assertThat(state.speed()).isEqualTo(2.0);
    }

    @Test
    void runToWithUnknownLabelThrows() {
        resolver.submit("""
            playbook: runTo-test
            steps:
              - label: "Step"
                target: browser
                commands:
                  - action: ready
            """, null, null, null);

        assertThatThrownBy(() -> resolver.runTo("nonexistent"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not found");
    }

    @Test
    void stepSendsControlMessage() {
        resolver.submit("""
            playbook: step-test
            steps:
              - label: "A"
                target: browser
                commands:
                  - action: ready
              - label: "B"
                target: browser
                commands:
                  - action: ready
            """, null, null, null);

        resolver.pause();
        var state = resolver.step();
        assertThat(state.playbook()).isEqualTo("step-test");
    }
}
