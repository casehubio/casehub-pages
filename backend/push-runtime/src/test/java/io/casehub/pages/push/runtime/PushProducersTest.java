package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class PushProducersTest {

    @Inject EventBroadcaster broadcaster;
    @Inject TopicRegistry topicRegistry;
    @Inject EventStore eventStore;
  @Inject
  io.casehub.pages.push.JsonWriter jsonWriter;


  @Test
  void all_beans_are_resolvable() {
    assertThat(broadcaster).isNotNull();
    assertThat(topicRegistry).isNotNull();
    assertThat(eventStore).isNotNull();
    assertThat(jsonWriter).isNotNull();
  }

    @Test
    void default_event_store_has_capacity_1000() {
        for (int i = 0; i < 1001; i++) {
            eventStore.append("capacity-test", "{\"i\":" + i + "}");
        }
        assertThat(eventStore.replay("capacity-test", 0)).hasSize(1000);
    }
}
