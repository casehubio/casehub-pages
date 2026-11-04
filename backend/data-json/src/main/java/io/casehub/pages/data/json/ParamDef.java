package io.casehub.pages.data.json;

public record ParamDef(
    String name,
    String type,
    boolean required,
    String defaultValue
) {
    public ParamDef {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Param name required");
        if (type == null) type = "string";
    }
}
