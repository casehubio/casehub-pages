package io.casehub.pages.scenario;

import java.util.List;

public record OutlineNode(String label, String target, String action,
                          List<OutlineNode> children) {
    public OutlineNode(String label, List<OutlineNode> children) {
        this(label, null, null, children);
    }

    public OutlineNode(String label, String target) {
        this(label, target, null, List.of());
    }

    public OutlineNode(String label, String target, String action) {
        this(label, target, action, List.of());
    }
}
