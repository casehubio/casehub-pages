package io.casehub.pages.mcp;

import io.casehub.pages.scenario.runtime.CatalogActionDetail;
import io.casehub.pages.scenario.runtime.CatalogActionSummary;
import io.casehub.pages.scenario.runtime.StepCatalogService;
import io.casehub.platform.api.mcp.McpDomain;
import org.eclipse.microprofile.graphql.GraphQLApi;
import org.eclipse.microprofile.graphql.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class StepCatalogResolverTest {

    StepCatalogResolver resolver;

    @BeforeEach
    void setUp() {
        var testDir = Path.of("../scenario-runtime/src/test/resources/step-definitions");
        var service = new StepCatalogService(testDir);
        resolver = new StepCatalogResolver();
        resolver.catalog = service;
    }

    @Test
    void hasMcpDomainAnnotation() {
        var annotation = StepCatalogResolver.class.getAnnotation(McpDomain.class);
        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("step-catalog");
    }

    @Test
    void hasGraphQLApiAnnotation() {
        assertThat(StepCatalogResolver.class.getAnnotation(GraphQLApi.class)).isNotNull();
    }

    @Test
    void actionsQueryReturnsAllEntries() {
        var actions = resolver.actions();
        assertThat(actions).isNotEmpty();
        assertThat(actions.stream().map(CatalogActionSummary::name))
                .contains("check-compliance", "list-standards");
    }

    @Test
    void actionQueryReturnsDetail() {
        var detail = resolver.action("check-compliance");
        assertThat(detail).isNotNull();
        assertThat(detail.name()).isEqualTo("check-compliance");
        assertThat(detail.inputs()).containsKey("documentId");
        assertThat(detail.invoke().kind()).isEqualTo("rest");
    }

    @Test
    void actionQueryReturnsNullForUnknown() {
        assertThat(resolver.action("nonexistent")).isNull();
    }

    @Test
    void actionsMethodHasQueryAnnotation() throws NoSuchMethodException {
        var method = StepCatalogResolver.class.getMethod("actions");
        var query = method.getAnnotation(Query.class);
        assertThat(query).isNotNull();
        assertThat(query.value()).isEqualTo("catalogActions");
    }

    @Test
    void actionMethodHasQueryAnnotation() throws NoSuchMethodException {
        var method = StepCatalogResolver.class.getMethod("action", String.class);
        var query = method.getAnnotation(Query.class);
        assertThat(query).isNotNull();
        assertThat(query.value()).isEqualTo("catalogAction");
    }
}
