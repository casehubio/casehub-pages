package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.ColumnDef;
import io.casehub.pages.data.DataSetResult;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ResponseMapper {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_INSTANT;

    private ResponseMapper() {}

    public static DataSetResult toDataSetResult(PrometheusResponse response) {
        if (response.data() == null || response.data().result() == null || response.data().result().isEmpty()) {
            return new DataSetResult(List.of(), List.of());
        }

        return switch (response.data().resultType()) {
            case "matrix" -> mapMatrix(response.data().result());
            case "vector" -> mapVector(response.data().result());
            default -> new DataSetResult(List.of(), List.of());
        };
    }

    private static DataSetResult mapMatrix(List<PrometheusResponse.Result> results) {
        Set<String> labelKeys = collectLabelKeys(results);

        List<ColumnDef> columns = new ArrayList<>();
        columns.add(new ColumnDef("timestamp", "Timestamp", "date"));
        columns.add(new ColumnDef("value", "Value", "number"));
        for (String key : labelKeys) {
            columns.add(new ColumnDef(key, key, "string"));
        }

        List<List<String>> rows = new ArrayList<>();
        for (PrometheusResponse.Result series : results) {
            Map<String, String> labels = series.metric() != null ? series.metric() : Map.of();
            if (series.values() != null) {
                for (List<Object> sample : series.values()) {
                    List<String> row = new ArrayList<>();
                    double epochSeconds = ((Number) sample.get(0)).doubleValue();
                    row.add(Instant.ofEpochSecond((long) epochSeconds).atOffset(ZoneOffset.UTC).format(ISO));
                    row.add(sample.get(1).toString());
                    for (String key : labelKeys) {
                        row.add(labels.getOrDefault(key, ""));
                    }
                    rows.add(row);
                }
            }
        }

        return new DataSetResult(columns, rows);
    }

    private static DataSetResult mapVector(List<PrometheusResponse.Result> results) {
        Set<String> labelKeys = collectLabelKeys(results);

        List<ColumnDef> columns = new ArrayList<>();
        columns.add(new ColumnDef("value", "Value", "number"));
        for (String key : labelKeys) {
            columns.add(new ColumnDef(key, key, "string"));
        }

        List<List<String>> rows = new ArrayList<>();
        for (PrometheusResponse.Result series : results) {
            Map<String, String> labels = series.metric() != null ? series.metric() : Map.of();
            if (series.value() != null && series.value().size() >= 2) {
                List<String> row = new ArrayList<>();
                row.add(series.value().get(1).toString());
                for (String key : labelKeys) {
                    row.add(labels.getOrDefault(key, ""));
                }
                rows.add(row);
            }
        }

        return new DataSetResult(columns, rows);
    }

    private static Set<String> collectLabelKeys(List<PrometheusResponse.Result> results) {
        Set<String> keys = new LinkedHashSet<>();
        for (PrometheusResponse.Result r : results) {
            if (r.metric() != null) {
                keys.addAll(r.metric().keySet());
            }
        }
        return keys;
    }

    public static long countSamples(PrometheusResponse response) {
        if (response.data() == null || response.data().result() == null) return 0;
        long count = 0;
        for (PrometheusResponse.Result r : response.data().result()) {
            if (r.values() != null) {
                count += r.values().size();
            } else if (r.value() != null) {
                count++;
            }
        }
        return count;
    }
}
