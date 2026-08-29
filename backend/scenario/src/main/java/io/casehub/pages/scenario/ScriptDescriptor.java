package io.casehub.pages.scenario;

import java.util.List;

public record ScriptDescriptor(String name, String description,
                                List<String> labels, List<String> tags,
                                List<ParamDescriptor> params, List<String> calls,
                                ScriptProvenance provenance,
                                List<AriaTarget> firstStepTargets) {
    public ScriptDescriptor {
        if (labels == null) labels = List.of();
        if (tags == null) tags = List.of();
        if (params == null) params = List.of();
        if (calls == null) calls = List.of();
        if (firstStepTargets == null) firstStepTargets = List.of();
    }
}
