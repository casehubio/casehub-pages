package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.NarrativeContent;

public record PlaybookState(String playbook, String chapter, String section,
                            String step, boolean paused, double speed,
                            double progress, NarrativeContent content,
                            String slides) {

    public static PlaybookState idle() {
        return new PlaybookState(null, null, null, null, false, 1.0, 0.0, null, null);
    }
}
