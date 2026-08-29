package io.casehub.pages.scenario.runtime;

import io.casehub.pages.scenario.ScriptDescriptor;
import io.casehub.pages.scenario.ScriptDescriptorExtractor;
import io.casehub.pages.scenario.ScriptProvenance;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class BundledScriptSource implements ScriptSource {

    private final Map<String, ScriptDescriptor> descriptors = new LinkedHashMap<>();
    private final Map<String, String> yamlContent = new LinkedHashMap<>();

    public BundledScriptSource(List<String> resourcePaths) {
        for (String path : resourcePaths) {
            String yaml = loadResource(path);
            if (yaml != null) {
                ScriptDescriptor desc = ScriptDescriptorExtractor.extract(yaml, ScriptProvenance.BUNDLED);
                descriptors.put(desc.name(), desc);
                yamlContent.put(desc.name(), yaml);
            }
        }
    }

    @Override
    public List<ScriptDescriptor> list() {
        return List.copyOf(descriptors.values());
    }

    @Override
    public Optional<String> getYaml(String name) {
        return Optional.ofNullable(yamlContent.get(name));
    }

    @Override
    public boolean contains(String name) {
        return descriptors.containsKey(name);
    }

    private static String loadResource(String path) {
        try (InputStream is = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream(path)) {
            return is != null ? new String(is.readAllBytes(), StandardCharsets.UTF_8) : null;
        } catch (IOException e) {
            return null;
        }
    }
}
