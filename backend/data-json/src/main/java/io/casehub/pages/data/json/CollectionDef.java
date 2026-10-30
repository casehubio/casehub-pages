package io.casehub.pages.data.json;

import java.util.List;

public record CollectionDef(
    String name,
    List<FieldDef> fields,
    List<String> dataFiles
) {
    public CollectionDef {
        if (fields == null) fields = List.of();
        if (dataFiles == null) dataFiles = List.of();
    }
}
