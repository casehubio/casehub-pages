package io.casehub.pages.data.prometheus;

import java.util.List;
import java.util.Map;

public record PrometheusResponse(
    String status,
    Data data,
    String errorType,
    String error
) {
    public record Data(String resultType, List<Result> result) {}
    public record Result(Map<String, String> metric, List<List<Object>> values, List<Object> value) {}
}
