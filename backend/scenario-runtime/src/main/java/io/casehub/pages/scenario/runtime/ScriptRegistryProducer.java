package io.casehub.pages.scenario.runtime;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;

import java.nio.file.Path;
import java.util.List;

@ApplicationScoped
public class ScriptRegistryProducer {

    @Produces
    @ApplicationScoped
    public ScriptRegistry scriptRegistry(ScenarioConfig config) {
        var bundledPaths = scanClasspath();
        var bundled = new BundledScriptSource(bundledPaths);
        var uploaded = new UploadedScriptSource(Path.of(config.libraryPath()));
        return new ScriptRegistry(bundled, uploaded);
    }

    private static List<String> scanClasspath() {
        var paths = new java.util.ArrayList<String>();
        try {
            var resources = Thread.currentThread().getContextClassLoader()
                    .getResources("META-INF/scenarios");
            while (resources.hasMoreElements()) {
                var url = resources.nextElement();
                if ("file".equals(url.getProtocol())) {
                    var dir = Path.of(url.toURI());
                    try (var files = java.nio.file.Files.list(dir)) {
                        files.filter(f -> f.toString().endsWith(".yaml") || f.toString().endsWith(".yml"))
                                .forEach(f -> paths.add("META-INF/scenarios/" + f.getFileName()));
                    }
                }
            }
        } catch (Exception ignored) {}
        return paths;
    }
}
