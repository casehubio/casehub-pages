package io.casehub.pages.playbook;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LifecycleEngineTest {

    final LifecycleEngine engine = LifecycleEngine.defaultEngine();

    @Test
    void initialState_isDraft() {
        assertThat(engine.initialState()).isEqualTo("draft");
    }

    @Test
    void states_returnsAll() {
        assertThat(engine.states()).containsExactly("draft", "active", "archived");
    }

    @Test
    void canTransition_draftToActive() {
        assertThat(engine.canTransition("draft", "active")).isTrue();
    }

    @Test
    void canTransition_draftToArchived_rejected() {
        assertThat(engine.canTransition("draft", "archived")).isFalse();
    }

    @Test
    void canTransition_activeToArchived() {
        assertThat(engine.canTransition("active", "archived")).isTrue();
    }

    @Test
    void canTransition_activeToDraft_revise() {
        assertThat(engine.canTransition("active", "draft")).isTrue();
    }

    @Test
    void canTransition_archivedToDraft_resurrect() {
        assertThat(engine.canTransition("archived", "draft")).isTrue();
    }

    @Test
    void canTransition_archivedToActive_rejected() {
        assertThat(engine.canTransition("archived", "active")).isFalse();
    }

    @Test
    void validateTransition_throwsOnInvalid() {
        assertThatThrownBy(() -> engine.validateTransition("draft", "archived"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cannot transition from 'draft' to 'archived'");
    }

    @Test
    void validateTransition_passesOnValid() {
        engine.validateTransition("draft", "active");
    }

    @Test
    void availableTransitions_fromActive() {
        assertThat(engine.availableTransitions("active")).containsExactly("archived", "draft");
    }

    @Test
    void availableTransitions_fromDraft() {
        assertThat(engine.availableTransitions("draft")).containsExactly("active");
    }

    @Test
    void availableTransitions_fromArchived() {
        assertThat(engine.availableTransitions("archived")).containsExactly("draft");
    }

    @Test
    void availableTransitions_unknownState_throws() {
        assertThatThrownBy(() -> engine.availableTransitions("nonexistent"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown state");
    }
}
