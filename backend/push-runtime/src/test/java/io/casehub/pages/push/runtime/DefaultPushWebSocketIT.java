package io.casehub.pages.push.runtime;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class DefaultPushWebSocketIT {

    @Inject
    DefaultPushWebSocket endpoint;

    @Test
    void default_endpoint_bean_is_resolvable() {
        assertThat(endpoint).isNotNull();
    }
}
