package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ActivationTrigger;
import io.casehub.pages.playbook.ActivationTrigger.RetriggerPolicy;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ActivationQueueTest {

    private static PendingActivation pending(String name) {
        return new PendingActivation(name, "yaml",
                new ActivationTrigger.CloudEventTrigger(
                        "test", Map.of(), null, RetriggerPolicy.QUEUE, 10),
                Instant.now());
    }

    @Test
    void offerAndPoll() {
        var queue = new ActivationQueue(10);
        assertThat(queue.offer(pending("a"))).isTrue();
        assertThat(queue.size()).isEqualTo(1);

        var polled = queue.poll();
        assertThat(polled).isNotNull();
        assertThat(polled.playbookName()).isEqualTo("a");
        assertThat(queue.size()).isZero();
    }

    @Test
    void pollReturnsNullWhenEmpty() {
        var queue = new ActivationQueue(10);
        assertThat(queue.poll()).isNull();
    }

    @Test
    void rejectsWhenFull() {
        var queue = new ActivationQueue(2);
        assertThat(queue.offer(pending("a"))).isTrue();
        assertThat(queue.offer(pending("b"))).isTrue();
        assertThat(queue.offer(pending("c"))).isFalse();
        assertThat(queue.size()).isEqualTo(2);
    }

    @Test
    void fifoOrder() {
        var queue = new ActivationQueue(10);
        queue.offer(pending("first"));
        queue.offer(pending("second"));
        assertThat(queue.poll().playbookName()).isEqualTo("first");
        assertThat(queue.poll().playbookName()).isEqualTo("second");
    }
}
