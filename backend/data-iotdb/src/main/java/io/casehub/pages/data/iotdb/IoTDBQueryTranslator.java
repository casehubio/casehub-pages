package io.casehub.pages.data.iotdb;

import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;

import java.time.Instant;
import java.util.List;
import java.util.StringJoiner;

public final class IoTDBQueryTranslator {

    private IoTDBQueryTranslator() {}

    public static String translate(String table, List<String> columns, DataSetLookup lookup) {
        var sb = new StringBuilder("SELECT time");
        for (var col : columns) {
            sb.append(", ").append(col);
        }
        sb.append(" FROM ").append(table);

        var where = new StringJoiner(" AND ");
        for (var op : lookup.operations()) {
            if (op instanceof FilterOp filterOp) {
                for (var expr : filterOp.expressions()) {
                    translateExpression(expr, where);
                }
            }
        }
        if (where.length() > 0) {
            sb.append(" WHERE ").append(where);
        }

        sb.append(" ORDER BY time ASC");
        return sb.toString();
    }

    private static void translateExpression(FilterExpression expr, StringJoiner where) {
        switch (expr) {
            case FilterExpression.Unresolved u -> {
                switch (u.fn()) {
                    case "EQUALS_TO" -> where.add(u.columnId() + " = '" + u.args().getFirst() + "'");
                    case "NOT_EQUALS_TO" -> where.add(u.columnId() + " != '" + u.args().getFirst() + "'");
                    case "TIME_FRAME" -> {
                        long seconds = Long.parseLong(u.args().getFirst());
                        var since = Instant.now().minusSeconds(seconds);
                        where.add("time >= " + since.toEpochMilli());
                    }
                    case "GREATER_THAN" -> where.add(u.columnId() + " > " + u.args().getFirst());
                    case "LESS_THAN" -> where.add(u.columnId() + " < " + u.args().getFirst());
                    default -> {}
                }
            }
            case FilterExpression.And and -> {
                for (var child : and.children()) {
                    translateExpression(child, where);
                }
            }
            default -> {}
        }
    }
}
