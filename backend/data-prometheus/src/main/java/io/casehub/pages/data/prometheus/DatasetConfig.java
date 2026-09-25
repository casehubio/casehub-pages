package io.casehub.pages.data.prometheus;

import io.smallrye.config.WithDefault;

public interface DatasetConfig {
    String metric();

    @WithDefault("60s")
    String step();
}
