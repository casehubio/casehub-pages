package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.Aggregation;
import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.GroupOp;
import io.casehub.pages.data.GroupStrategy;
import io.casehub.pages.data.ResultColumn;
import io.casehub.pages.data.SortOp;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PromQLBuilder {

    private static final Pattern RE2_META = Pattern.compile("[.\\\\*+?()\\[\\]{}^$|]");
    private static final Pattern TIME_FRAME_PATTERN = Pattern.compile("now-(\\d+)(SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|YEAR)\\s+till\\s+now");

    private PromQLBuilder() {}

    public static PromQLQuery build(String metric, List<DataSetOp> operations, String defaultStep) {
        List<String> labelMatchers = new ArrayList<>();
        List<DataSetOp> remaining = new ArrayList<>();
        String aggregationFn = null;
        String groupByLabel = null;
        String start = null;
        String end = null;
        boolean startConsumed = false;

        for (DataSetOp op : operations) {
            switch (op) {
                case FilterOp f -> processFilter(f, labelMatchers, remaining);
                case GroupOp g -> {
                    String[] result = processGroup(g);
                    if (result != null) {
                        aggregationFn = result[0];
                        groupByLabel = result[1];
                    } else {
                        remaining.add(g);
                    }
                }
                case SortOp s -> remaining.add(s);
            }
            if (op instanceof FilterOp f) {
                String[] timeRange = extractTimeRange(f);
                if (timeRange != null && !startConsumed) {
                    start = timeRange[0];
                    end = timeRange[1];
                    startConsumed = true;
                }
            }
        }

        StringBuilder expr = new StringBuilder();
        if (aggregationFn != null) {
            expr.append(aggregationFn).append(" by (").append(groupByLabel).append(") (");
        }
        expr.append(metric);
        if (!labelMatchers.isEmpty()) {
            expr.append("{").append(String.join(",", labelMatchers)).append("}");
        }
        if (aggregationFn != null) {
            expr.append(")");
        }

        return new PromQLQuery(expr.toString(), start, end, defaultStep, List.copyOf(remaining));
    }

    private static void processFilter(FilterOp filterOp, List<String> labelMatchers,
                                       List<DataSetOp> remaining) {
        List<FilterExpression> untranslatable = new ArrayList<>();

        for (FilterExpression expr : filterOp.expressions()) {
            processExpression(expr, labelMatchers, untranslatable);
        }

        if (!untranslatable.isEmpty()) {
            remaining.add(new FilterOp(untranslatable));
        }
    }

    private static void processExpression(FilterExpression expr, List<String> labelMatchers,
                                           List<FilterExpression> untranslatable) {
        switch (expr) {
            case FilterExpression.Unresolved u -> {
                switch (u.fn()) {
                    case "EQUALS_TO" -> labelMatchers.add(u.columnId() + "=\"" + u.args().getFirst() + "\"");
                    case "NOT_EQUALS_TO" -> labelMatchers.add(u.columnId() + "!=\"" + u.args().getFirst() + "\"");
                    case "LIKE_TO" -> labelMatchers.add(u.columnId() + "=~\"" + likeToRegex(u.args().getFirst()) + "\"");
                    case "TIME_FRAME" -> { /* consumed by extractTimeRange */ }
                    default -> untranslatable.add(u);
                }
            }
            case FilterExpression.And and -> {
                List<FilterExpression> childUntranslatable = new ArrayList<>();
                for (FilterExpression child : and.children()) {
                    processExpression(child, labelMatchers, childUntranslatable);
                }
                if (!childUntranslatable.isEmpty()) {
                    untranslatable.add(new FilterExpression.And(childUntranslatable));
                }
            }
            case FilterExpression.Or or -> untranslatable.add(or);
            case FilterExpression.Not not -> untranslatable.add(not);
            case FilterExpression.Numeric n -> untranslatable.add(n);
            case FilterExpression.StringLeaf s -> untranslatable.add(s);
            case FilterExpression.DateLeaf d -> untranslatable.add(d);
        }
    }

    private static String[] extractTimeRange(FilterOp filterOp) {
        for (FilterExpression expr : filterOp.expressions()) {
            String[] range = extractTimeRangeFromExpr(expr);
            if (range != null) return range;
        }
        return null;
    }

    private static String[] extractTimeRangeFromExpr(FilterExpression expr) {
        if (expr instanceof FilterExpression.Unresolved u && "TIME_FRAME".equals(u.fn())) {
            Matcher m = TIME_FRAME_PATTERN.matcher(u.args().getFirst());
            if (m.matches()) {
                long amount = Long.parseLong(m.group(1));
                ChronoUnit unit = switch (m.group(2)) {
                    case "SECOND" -> ChronoUnit.SECONDS;
                    case "MINUTE" -> ChronoUnit.MINUTES;
                    case "HOUR" -> ChronoUnit.HOURS;
                    case "DAY" -> ChronoUnit.DAYS;
                    case "WEEK" -> ChronoUnit.WEEKS;
                    case "MONTH" -> ChronoUnit.DAYS; // approximate
                    case "YEAR" -> ChronoUnit.DAYS;  // approximate
                    default -> ChronoUnit.HOURS;
                };
                long multiplier = switch (m.group(2)) {
                    case "MONTH" -> 30;
                    case "YEAR" -> 365;
                    default -> 1;
                };
                Instant now = Instant.now();
                Instant from = now.minus(amount * multiplier, unit);
                return new String[]{String.valueOf(from.getEpochSecond()), String.valueOf(now.getEpochSecond())};
            }
        }
        if (expr instanceof FilterExpression.And and) {
            for (FilterExpression child : and.children()) {
                String[] range = extractTimeRangeFromExpr(child);
                if (range != null) return range;
            }
        }
        return null;
    }

    private static String[] processGroup(GroupOp group) {
        if (!(group.groupingKey().strategy() instanceof GroupStrategy.Distinct)) {
            return null;
        }
        if (group.selectedIntervals() != null && !group.selectedIntervals().isEmpty()) {
            return null;
        }
        if (group.join() != null && group.join()) {
            return null;
        }
        if (group.columns().size() != 1 || !(group.columns().getFirst() instanceof ResultColumn.Aggregate agg)) {
            return null;
        }
        String promqlFn = mapAggregation(agg.fn());
        if (promqlFn == null) {
            return null;
        }
        return new String[]{promqlFn, group.groupingKey().columnId()};
    }

    private static String mapAggregation(Aggregation agg) {
        return switch (agg.fn()) {
            case "SUM" -> "sum";
            case "AVERAGE" -> "avg";
            case "MIN" -> "min";
            case "MAX" -> "max";
            case "COUNT" -> "count";
            default -> null;
        };
    }

    static String likeToRegex(String pattern) {
        StringBuilder sb = new StringBuilder("^");
        for (int i = 0; i < pattern.length(); i++) {
            char c = pattern.charAt(i);
            if (c == '%') {
                sb.append(".*");
            } else if (RE2_META.matcher(String.valueOf(c)).matches()) {
                sb.append("\\").append(c);
            } else {
                sb.append(c);
            }
        }
        sb.append("$");
        return sb.toString();
    }
}
