package io.casehub.pages.data.json;

import java.util.List;

public record LabelTreeDef(String name, List<String> paths) {
    public LabelTreeDef {
        if (paths == null) paths = List.of();
    }
}
