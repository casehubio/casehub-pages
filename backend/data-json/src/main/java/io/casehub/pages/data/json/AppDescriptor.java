package io.casehub.pages.data.json;

import java.util.List;

public record AppDescriptor(
    String appId,
    List<CollectionDef> collections
) {
    public AppDescriptor {
        if (collections == null) collections = List.of();
    }
}
