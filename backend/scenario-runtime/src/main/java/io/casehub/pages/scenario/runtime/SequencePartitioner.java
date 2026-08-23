package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.HierarchicalStep;

import java.util.ArrayList;
import java.util.List;

public final class SequencePartitioner {

    public record StepSequence(String target, List<HierarchicalStep> steps) {
        public StepSequence {
            java.util.Objects.requireNonNull(target, "target");
            steps = List.copyOf(steps);
        }
    }

    private SequencePartitioner() {}

    public static List<StepSequence> partitionInitial(List<HierarchicalStep> steps) {
        return partition(steps.stream().filter(s -> s.trigger() == null).toList());
    }

    public static List<StepSequence> partition(List<HierarchicalStep> steps) {
        if (steps.isEmpty()) return List.of();

        var result = new ArrayList<StepSequence>();
        String currentTarget = null;
        List<HierarchicalStep> currentGroup = null;

        for (var step : steps) {
            if (!step.target().equals(currentTarget)) {
                if (currentGroup != null) {
                    result.add(new StepSequence(currentTarget, currentGroup));
                }
                currentTarget = step.target();
                currentGroup = new ArrayList<>();
            }
            currentGroup.add(step);
        }
        if (currentGroup != null && !currentGroup.isEmpty()) {
            result.add(new StepSequence(currentTarget, currentGroup));
        }
        return List.copyOf(result);
    }
}
