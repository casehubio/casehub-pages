package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventStore;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(CustomCapacityTest.Profile.class)
class CustomCapacityTest {

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("casehub.pages.push.max-events-per-topic", "50");
        }
    }

    @Inject EventStore eventStore;

    @Test
    void custom_capacity_is_respected() {
        for (int i = 0; i < 60; i++) {
            eventStore.append("cap-test", "{\"i\":" + i + "}");
        }
        assertThat(eventStore.replay("cap-test", 0)).hasSize(50);
    }
}
