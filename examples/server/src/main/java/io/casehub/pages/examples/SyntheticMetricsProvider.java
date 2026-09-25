package io.casehub.pages.examples;

import io.casehub.pages.data.ColumnDef;
import io.casehub.pages.data.DataProvider;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.DataSetResult;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.GroupOp;
import io.casehub.pages.data.QueryResult;
import io.casehub.pages.data.SortOp;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

@ApplicationScoped
public class SyntheticMetricsProvider implements DataProvider {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_INSTANT;
    private static final Set<String> DATASETS = Set.of("cpu-metrics", "memory-usage", "http-requests");

    private static final Map<String, MetricDef> METRIC_DEFS = Map.of(
        "cpu-metrics", new MetricDef(
            List.of("host-1", "host-2", "host-3"),
            List.of("idle", "user", "system"),
            "instance", "mode", 0.0, 100.0
        ),
        "memory-usage", new MetricDef(
            List.of("host-1", "host-2", "host-3"),
            List.of(),
            "instance", null, 1_000_000_000.0, 8_000_000_000.0
        ),
        "http-requests", new MetricDef(
            List.of("/api/users", "/api/orders", "/api/health"),
            List.of("GET", "POST"),
            "endpoint", "method", 0.0, 500.0
        )
    );

    record MetricDef(List<String> primaryLabels, List<String> secondaryLabels,
                     String primaryKey, String secondaryKey,
                     double minValue, double maxValue) {}

    @Override
    public String type() { return "synthetic"; }

    @Override
    public boolean canHandle(String dataSetId) {
        return DATASETS.contains(dataSetId);
    }

    @Override
    public QueryResult query(DataSetLookup lookup) {
        MetricDef def = METRIC_DEFS.get(lookup.dataSetId());
        if (def == null) {
            return QueryResult.complete(new DataSetResult(List.of(), List.of()));
        }

        List<DataSetOp> remainingOps = new ArrayList<>();
        String filterPrimary = null;
        String filterSecondary = null;
        Instant start = Instant.now().minusSeconds(3600);
        Instant end = Instant.now();

        for (DataSetOp op : lookup.operations()) {
            switch (op) {
                case FilterOp f -> {
                    for (FilterExpression expr : f.expressions()) {
                        if (expr instanceof FilterExpression.Unresolved u) {
                            if ("TIME_FRAME".equals(u.fn())) {
                                long[] range = parseTimeFrame(u.args().getFirst());
                                if (range != null) {
                                    start = Instant.ofEpochSecond(range[0]);
                                    end = Instant.ofEpochSecond(range[1]);
                                }
                            } else if ("EQUALS_TO".equals(u.fn())) {
                                if (u.columnId().equals(def.primaryKey)) {
                                    filterPrimary = u.args().getFirst();
                                } else if (u.columnId().equals(def.secondaryKey)) {
                                    filterSecondary = u.args().getFirst();
                                }
                            } else {
                                remainingOps.add(new FilterOp(List.of(expr)));
                            }
                        } else {
                            remainingOps.add(new FilterOp(List.of(expr)));
                        }
                    }
                }
                case GroupOp g -> remainingOps.add(g);
                case SortOp s -> remainingOps.add(s);
            }
        }

        List<ColumnDef> columns = new ArrayList<>();
        columns.add(new ColumnDef("timestamp", "Timestamp", "DATE"));
        columns.add(new ColumnDef("value", "Value", "NUMBER"));
        columns.add(new ColumnDef(def.primaryKey, def.primaryKey, "TEXT"));
        if (def.secondaryKey != null) {
            columns.add(new ColumnDef(def.secondaryKey, def.secondaryKey, "TEXT"));
        }

        List<String> primaries = filterPrimary != null
            ? List.of(filterPrimary)
            : def.primaryLabels;
        List<String> secondaries = def.secondaryLabels.isEmpty()
            ? List.of("")
            : (filterSecondary != null ? List.of(filterSecondary) : def.secondaryLabels);

        long stepSeconds = 60;
        List<List<String>> rows = new ArrayList<>();
        Random rng = new Random(lookup.dataSetId().hashCode());

        for (String primary : primaries) {
            for (String secondary : secondaries) {
                double base = def.minValue + rng.nextDouble() * (def.maxValue - def.minValue) * 0.5;
                for (long t = start.getEpochSecond(); t <= end.getEpochSecond(); t += stepSeconds) {
                    double noise = (rng.nextDouble() - 0.5) * (def.maxValue - def.minValue) * 0.1;
                    double value = Math.max(def.minValue, Math.min(def.maxValue, base + noise));
                    base += (rng.nextDouble() - 0.5) * 2;

                    List<String> row = new ArrayList<>();
                    row.add(Instant.ofEpochSecond(t).atOffset(ZoneOffset.UTC).format(ISO));
                    row.add(String.format("%.2f", value));
                    row.add(primary);
                    if (def.secondaryKey != null) {
                        row.add(secondary);
                    }
                    rows.add(row);
                }
            }
        }

        return new QueryResult(new DataSetResult(columns, rows), remainingOps);
    }

    private static long[] parseTimeFrame(String expr) {
        var m = java.util.regex.Pattern.compile("now-(\\d+)(SECOND|MINUTE|HOUR|DAY)\\s+till\\s+now")
            .matcher(expr);
        if (!m.matches()) return null;
        long amount = Long.parseLong(m.group(1));
        long seconds = switch (m.group(2)) {
            case "SECOND" -> amount;
            case "MINUTE" -> amount * 60;
            case "HOUR" -> amount * 3600;
            case "DAY" -> amount * 86400;
            default -> amount * 3600;
        };
        long now = Instant.now().getEpochSecond();
        return new long[]{now - seconds, now};
    }
}
