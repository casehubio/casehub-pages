package io.casehub.pages.scenario;

import java.util.Objects;

public record AriaTarget(String role, String name, String index, AriaTarget within) {

    public AriaTarget {
        Objects.requireNonNull(role, "role");
    }

    public AriaTarget(String role, String name, AriaTarget within) {
        this(role, name, null, within);
    }

    public AriaTarget(String role, String name) {
        this(role, name, null, null);
    }
}
