package io.casehub.pages.data;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@DefaultBean
@ApplicationScoped
public class NoOpDataProvider implements DataProvider {
    @Override
    public String type() {
        return "noop";
    }

    @Override
    public boolean canHandle(String dataSetId) {
        return false;
    }

    @Override
    public QueryResult query(DataSetLookup lookup) {
        return QueryResult.complete(new DataSetResult(List.of(), List.of()));
    }
}
