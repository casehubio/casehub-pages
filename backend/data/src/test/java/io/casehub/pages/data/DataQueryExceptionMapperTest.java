package io.casehub.pages.data;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DataQueryExceptionMapperTest {

    private final DataQueryExceptionMapper mapper = new DataQueryExceptionMapper();

    @Test
    void invalidQueryReturns400() {
        var ex       = new DataQueryException("INVALID_QUERY", "bad metric name");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(400);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("INVALID_QUERY");
        assertThat(entity.get("error")).isEqualTo("bad metric name");
    }

    @Test
    void fetchFailedReturns502() {
        var ex       = new DataQueryException("FETCH_FAILED", "connection refused");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(502);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("FETCH_FAILED");
    }

    @Test
    void resultTooLargeReturns413() {
        var ex       = new DataQueryException("RESULT_TOO_LARGE", "exceeded 10000 samples");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(413);
        @SuppressWarnings("unchecked")
        var entity = (Map<String, String>) response.getEntity();
        assertThat(entity.get("code")).isEqualTo("RESULT_TOO_LARGE");
    }

    @Test
    void unknownCodeReturns500() {
        var ex       = new DataQueryException("UNKNOWN", "something broke");
        var response = mapper.toResponse(ex);
        assertThat(response.getStatus()).isEqualTo(500);
    }

    @Test
    void causeChainPreserved() {
        var cause = new RuntimeException("root cause");
        var ex    = new DataQueryException("FETCH_FAILED", "timeout", cause);
        assertThat(ex.getCause()).isSameAs(cause);
        assertThat(ex.code()).isEqualTo("FETCH_FAILED");
    }
}
