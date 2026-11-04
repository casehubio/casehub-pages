package io.casehub.pages.data.json;

import java.util.List;

public record AppDescriptor(
    String appId,
    List<CollectionDef> collections,
    List<LabelTreeDef> labelTrees,
    List<ParamDef> params,
    AppAccessPolicy access
) {
    public AppDescriptor {
        if (collections == null) collections = List.of();
        if (labelTrees == null) labelTrees = List.of();
        if (params == null) params = List.of();
        if (access == null) access = AppAccessPolicy.DEFAULT;
    }
}
