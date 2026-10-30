package io.casehub.pages.data.json;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum FieldType {
    STRING, NUMBER, BOOLEAN, DATE, ENUM, ARRAY, OBJECT, REF;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static FieldType fromJson(String value) {
        return valueOf(value.toUpperCase());
    }
}
