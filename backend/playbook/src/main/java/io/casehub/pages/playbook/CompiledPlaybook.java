package io.casehub.pages.playbook;

import java.util.List;

public record CompiledPlaybook(List<CompactStep> steps) {
    public CompiledPlaybook {
        steps = List.copyOf(steps);
    }
}
