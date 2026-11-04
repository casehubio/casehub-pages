package io.casehub.pages.data.json;

import com.fasterxml.jackson.databind.JsonNode;
import io.casehub.pages.data.DataContext;
import io.casehub.platform.api.identity.TenancyConstants;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class AppBootstrapTest {

    @Inject
    AppRegistry appRegistry;

    @Test
    void seeds_known_apps_into_apps_collection() {
        DataContext ctx = new DataContext(TenancyConstants.PLATFORM_TENANT_ID);
        JsonCollectionStore store = appRegistry.getStore();

        Optional<JsonNode> helpdesk = store.get(ctx, TenancyConstants.PLATFORM_TENANT_ID, "_apps", "helpdesk");
        assertThat(helpdesk).isPresent();
        assertThat(helpdesk.get().get("appId").asText()).isEqualTo("helpdesk");
        assertThat(helpdesk.get().get("name").asText()).isEqualTo("Helpdesk");
        assertThat(helpdesk.get().get("source").asText()).isEqualTo("static");
        assertThat(helpdesk.get().get("route").asText()).isEqualTo("/helpdesk");
    }

    @Test
    void seeded_apps_have_correct_metadata() {
        DataContext ctx = new DataContext(TenancyConstants.PLATFORM_TENANT_ID);
        JsonCollectionStore store = appRegistry.getStore();

        var apps = store.listAll(TenancyConstants.PLATFORM_TENANT_ID, TenancyConstants.PLATFORM_TENANT_ID, "_apps");
        var appIds = apps.stream()
            .filter(a -> a.has("source") && "static".equals(a.get("source").asText()))
            .map(a -> a.get("appId").asText())
            .toList();

        assertThat(appIds).contains("helpdesk");
    }

    @Test
    void seeds_all_discovered_apps() {
        DataContext         ctx   = new DataContext(TenancyConstants.PLATFORM_TENANT_ID);
        JsonCollectionStore store = appRegistry.getStore();

        var apps = store.listAll(TenancyConstants.PLATFORM_TENANT_ID, TenancyConstants.PLATFORM_TENANT_ID, "_apps");
        var appIds = apps.stream()
                         .map(a -> a.get("appId").asText())
                         .toList();

        assertThat(appIds).contains("helpdesk", "contacts", "tasks");
    }

}
