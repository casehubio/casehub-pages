package io.casehub.pages.data.json;

import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.SortColumn;
import io.casehub.pages.data.SortOp;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JsonQueryTranslatorTest {

    @Test
    void base_query_with_no_ops() {
        PreparedQuery pq = JsonQueryTranslator.translate("t1", "helpdesk", "tickets", List.of());

        assertThat(pq.sql()).contains("SELECT data FROM json_documents");
        assertThat(pq.sql()).contains("WHERE tenant_id = ? AND app_id = ? AND collection = ?");
        assertThat(pq.params()).containsExactly("t1", "helpdesk", "tickets");
    }

    @Test
    void string_equals_filter() {
        FilterExpression expr = new FilterExpression.StringLeaf("status", Map.of("eq", "open"));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("json_extract(data, '$.status') = ?");
        assertThat(pq.params()).contains("open");
    }

    @Test
    void numeric_greater_than_filter() {
        FilterExpression expr = new FilterExpression.Numeric("score", Map.of("gt", 90));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("CAST(json_extract(data, '$.score') AS REAL) > ?");
        assertThat(pq.params()).contains(90);
    }

    @Test
    void and_expression() {
        FilterExpression left = new FilterExpression.StringLeaf("status", Map.of("eq", "open"));
        FilterExpression right = new FilterExpression.Numeric("priority", Map.of("gte", 3));
        FilterExpression and = new FilterExpression.And(List.of(left, right));
        FilterOp filterOp = new FilterOp(List.of(and));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("(json_extract(data, '$.status') = ? AND CAST(json_extract(data, '$.priority') AS REAL) >= ?)");
    }

    @Test
    void or_expression() {
        FilterExpression left = new FilterExpression.StringLeaf("status", Map.of("eq", "open"));
        FilterExpression right = new FilterExpression.StringLeaf("status", Map.of("eq", "pending"));
        FilterExpression or = new FilterExpression.Or(List.of(left, right));
        FilterOp filterOp = new FilterOp(List.of(or));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("(json_extract(data, '$.status') = ? OR json_extract(data, '$.status') = ?)");
    }

    @Test
    void not_expression() {
        FilterExpression inner = new FilterExpression.StringLeaf("status", Map.of("eq", "closed"));
        FilterExpression not = new FilterExpression.Not(inner);
        FilterOp filterOp = new FilterOp(List.of(not));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("NOT (json_extract(data, '$.status') = ?)");
    }

    @Test
    void date_less_than_filter() {
        FilterExpression expr = new FilterExpression.DateLeaf("created", Map.of("lt", "2026-01-01"));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("json_extract(data, '$.created') < ?");
        assertThat(pq.params()).contains("2026-01-01");
    }

    @Test
    void like_filter() {
        FilterExpression expr = new FilterExpression.StringLeaf("title", Map.of("like", "%ticket%"));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("json_extract(data, '$.title') LIKE ?");
        assertThat(pq.params()).contains("%ticket%");
    }

    @Test
    void in_filter() {
        FilterExpression expr = new FilterExpression.StringLeaf("status", Map.of("in", List.of("open", "pending")));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("json_extract(data, '$.status') IN (?, ?)");
        assertThat(pq.params()).contains("open", "pending");
    }

    @Test
    void is_null_filter() {
        FilterExpression expr = new FilterExpression.StringLeaf("notes", Map.of("isNull", true));
        FilterOp filterOp = new FilterOp(List.of(expr));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(filterOp));

        assertThat(pq.sql()).contains("json_extract(data, '$.notes') IS NULL");
    }

    @Test
    void sort_ascending() {
        SortOp sortOp = new SortOp(List.of(new SortColumn("priority", true)));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(sortOp));

        assertThat(pq.sql()).contains("ORDER BY json_extract(data, '$.priority') ASC");
    }

    @Test
    void sort_descending_multiple_columns() {
        SortOp sortOp = new SortOp(List.of(
            new SortColumn("priority", false),
            new SortColumn("created", true)
        ));

        PreparedQuery pq = JsonQueryTranslator.translate("t1", "app", "col", List.of(sortOp));

        assertThat(pq.sql()).contains("ORDER BY json_extract(data, '$.priority') DESC, json_extract(data, '$.created') ASC");
    }

    @Test
    void unresolved_goes_to_remaining_ops() {
        FilterExpression expr = new FilterExpression.Unresolved("col", "unknownFn", List.of("a"));
        FilterOp filterOp = new FilterOp(List.of(expr));

        List<DataSetOp> remaining = JsonQueryTranslator.remainingOps(List.of(filterOp));

        assertThat(remaining).hasSize(1);
    }
}
