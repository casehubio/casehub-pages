package io.casehub.pages.push.runtime;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(CustomEndpointOverrideTest.OverrideProfile.class)
class CustomEndpointOverrideTest {

    @Inject
    Instance<DefaultPushWebSocket> endpoint;

    @Test
    void default_endpoint_is_absent_when_property_set() {
        assertThat(endpoint.isUnsatisfied()).isTrue();
    }

    public static class OverrideProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("casehub.push.custom-endpoint", "true");
        }
    }
}
