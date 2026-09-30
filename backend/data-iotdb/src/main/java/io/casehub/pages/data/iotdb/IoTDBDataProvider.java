package io.casehub.pages.data.iotdb;

import io.casehub.pages.data.DataProvider;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.DataSetResult;
import io.casehub.pages.data.QueryResult;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class IoTDBDataProvider implements DataProvider {

    @Override
    public String type() {
        return "iotdb";
    }

    @Override
    public boolean canHandle(String dataSetId) {
        return dataSetId != null && dataSetId.startsWith("iotdb:");
    }

    @Override
    public QueryResult query(DataSetLookup lookup) {
        var parts = lookup.dataSetId().split(":");
        if (parts.length < 3) {
            return QueryResult.complete(new DataSetResult(List.of(), List.of()));
        }
        var table = parts[1];
        var columns = List.of(parts[2].split(","));
        var sql = IoTDBQueryTranslator.translate(table, columns, lookup);
        return QueryResult.complete(new DataSetResult(List.of(), List.of()));
    }
}
