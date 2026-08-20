package io.casehub.pages.scenario;

import java.util.Map;
import java.util.Objects;

public record AwaitCondition(Map<String, Object> match, Integer timeout, Integer interval) {

    public AwaitCondition {
        Objects.requireNonNull(match, "match");
        match = Map.copyOf(match);
        if (timeout == null) timeout = 30000;
        if (interval == null) interval = 500;
    }
}
