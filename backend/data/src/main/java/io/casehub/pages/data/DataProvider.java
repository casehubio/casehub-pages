package io.casehub.pages.data;

public interface DataProvider {
    String type();
    boolean canHandle(String dataSetId);

    QueryResult query(DataSetLookup lookup);
}
