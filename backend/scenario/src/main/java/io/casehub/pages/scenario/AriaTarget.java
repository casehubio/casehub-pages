package io.casehub.pages.scenario;

import java.util.Objects;

public record AriaTarget(String role, String name, AriaTarget within) {

    public AriaTarget {
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(name, "name");
    }

    public AriaTarget(String role, String name) {
        this(role, name, null);
    }
}
