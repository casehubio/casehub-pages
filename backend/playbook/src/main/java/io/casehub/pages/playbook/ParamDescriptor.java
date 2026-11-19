package io.casehub.pages.playbook;

import org.eclipse.microprofile.graphql.Ignore;

import java.util.List;

public record ParamDescriptor(String name, String type, boolean required,
                              @Ignore Object defaultValue, @Ignore List<Object> enumValues) {
    public ParamDescriptor {
        if (enumValues == null) {enumValues = List.of();}
    }
}
