package io.casehub.pages.playbook;

import java.util.List;

public record ScriptMeta(String description, List<String> labels, List<String> tags) {
    public ScriptMeta {
        if (labels == null) labels = List.of();
        if (tags == null) tags = List.of();
    }
}
