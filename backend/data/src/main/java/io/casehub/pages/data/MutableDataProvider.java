package io.casehub.pages.data;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Optional;
import java.util.OptionalInt;

public interface MutableDataProvider extends DataProvider {

    Optional<JsonNode> get(DataContext ctx, String collection, String docId);

    String create(DataContext ctx, String collection, JsonNode document, String slugField);

    void update(DataContext ctx, String collection, String docId,
                JsonNode changes, OptionalInt expectedVersion);

    void delete(DataContext ctx, String collection, String docId);

    boolean hasReferences(DataContext ctx, String collection, String docId);
}
