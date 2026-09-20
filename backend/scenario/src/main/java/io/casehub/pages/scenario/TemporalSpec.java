package io.casehub.pages.scenario;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public record TemporalSpec(
        Action action,
        String name,
        String profile,
        String qualifiedName,
        String tenancyId,
        List<Event> events,
        Boolean loop,
        Double speed) {

    public enum Action { START, STOP, PAUSE, RESUME, SET_SPEED }

    public record Event(String delay, String label, Map<String, Object> payload) {}

    public TemporalSpec {
        Objects.requireNonNull(action, "action");
    }

    public String effectiveName() {
        if (name != null && !name.isBlank()) return name;
        if (profile != null && !profile.isBlank()) return profile;
        throw new IllegalArgumentException("name or profile is required for temporal step");
    }
}
