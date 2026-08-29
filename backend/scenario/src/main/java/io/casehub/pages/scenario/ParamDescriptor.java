package io.casehub.pages.scenario;

import java.util.List;

public record ParamDescriptor(String name, String type, boolean required,
                               Object defaultValue, List<Object> enumValues) {
    public ParamDescriptor {
        if (enumValues == null) enumValues = List.of();
    }
}
