package io.casehub.pages.data.json;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.casehub.pages.data.ColumnDef;
import io.casehub.pages.data.DataContext;
import io.casehub.pages.data.DataSetLookup;
import io.casehub.pages.data.DataSetOp;
import io.casehub.pages.data.DataSetResult;
import io.casehub.pages.data.MutableDataProvider;
import io.casehub.pages.data.MutationException;
import io.casehub.pages.data.QueryResult;
import io.casehub.pages.sqlite.SqliteConnectionFactory;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

@ApplicationScoped
public class JsonDataProvider implements MutableDataProvider {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String PREFIX = "json:";

    @Inject
    SqliteConnectionFactory connectionFactory;
    @Inject
    AppRegistry             appRegistry;


    private JsonCollectionStore store;

    @PostConstruct
    void init() {
        store = new JsonCollectionStore(connectionFactory);
    }

    @Override
    public String type() {
        return "json";
    }

    @Override
    public boolean canHandle(String dataSetId) {
        return dataSetId != null && dataSetId.startsWith(PREFIX);
    }

    @Override
    public QueryResult query(DataSetLookup lookup) {
        String[] parts = parseDataSetId(lookup.dataSetId());
        String appId = parts[0];
        String collection = parts[1];

        PreparedQuery pq = JsonQueryTranslator.translate(appId, appId, collection, lookup.operations());
        List<DataSetOp> remaining = JsonQueryTranslator.remainingOps(lookup.operations());

        DataSetResult result = store.executeQuery(pq, rs -> {
            Set<String> columnNames = new LinkedHashSet<>();
            List<Map<String, String>> rows = new ArrayList<>();

            try {
                while (rs.next()) {
                    String dataStr = rs.getString("data");
                    ObjectNode doc = (ObjectNode) MAPPER.readTree(dataStr);
                    Map<String, String> row = new LinkedHashMap<>();
                    doc.fields().forEachRemaining(entry -> {
                        columnNames.add(entry.getKey());
                        JsonNode val = entry.getValue();
                        row.put(entry.getKey(), val.isTextual() ? val.asText() :
                                val.isNumber() ? String.valueOf(val.numberValue()) :
                                val.isBoolean() ? String.valueOf(val.booleanValue()) :
                                val.toString());
                    });
                    rows.add(row);
                }
            } catch (JsonProcessingException e) {
                throw new MutationException("STORAGE_ERROR", "Failed to parse document: " + e.getMessage(), e);
            }

            List<ColumnDef> columns = columnNames.stream()
                .map(name -> new ColumnDef(name, name, "TEXT"))
                .toList();

            List<List<String>> tableRows = rows.stream()
                .map(row -> columns.stream()
                    .map(col -> row.getOrDefault(col.id(), ""))
                    .toList())
                .toList();

            return new DataSetResult(columns, tableRows);
        });

        return new QueryResult(result, remaining);
    }

    @Override
    public Optional<JsonNode> get(DataContext ctx, String collection, String docId) {
        return store.get(ctx, ctx.tenantId(), collection, docId);
    }

    @Override
    public String create(DataContext ctx, String collection, JsonNode document, String slugField) {
        validateAndApplyDefaults(collection, document);
        return store.create(ctx, ctx.tenantId(), collection, document, slugField);
    }

    @Override
    public void update(DataContext ctx, String collection, String docId,
                       JsonNode changes, OptionalInt expectedVersion) {
        validateSchema(collection, changes);
        store.update(ctx, ctx.tenantId(), collection, docId, changes, expectedVersion, MergeStrategy.RFC_7396);
    }

    @Override
    public void delete(DataContext ctx, String collection, String docId) {
        store.delete(ctx, ctx.tenantId(), collection, docId);
    }

    @Override
    public boolean hasReferences(DataContext ctx, String collection, String docId) {
        return false;
    }

    private String[] parseDataSetId(String dataSetId) {
        String rest = dataSetId.substring(PREFIX.length());
        int slash = rest.indexOf('/');
        if (slash < 0) {
            return new String[]{rest, rest};
        }
        return new String[]{rest.substring(0, slash), rest.substring(slash + 1)};
    }

    private void validateAndApplyDefaults(String collection, JsonNode document) {
        appRegistry.getSchemaForCollection(collection).ifPresent(schema -> {
            if (document instanceof com.fasterxml.jackson.databind.node.ObjectNode obj) {
                schema.applyDefaults(obj);
            }
            schema.validate(document);
        });
    }

    private void validateSchema(String collection, JsonNode document) {
        appRegistry.getSchemaForCollection(collection).ifPresent(schema ->
                                                                         schema.validate(document));
    }

}
