package io.casehub.pages.data.json;

import java.util.List;

public record FieldDef(
    String name,
    FieldType type,
    Object defaultValue,
    List<String> enumValues,
    String ref
) {
    public FieldDef {
        if (enumValues == null) enumValues = List.of();
    }
}
