package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.StoredEvent;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(EventStoreOverrideTest.Profile.class)
class EventStoreOverrideTest {

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Set<Class<?>> getEnabledAlternatives() {
            return Set.of(AlternativeEventStoreProducer.class);
        }
    }

    @Alternative
    @ApplicationScoped
    public static class AlternativeEventStoreProducer {
        @Produces
        @ApplicationScoped
        EventStore eventStore() {
            return new StubEventStore();
        }
    }

    static class StubEventStore implements EventStore {
        @Override
        public long append(String topic, String payloadJson) {
            return -1;
        }

        @Override
        public List<StoredEvent> replay(String topic, long sinceSeq) {
            return List.of();
        }

        @Override
        public Set<String> topics() {
            return Set.of();
        }
    }

    @Inject EventStore eventStore;

    @Test
    void alternative_event_store_displaces_default() {
        assertThat(eventStore.append("t", "{}")).isEqualTo(-1);
    }
}
