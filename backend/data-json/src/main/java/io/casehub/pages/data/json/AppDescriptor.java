package io.casehub.pages.data.json;

import java.util.List;

public record AppDescriptor(
    String appId,
    List<CollectionDef> collections,
    List<LabelTreeDef> labelTrees
) {
    public AppDescriptor {
        if (collections == null) collections = List.of();
        if (labelTrees == null) labelTrees = List.of();
    }
}
