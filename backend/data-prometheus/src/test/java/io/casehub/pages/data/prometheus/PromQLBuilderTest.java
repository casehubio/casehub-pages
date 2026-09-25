package io.casehub.pages.data.prometheus;

import io.casehub.pages.data.Aggregation;
import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import io.casehub.pages.data.GroupOp;
import io.casehub.pages.data.GroupStrategy;
import io.casehub.pages.data.GroupingKey;
import io.casehub.pages.data.ResultColumn;
import io.casehub.pages.data.SortColumn;
import io.casehub.pages.data.SortOp;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromQLBuilderTest {

    @Test
    void bareMetricWithNoOps() {
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.remainingOps()).isEmpty();
        assertThat(q.start()).isNull();
        assertThat(q.end()).isNull();
    }

    @Test
    void equalsToFilterBecomesLabelMatcher() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("idle"))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu{mode=\"idle\"}");
        assertThat(q.remainingOps()).isEmpty();
    }

    @Test
    void notEqualsToFilterBecomesNegMatcher() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("mode", "NOT_EQUALS_TO", List.of("idle"))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu{mode!=\"idle\"}");
    }

    @Test
    void likeToFilterBecomesRegexMatcher() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("job", "LIKE_TO", List.of("prod%"))
        ));
        PromQLQuery q = PromQLBuilder.build("http_requests", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("http_requests{job=~\"^prod.*$\"}");
    }

    @Test
    void multipleFiltersInAndBecomeLabelBlock() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.And(List.of(
                new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("idle")),
                new FilterExpression.Unresolved("cpu", "EQUALS_TO", List.of("0"))
            ))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu{mode=\"idle\",cpu=\"0\"}");
    }

    @Test
    void andWithMixedTranslatableAndNot() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.And(List.of(
                new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("idle")),
                new FilterExpression.Numeric("value", Map.of("fn", "GREATER_THAN", "value", 100))
            ))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu{mode=\"idle\"}");
        assertThat(q.remainingOps()).hasSize(1);
        assertThat(q.remainingOps().get(0)).isInstanceOf(FilterOp.class);
    }

    @Test
    void groupWithSumWrapsInAggregation() {
        GroupOp group = new GroupOp(
            new GroupingKey("instance", "instance", new GroupStrategy.Distinct(), 100, false, true, null, null),
            List.of(new ResultColumn.Aggregate("value", "total", new Aggregation("SUM", null))),
            null, null
        );
        PromQLQuery q = PromQLBuilder.build("http_requests", List.of(group), "60s");
        assertThat(q.expr()).isEqualTo("sum by (instance) (http_requests)");
    }

    @Test
    void groupWithAvgWrapsInAggregation() {
        GroupOp group = new GroupOp(
            new GroupingKey("instance", "instance", new GroupStrategy.Distinct(), 100, false, true, null, null),
            List.of(new ResultColumn.Aggregate("value", "avg_val", new Aggregation("AVERAGE", null))),
            null, null
        );
        PromQLQuery q = PromQLBuilder.build("http_requests", List.of(group), "60s");
        assertThat(q.expr()).isEqualTo("avg by (instance) (http_requests)");
    }

    @Test
    void groupWithCountWraps() {
        GroupOp group = new GroupOp(
            new GroupingKey("instance", "instance", new GroupStrategy.Distinct(), 100, false, true, null, null),
            List.of(new ResultColumn.Aggregate("value", "cnt", new Aggregation("COUNT", null))),
            null, null
        );
        PromQLQuery q = PromQLBuilder.build("http_requests", List.of(group), "60s");
        assertThat(q.expr()).isEqualTo("count by (instance) (http_requests)");
    }

    @Test
    void groupWithFixedCalendarGoesToRemainingOps() {
        GroupOp group = new GroupOp(
            new GroupingKey("ts", "ts", new GroupStrategy.FixedCalendar("MONTH"), 100, false, true, null, null),
            List.of(new ResultColumn.Aggregate("value", "total", new Aggregation("SUM", null))),
            null, null
        );
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(group), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.remainingOps()).hasSize(1);
        assertThat(q.remainingOps().get(0)).isInstanceOf(GroupOp.class);
    }

    @Test
    void sortOpGoesToRemainingOps() {
        SortOp sort = new SortOp(List.of(new SortColumn("value", true)));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(sort), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.remainingOps()).hasSize(1);
        assertThat(q.remainingOps().get(0)).isInstanceOf(SortOp.class);
    }

    @Test
    void numericFilterGoesToRemainingOps() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Numeric("value", Map.of("fn", "GREATER_THAN", "value", 100))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.remainingOps()).hasSize(1);
    }

    @Test
    void timeFrameFilterSetsStartEnd() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("timestamp", "TIME_FRAME", List.of("now-1HOUR till now"))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "5m");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.start()).isNotNull();
        assertThat(q.end()).isNotNull();
        assertThat(q.step()).isEqualTo("5m");
        assertThat(q.remainingOps()).isEmpty();
    }

    @Test
    void orFilterGoesToRemainingOps() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Or(List.of(
                new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("idle")),
                new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("user"))
            ))
        ));
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("node_cpu");
        assertThat(q.remainingOps()).hasSize(1);
    }

    @Test
    void filterAndGroupCombined() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("mode", "EQUALS_TO", List.of("idle"))
        ));
        GroupOp group = new GroupOp(
            new GroupingKey("instance", "instance", new GroupStrategy.Distinct(), 100, false, true, null, null),
            List.of(new ResultColumn.Aggregate("value", "avg_val", new Aggregation("AVERAGE", null))),
            null, null
        );
        PromQLQuery q = PromQLBuilder.build("node_cpu", List.of(filter, group), "60s");
        assertThat(q.expr()).isEqualTo("avg by (instance) (node_cpu{mode=\"idle\"})");
    }

    @Test
    void likeToEscapesRegexMetachars() {
        FilterOp filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("job", "LIKE_TO", List.of("node_cpu_%_total"))
        ));
        PromQLQuery q = PromQLBuilder.build("metric", List.of(filter), "60s");
        assertThat(q.expr()).isEqualTo("metric{job=~\"^node_cpu_.*_total$\"}");
    }
}
