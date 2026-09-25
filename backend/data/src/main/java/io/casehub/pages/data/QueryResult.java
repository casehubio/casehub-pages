package io.casehub.pages.data;

import java.util.List;

public record QueryResult(DataSetResult result, List<DataSetOp> remainingOps) {
    public static QueryResult complete(DataSetResult result) {
        return new QueryResult(result, List.of());
    }
}
