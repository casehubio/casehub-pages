package io.casehub.pages.data.iotdb;

import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.FilterExpression;
import io.casehub.pages.data.FilterOp;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IoTDBQueryTranslatorTest {

    @Test
    void simpleQuery_noFilters() {
        var lookup = new DataSetLookup("iotdb:pool_metrics:fill_ratio", List.of(), null);
        var sql = IoTDBQueryTranslator.translate("pool_metrics", List.of("fill_ratio"), lookup);
        assertThat(sql).contains("SELECT time, fill_ratio FROM pool_metrics");
        assertThat(sql).contains("ORDER BY time ASC");
        assertThat(sql).doesNotContain("WHERE");
    }

    @Test
    void equalsFilter_addedToWhere() {
        var filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("pool", "EQUALS_TO", List.of("default"))));
        var lookup = new DataSetLookup("iotdb:pool_metrics:fill_ratio", List.of(filter), null);
        var sql = IoTDBQueryTranslator.translate("pool_metrics", List.of("fill_ratio"), lookup);
        assertThat(sql).contains("WHERE pool = 'default'");
    }

    @Test
    void timeFrameFilter() {
        var filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("time", "TIME_FRAME", List.of("3600"))));
        var lookup = new DataSetLookup("iotdb:pool_metrics:fill_ratio", List.of(filter), null);
        var sql = IoTDBQueryTranslator.translate("pool_metrics", List.of("fill_ratio"), lookup);
        assertThat(sql).contains("WHERE time >=");
    }

    @Test
    void multipleColumns() {
        var lookup = new DataSetLookup("iotdb:pool_metrics:active,idle,fill_ratio", List.of(), null);
        var sql = IoTDBQueryTranslator.translate("pool_metrics", List.of("active", "idle", "fill_ratio"), lookup);
        assertThat(sql).contains("SELECT time, active, idle, fill_ratio FROM pool_metrics");
    }

    @Test
    void multipleFilters_joinedWithAnd() {
        var filter = new FilterOp(List.of(
            new FilterExpression.Unresolved("pool", "EQUALS_TO", List.of("default")),
            new FilterExpression.Unresolved("active", "GREATER_THAN", List.of("5"))));
        var lookup = new DataSetLookup("iotdb:pool_metrics:fill_ratio", List.of(filter), null);
        var sql = IoTDBQueryTranslator.translate("pool_metrics", List.of("fill_ratio"), lookup);
        assertThat(sql).contains("pool = 'default'");
        assertThat(sql).contains("active > 5");
        assertThat(sql).contains(" AND ");
    }
}
