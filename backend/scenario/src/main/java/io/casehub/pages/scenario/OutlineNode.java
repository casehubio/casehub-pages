package io.casehub.pages.scenario;

import java.util.List;

public record OutlineNode(String label, String target,
                          List<OutlineNode> children) {
    public OutlineNode(String label, List<OutlineNode> children) {
        this(label, null, children);
    }

    public OutlineNode(String label, String target) {
        this(label, target, List.of());
    }
}
