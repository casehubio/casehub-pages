package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.DataSetResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ResponseMapperTest {

    @Test
    void mapMatrixToDataSetResult() {
        var response = new PrometheusResponse("success",
            new PrometheusResponse.Data("matrix", List.of(
                new PrometheusResponse.Result(
                    Map.of("instance", "host1", "job", "node"),
                    List.of(
                        List.of(1695000000, "1.5"),
                        List.of(1695000060, "2.0")
                    ),
                    null
                )
            )),
            null, null
        );

        DataSetResult result = ResponseMapper.toDataSetResult(response);

        assertThat(result.columns()).hasSize(4);
        assertThat(result.columns().get(0).id()).isEqualTo("timestamp");
        assertThat(result.columns().get(0).type()).isEqualTo("date");
        assertThat(result.columns().get(1).id()).isEqualTo("value");
        assertThat(result.columns().get(1).type()).isEqualTo("number");

        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().get(0).get(1)).isEqualTo("1.5");
        assertThat(result.rows().get(1).get(1)).isEqualTo("2.0");
    }

    @Test
    void mapVectorToDataSetResult() {
        var response = new PrometheusResponse("success",
            new PrometheusResponse.Data("vector", List.of(
                new PrometheusResponse.Result(
                    Map.of("instance", "host1"),
                    null,
                    List.of(1695000000, "42.5")
                ),
                new PrometheusResponse.Result(
                    Map.of("instance", "host2"),
                    null,
                    List.of(1695000000, "55.0")
                )
            )),
            null, null
        );

        DataSetResult result = ResponseMapper.toDataSetResult(response);

        assertThat(result.columns()).hasSize(2);
        assertThat(result.columns().get(0).id()).isEqualTo("value");
        assertThat(result.columns().get(0).type()).isEqualTo("number");
        assertThat(result.columns().get(1).id()).isEqualTo("instance");

        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().get(0).get(0)).isEqualTo("42.5");
        assertThat(result.rows().get(0).get(1)).isEqualTo("host1");
        assertThat(result.rows().get(1).get(0)).isEqualTo("55.0");
        assertThat(result.rows().get(1).get(1)).isEqualTo("host2");
    }

    @Test
    void emptyResponseReturnsEmptyResult() {
        var response = new PrometheusResponse("success",
            new PrometheusResponse.Data("vector", List.of()),
            null, null
        );

        DataSetResult result = ResponseMapper.toDataSetResult(response);

        assertThat(result.columns()).isEmpty();
        assertThat(result.rows()).isEmpty();
    }

    @Test
    void countSamplesMatrix() {
        var response = new PrometheusResponse("success",
            new PrometheusResponse.Data("matrix", List.of(
                new PrometheusResponse.Result(Map.of(), List.of(
                    List.of(1, "1"), List.of(2, "2"), List.of(3, "3")
                ), null),
                new PrometheusResponse.Result(Map.of(), List.of(
                    List.of(1, "1"), List.of(2, "2")
                ), null)
            )),
            null, null
        );

        assertThat(ResponseMapper.countSamples(response)).isEqualTo(5);
    }

    @Test
    void countSamplesVector() {
        var response = new PrometheusResponse("success",
            new PrometheusResponse.Data("vector", List.of(
                new PrometheusResponse.Result(Map.of(), null, List.of(1, "42")),
                new PrometheusResponse.Result(Map.of(), null, List.of(1, "55"))
            )),
            null, null
        );

        assertThat(ResponseMapper.countSamples(response)).isEqualTo(2);
    }
}
