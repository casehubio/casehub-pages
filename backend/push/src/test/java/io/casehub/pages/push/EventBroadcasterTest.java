package io.casehub.pages.push;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EventBroadcasterTest {

    private final InMemoryEventStore store = new InMemoryEventStore(100);
    private final TopicRegistry registry = new TopicRegistry();
    private final List<String> sent = new ArrayList<>();
    private static final JsonWriter JSON_WRITER;

    static {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        JSON_WRITER = mapper::writeValueAsString;
    }


    private EventBroadcaster broadcaster() {return new EventBroadcaster(store, registry, (connId, msg) -> sent.add(connId + ":" + msg), JSON_WRITER);}

    @Test
    void broadcast_assigns_seq_and_sends_to_all_connections() {
        registry.listen("c1", List.of("debate:abc"));
        registry.listen("c2", List.of("debate:abc"));
        EventBroadcaster b = broadcaster();

        long seq = b.broadcast("debate:abc", "{\"text\":\"hello\"}");

        assertThat(seq).isEqualTo(1);
        assertThat(sent).hasSize(2);
        for (String s : sent) {
            assertThat(s).contains("\"op\":\"event\"");
            assertThat(s).contains("\"topic\":\"debate:abc\"");
            assertThat(s).contains("\"seq\":1");
        }
    }

    @Test
    void broadcast_to_topic_with_no_connections_succeeds() {
        EventBroadcaster b = broadcaster();

        long seq = b.broadcast("nobody:listens", "{\"x\":1}");

        assertThat(seq).isEqualTo(1);
        assertThat(sent).isEmpty();
    }

    @Test
    void broadcast_increments_seq_per_topic() {
        EventBroadcaster b = broadcaster();

        long s1 = b.broadcast("t", "{}");
        long s2 = b.broadcast("t", "{}");

        assertThat(s1).isEqualTo(1);
        assertThat(s2).isEqualTo(2);
    }

    @Test
    void broadcast_wildcard_topic_throws() {
        EventBroadcaster b = broadcaster();

        assertThatThrownBy(() -> b.broadcast("notification:**", "{}"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("wildcard");

        assertThatThrownBy(() -> b.broadcast("event:*", "{}"))
            .isInstanceOf(IllegalArgumentException.class);
    }

  @Test
  void broadcast_continues_on_send_failure() {
    registry.listen("c1", List.of("t"));
    registry.listen("c2", List.of("t"));
    registry.listen("c3", List.of("t"));

    List<String> successes = new ArrayList<>();
    SessionSender failOnC2 = (connId, msg) -> {
      if ("c2".equals(connId)) {throw new RuntimeException("socket closed");}
      successes.add(connId);
    };
    EventBroadcaster b = new EventBroadcaster(store, registry, failOnC2, JSON_WRITER);

    long seq = b.broadcast("t", "{}");

    assertThat(seq).isEqualTo(1);
    assertThat(successes).hasSize(2);
    assertThat(successes).doesNotContain("c2");
  }

    @Test
    void broadcast_event_is_replayable_from_store() {
        EventBroadcaster b = broadcaster();

        b.broadcast("t", "{\"v\":42}");

        List<StoredEvent> replayed = store.replay("t", 0);
        assertThat(replayed).hasSize(1);
        assertThat(replayed.get(0).payloadJson()).isEqualTo("{\"v\":42}");
        assertThat(replayed.get(0).seq()).isEqualTo(1);
    }

  @Test
  void typed_broadcast_serializes_and_delivers() {
    registry.listen("c1", List.of("t"));
    EventBroadcaster b = broadcaster();

    record Payload(String text, int count) {}
    long seq = b.broadcast("t", new Payload("hello", 3));

    assertThat(seq).isEqualTo(1);
    assertThat(sent).hasSize(1);
    assertThat(sent.get(0)).contains("\"text\":\"hello\"");
    assertThat(sent.get(0)).contains("\"count\":3");
  }

  @Test
  void typed_broadcast_stores_correct_json_in_event_store() {
    EventBroadcaster b = broadcaster();

    record Metric(double value) {}
    b.broadcast("metrics:cpu", new Metric(0.85));

    List<StoredEvent> replayed = store.replay("metrics:cpu", 0);
    assertThat(replayed).hasSize(1);
    assertThat(replayed.get(0).payloadJson()).isEqualTo("{\"value\":0.85}");
  }

  @Test
  void typed_broadcast_serialization_failure_throws_illegal_argument() {
    JsonWriter failingWriter = v -> {throw new RuntimeException("boom");};
    EventBroadcaster b = new EventBroadcaster(store, registry,
                                              (connId, msg) -> sent.add(msg), failingWriter);

    assertThatThrownBy(() -> b.broadcast("t", new Object()))
      .isInstanceOf(IllegalArgumentException.class)
      .hasMessageContaining("topic")
      .hasCauseInstanceOf(RuntimeException.class);
  }

  @Test
  void typed_broadcast_wildcard_topic_throws() {
    EventBroadcaster b = broadcaster();

    assertThatThrownBy(() -> b.broadcast("event:**", java.util.Map.of("k", "v")))
      .isInstanceOf(IllegalArgumentException.class)
      .hasMessageContaining("wildcard");
  }

  @Test
  void constructor_rejects_null_json_writer() {
    assertThatThrownBy(() -> new EventBroadcaster(store, registry,
                                                  (connId, msg) -> {}, null))
      .isInstanceOf(NullPointerException.class);
  }


}
