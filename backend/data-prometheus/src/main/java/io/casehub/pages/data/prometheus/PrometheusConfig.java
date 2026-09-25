package io.casehub.pages.data.prometheus;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.Map;
import java.util.Optional;

@ConfigMapping(prefix = "casehub.pages.data.prometheus")
public interface PrometheusConfig {
    String endpoint();

    @WithDefault("none")
    String authType();

    Optional<String> authToken();
    Optional<String> authUsername();
    Optional<String> authPassword();

    @WithDefault("5s")
    String connectTimeout();

    @WithDefault("30s")
    String readTimeout();

    @WithDefault("10000")
    int maxSamples();

    Map<String, DatasetConfig> datasets();
}
