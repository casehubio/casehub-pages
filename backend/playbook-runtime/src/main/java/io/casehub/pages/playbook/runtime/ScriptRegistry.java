package io.casehub.pages.playbook.runtime;

import io.casehub.pages.playbook.ScriptDescriptor;
import io.casehub.pages.playbook.LifecycleEngine;
import io.casehub.pages.playbook.ScriptMeta;
import io.casehub.pages.playbook.ScriptProvenance;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

public class ScriptRegistry {

    private final BundledScriptSource bundled;
    private final UploadedScriptSource uploaded;
    private final List<ScriptSource> externalSources;
    private final LifecycleEngine lifecycleEngine = LifecycleEngine.defaultEngine();

    public ScriptRegistry(BundledScriptSource bundled, UploadedScriptSource uploaded) {
        this(bundled, uploaded, List.of());
    }

    public ScriptRegistry(BundledScriptSource bundled, UploadedScriptSource uploaded,
                           List<ScriptSource> externalSources) {
        this.bundled = bundled;
        this.uploaded = uploaded;
        this.externalSources = List.copyOf(externalSources);
    }

    public List<ScriptDescriptor> list(List<String> labels, List<String> tags) {
        return allDescriptors()
                .filter(d -> matchesLabels(d, labels))
                .filter(d -> matchesTags(d, tags))
                .toList();
    }

    public Optional<ScriptDescriptor> get(String name) {
        return allDescriptors().filter(d -> d.name().equals(name)).findFirst();
    }

    public Optional<String> getYaml(String name) {
        Optional<String> yaml = bundled.getYaml(name);
        if (yaml.isPresent()) return yaml;
        yaml = uploaded.getYaml(name);
        if (yaml.isPresent()) return yaml;
        for (ScriptSource source : externalSources) {
            yaml = source.getYaml(name);
            if (yaml.isPresent()) return yaml;
        }
        return Optional.empty();
    }

    public ScriptDescriptor upload(String yaml) {
        var desc = io.casehub.pages.playbook.ScriptDescriptorExtractor.extract(
                yaml, ScriptProvenance.UPLOADED);
        if (bundled.contains(desc.name())) {
            throw new IllegalArgumentException(
                    "Cannot upload script '" + desc.name()
                    + "': a bundled script with the same name exists");
        }
        for (ScriptSource ext : externalSources) {
            if (ext.contains(desc.name())) {
                throw new IllegalArgumentException(
                        "Cannot upload script '" + desc.name()
                        + "': an external registry script with the same name exists");
            }
        }
        return uploaded.upload(yaml);
    }

    public ScriptDescriptor updateMeta(String name, ScriptMeta meta) {
        if (!uploaded.contains(name)) {
            throw new IllegalArgumentException(
                    "Cannot update metadata for '" + name + "': not an uploaded script");
        }
        String state = uploaded.stateOf(name);
        if (state != null && !state.equals(lifecycleEngine.initialState())) {
            throw new IllegalStateException(
                    "Cannot update metadata for '" + name + "': script is " + state
                    + ", must be " + lifecycleEngine.initialState());
        }
        return uploaded.updateMeta(name, meta);
    }

    public boolean delete(String name) {
        if (bundled.contains(name)) return false;
        return uploaded.delete(name);
    }

    public ScriptDescriptor transition(String name, String targetState) {
        if (!uploaded.contains(name)) {
            throw new IllegalArgumentException(
                    "Cannot transition '" + name + "': not an uploaded script");
        }
        String current = uploaded.stateOf(name);
        lifecycleEngine.validateTransition(current, targetState);
        return uploaded.setState(name, targetState);
    }

    public List<ScriptDescriptor> listByState(String state,
            List<String> labels, List<String> tags) {
        return allDescriptors()
                .filter(d -> state.equals(d.state()))
                .filter(d -> matchesLabels(d, labels))
                .filter(d -> matchesTags(d, tags))
                .toList();
    }


    private Stream<ScriptDescriptor> allDescriptors() {
        Stream<ScriptDescriptor> base = Stream.concat(
                bundled.list().stream(), uploaded.list().stream());
        for (ScriptSource ext : externalSources) {
            base = Stream.concat(base, ext.list().stream());
        }
        return base;
    }

    private static boolean matchesLabels(ScriptDescriptor d, List<String> labels) {
        if (labels == null || labels.isEmpty()) return true;
        return d.labels().containsAll(labels);
    }

    private static boolean matchesTags(ScriptDescriptor d, List<String> tags) {
        if (tags == null || tags.isEmpty()) return true;
        for (String tag : tags) {
            if (d.tags().contains(tag)) return true;
        }
        return false;
    }
}
