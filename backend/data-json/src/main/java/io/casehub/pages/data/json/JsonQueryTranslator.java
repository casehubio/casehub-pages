package io.casehub.pages.data.json;

import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.GroupOp;
import io.casehub.pages.data.ResultColumn;
import io.casehub.pages.data.SortColumn;
import io.casehub.pages.data.SortOp;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class JsonQueryTranslator {

    private static final Pattern SAFE_COLUMN_ID = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_.]*$");

    private JsonQueryTranslator() {}

    private static void validateColumnId(String columnId) {
        if (columnId == null || !SAFE_COLUMN_ID.matcher(columnId).matches()) {
            throw new IllegalArgumentException("Invalid column identifier: " + columnId);
        }
    }

    private static String safeColumnRef(String columnId) {
        validateColumnId(columnId);
        return "json_extract(data, '$." + columnId + "')";
    }

    private static String safeColumnAlias(String columnId) {
        validateColumnId(columnId);
        return columnId;
    }

    public static PreparedQuery translate(String tenantId, String appId, String collection, List<DataSetOp> ops) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder();

        GroupOp groupOp = null;
        List<String> filterClauses = new ArrayList<>();
        List<String> sortClauses = new ArrayList<>();

        for (DataSetOp op : ops) {
            if (op instanceof FilterOp f) {
                for (FilterExpression expr : f.expressions()) {
                    if (isTranslatable(expr)) {
                        filterClauses.add(translateExpression(expr, params));
                    }
                }
            } else if (op instanceof SortOp s) {
                for (SortColumn col : s.columns()) {
                    sortClauses.add(safeColumnRef(col.columnId()) + " " + (col.ascending() ? "ASC" : "DESC"));
                }
            } else if (op instanceof GroupOp g) {
                groupOp = g;
            }
        }

        if (groupOp != null) {
            sql.append(buildGroupQuery(groupOp));
        } else {
            sql.append("SELECT data FROM json_documents");
        }

        sql.append(" WHERE tenant_id = ? AND app_id = ? AND collection = ?");
        List<Object> allParams = new ArrayList<>();
        allParams.add(tenantId);
        allParams.add(appId);
        allParams.add(collection);
        allParams.addAll(params);

        for (String clause : filterClauses) {
            sql.append(" AND ").append(clause);
        }

        if (groupOp != null) {
            sql.append(" GROUP BY ").append(safeColumnRef(groupOp.groupingKey().columnId()));
        }

        if (!sortClauses.isEmpty()) {
            sql.append(" ORDER BY ").append(String.join(", ", sortClauses));
        }

        return new PreparedQuery(sql.toString(), allParams);
    }

    public static List<DataSetOp> remainingOps(List<DataSetOp> ops) {
        List<DataSetOp> remaining = new ArrayList<>();
        for (DataSetOp op : ops) {
            if (op instanceof FilterOp f) {
                List<FilterExpression> untranslatable = f.expressions().stream()
                    .filter(e -> !isTranslatable(e))
                    .toList();
                if (!untranslatable.isEmpty()) {
                    remaining.add(new FilterOp(untranslatable));
                }
            }
        }
        return remaining;
    }

    private static String buildGroupQuery(GroupOp groupOp) {
        String groupCol = safeColumnRef(groupOp.groupingKey().columnId());
        StringBuilder select = new StringBuilder("SELECT ").append(groupCol).append(" AS group_key");

        if (groupOp.columns() != null) {
            for (ResultColumn col : groupOp.columns()) {
                if (col instanceof ResultColumn.Aggregate agg && agg.fn() != null) {
                    String fn = agg.fn().fn().toUpperCase();
                    String sourceCol = safeColumnRef(agg.sourceId());
                    select.append(", ").append(fn).append("(").append(sourceCol).append(") AS ").append(safeColumnAlias(agg.columnId()));
                }
            }
        }

        select.append(" FROM json_documents");
        return select.toString();
    }

    private static boolean isTranslatable(FilterExpression expr) {
        return switch (expr) {
            case FilterExpression.Unresolved u -> false;
            case FilterExpression.And a -> a.children().stream().allMatch(JsonQueryTranslator::isTranslatable);
            case FilterExpression.Or o -> o.children().stream().allMatch(JsonQueryTranslator::isTranslatable);
            case FilterExpression.Not n -> isTranslatable(n.child());
            default -> true;
        };
    }

    private static String translateExpression(FilterExpression expr, List<Object> params) {
        return switch (expr) {
            case FilterExpression.And and -> {
                String joined = and.children().stream()
                    .map(c -> translateExpression(c, params))
                    .collect(Collectors.joining(" AND "));
                yield "(" + joined + ")";
            }
            case FilterExpression.Or or -> {
                String joined = or.children().stream()
                    .map(c -> translateExpression(c, params))
                    .collect(Collectors.joining(" OR "));
                yield "(" + joined + ")";
            }
            case FilterExpression.Not not ->
                "NOT (" + translateExpression(not.child(), params) + ")";
            case FilterExpression.Numeric n ->
                translateLeaf("CAST(" + safeColumnRef(n.columnId()) + " AS REAL)", n.filter(), params);
            case FilterExpression.StringLeaf s ->
                translateLeaf(safeColumnRef(s.columnId()), s.filter(), params);
            case FilterExpression.DateLeaf d ->
                translateLeaf(safeColumnRef(d.columnId()), d.filter(), params);
            case FilterExpression.Unresolved u ->
                "1=1";
        };
    }

    @SuppressWarnings("unchecked")
    private static String translateLeaf(String colExpr, Map<String, Object> filter, List<Object> params) {
        for (Map.Entry<String, Object> entry : filter.entrySet()) {
            String op = entry.getKey();
            Object value = entry.getValue();
            return switch (op) {
                case "eq" -> { params.add(value); yield colExpr + " = ?"; }
                case "neq" -> { params.add(value); yield colExpr + " != ?"; }
                case "gt" -> { params.add(value); yield colExpr + " > ?"; }
                case "gte" -> { params.add(value); yield colExpr + " >= ?"; }
                case "lt" -> { params.add(value); yield colExpr + " < ?"; }
                case "lte" -> { params.add(value); yield colExpr + " <= ?"; }
                case "like" -> { params.add(value); yield colExpr + " LIKE ?"; }
                case "in" -> {
                    List<?> values = (List<?>) value;
                    String placeholders = values.stream().map(v -> "?").collect(Collectors.joining(", "));
                    params.addAll(values);
                    yield colExpr + " IN (" + placeholders + ")";
                }
                case "isNull" -> {
                    boolean isNull = value instanceof Boolean b && b;
                    yield colExpr + (isNull ? " IS NULL" : " IS NOT NULL");
                }
                default -> { params.add(value); yield colExpr + " = ?"; }
            };
        }
        return "1=1";
    }
}
