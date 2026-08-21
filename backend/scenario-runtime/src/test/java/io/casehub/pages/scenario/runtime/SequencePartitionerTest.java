package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.HierarchicalStep;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class SequencePartitionerTest {

    @Test
    void partitionByTarget() {
        var steps = List.of(
            step("Step 1", "browser"),
            step("Step 2", "browser"),
            step("Step 3", "helpdesk"),
            step("Step 4", "browser")
        );
        var partitions = SequencePartitioner.partition(steps);
        assertThat(partitions).hasSize(3);
        assertThat(partitions.get(0).target()).isEqualTo("browser");
        assertThat(partitions.get(0).steps()).hasSize(2);
        assertThat(partitions.get(1).target()).isEqualTo("helpdesk");
        assertThat(partitions.get(1).steps()).hasSize(1);
        assertThat(partitions.get(2).target()).isEqualTo("browser");
        assertThat(partitions.get(2).steps()).hasSize(1);
    }

    @Test
    void singleTargetSingleSequence() {
        var steps = List.of(
            step("A", "browser"),
            step("B", "browser"),
            step("C", "browser")
        );
        var partitions = SequencePartitioner.partition(steps);
        assertThat(partitions).hasSize(1);
        assertThat(partitions.getFirst().target()).isEqualTo("browser");
        assertThat(partitions.getFirst().steps()).hasSize(3);
    }

    @Test
    void emptyStepsEmptyPartitions() {
        var partitions = SequencePartitioner.partition(List.of());
        assertThat(partitions).isEmpty();
    }

    @Test
    void singleStep() {
        var partitions = SequencePartitioner.partition(List.of(step("Only", "helpdesk")));
        assertThat(partitions).hasSize(1);
        assertThat(partitions.getFirst().steps()).hasSize(1);
    }

    @Test
    void alternatingTargets() {
        var steps = List.of(
            step("A", "browser"),
            step("B", "helpdesk"),
            step("C", "browser"),
            step("D", "helpdesk")
        );
        var partitions = SequencePartitioner.partition(steps);
        assertThat(partitions).hasSize(4);
        assertThat(partitions.get(0).target()).isEqualTo("browser");
        assertThat(partitions.get(1).target()).isEqualTo("helpdesk");
        assertThat(partitions.get(2).target()).isEqualTo("browser");
        assertThat(partitions.get(3).target()).isEqualTo("helpdesk");
    }

    private static HierarchicalStep step(String label, String target) {
        return new HierarchicalStep(null, label, target, null, null, List.of());
    }
}
