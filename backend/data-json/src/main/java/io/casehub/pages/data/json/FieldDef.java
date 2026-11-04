package io.casehub.pages.data.json;

import java.util.List;

public record FieldDef(
    String name,
    FieldType type,
    Object defaultValue,
    List<String> enumValues,
    String ref,
    boolean required,
    Integer minLength,
    Integer maxLength,
    String pattern,
    Number minimum,
    Number maximum,
    Number exclusiveMinimum,
    Number exclusiveMaximum,
    Number multipleOf,
    String format
) {
    public FieldDef {
        if (enumValues == null) enumValues = List.of();
    }

    public FieldDef(String name, FieldType type, Object defaultValue,
                    List<String> enumValues, String ref) {
        this(name, type, defaultValue, enumValues, ref,
             false, null, null, null, null, null, null, null, null, null);
    }
}
