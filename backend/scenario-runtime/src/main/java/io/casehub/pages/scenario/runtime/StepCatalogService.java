package io.casehub.pages.scenario.runtime;

import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

public class StepCatalogService {

    private final Map<String, CatalogActionDetail> actions = new LinkedHashMap<>();

    public StepCatalogService(Path definitionsPath) {
        if (definitionsPath != null && Files.isDirectory(definitionsPath)) {
            loadYamlFromDirectory(definitionsPath);
        }
    }

    public List<CatalogActionSummary> listActions() {
        return actions.values().stream()
                .map(d -> new CatalogActionSummary(
                        d.name(), d.description(), d.invokeKind(),
                        d.source(), d.inputs().size(), d.outputs().size()))
                .toList();
    }

    public Optional<CatalogActionDetail> getAction(String name) {
        return Optional.ofNullable(actions.get(name));
    }

    private void loadYamlFromDirectory(Path directory) {
        var yaml = new Yaml();
        try (Stream<Path> files = Files.list(directory)) {
            files.filter(p -> {
                        var name = p.toString();
                        return name.endsWith(".yaml") || name.endsWith(".yml");
                    })
                    .sorted()
                    .forEach(path -> loadYamlFile(yaml, path));
        } catch (IOException e) {
            // directory not readable — skip silently
        }
    }

    private void loadYamlFile(Yaml yaml, Path path) {
        try (InputStream is = Files.newInputStream(path)) {
            @SuppressWarnings("unchecked")
            var doc = (Map<String, Object>) yaml.load(is);
            if (doc != null) {
                parseDefinitionFile(doc);
            }
        } catch (IOException e) {
            // skip unreadable files
        }
    }

    @SuppressWarnings("unchecked")
    private void parseDefinitionFile(Map<String, Object> doc) {
        var namespace = (String) doc.get("namespace");
        var actionsMap = (Map<String, Map<String, Object>>) doc.get("actions");
        if (actionsMap == null) return;

        for (var entry : actionsMap.entrySet()) {
            var name = entry.getKey();
            var qualifiedName = namespace != null ? namespace + "." + name : name;
            var actionDef = entry.getValue();

            var description = (String) actionDef.get("description");
            var inputs = parseParams((Map<String, Object>) actionDef.get("inputs"));
            var outputs = parseParams((Map<String, Object>) actionDef.get("outputs"));
            var invoke = parseInvoke((Map<String, Object>) actionDef.get("invoke"));

            var detail = new CatalogActionDetail(
                    name, description,
                    invoke != null ? invoke.kind() : null,
                    "yaml", inputs, outputs, invoke);
            actions.putIfAbsent(qualifiedName, detail);
            if (namespace != null) {
                actions.putIfAbsent(name, detail);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, StepParameterDto> parseParams(Map<String, Object> raw) {
        if (raw == null) return Map.of();
        var result = new LinkedHashMap<String, StepParameterDto>();
        for (var entry : raw.entrySet()) {
            var paramRaw = entry.getValue();
            if (paramRaw instanceof String typeStr) {
                result.put(entry.getKey(), new StepParameterDto(
                        typeStr.toUpperCase(), false, null, null, null, null));
            } else if (paramRaw instanceof Map<?, ?> map) {
                var p = (Map<String, Object>) map;
                var type = p.get("type") != null ? p.get("type").toString().toUpperCase() : "STRING";
                var required = Boolean.TRUE.equals(p.get("required"));
                var defaultValue = p.containsKey("defaultValue")
                        ? String.valueOf(p.get("defaultValue"))
                        : (p.containsKey("default") ? String.valueOf(p.get("default")) : null);
                var allowedRaw = p.containsKey("allowedValues")
                        ? (List<?>) p.get("allowedValues")
                        : (p.containsKey("enum") ? (List<?>) p.get("enum") : null);
                var allowedValues = allowedRaw != null
                        ? allowedRaw.stream().map(String::valueOf).toList()
                        : null;
                var format = (String) p.get("format");
                var desc = (String) p.get("description");
                result.put(entry.getKey(), new StepParameterDto(
                        type, required, defaultValue, allowedValues, format, desc));
            }
        }
        return result;
    }

    private InvokeBindingSummary parseInvoke(Map<String, Object> raw) {
        if (raw == null) return null;
        if (raw.containsKey("mcp")) {
            return new InvokeBindingSummary("mcp", Map.of("tool", String.valueOf(raw.get("mcp"))));
        }
        if (raw.containsKey("rest")) {
            @SuppressWarnings("unchecked")
            var spec = (Map<String, Object>) raw.get("rest");
            return new InvokeBindingSummary("rest", Map.of(
                    "method", String.valueOf(spec.getOrDefault("method", "GET")),
                    "url", String.valueOf(spec.get("url"))));
        }
        if (raw.containsKey("python")) {
            return new InvokeBindingSummary("script", Map.of(
                    "runtime", "python3", "script", String.valueOf(raw.get("python"))));
        }
        if (raw.containsKey("node")) {
            return new InvokeBindingSummary("script", Map.of(
                    "runtime", "node", "script", String.valueOf(raw.get("node"))));
        }
        if (raw.containsKey("graphql")) {
            return new InvokeBindingSummary("graphql", Map.of("query", String.valueOf(raw.get("graphql"))));
        }
        if (raw.containsKey("agent")) {
            @SuppressWarnings("unchecked")
            var spec = (Map<String, Object>) raw.get("agent");
            return new InvokeBindingSummary("agent", Map.of(
                    "descriptor", String.valueOf(spec.get("descriptor"))));
        }
        if (raw.containsKey("process")) {
            @SuppressWarnings("unchecked")
            var spec = (Map<String, Object>) raw.get("process");
            return new InvokeBindingSummary("process", Map.of(
                    "command", String.valueOf(spec.get("command"))));
        }
        if (raw.containsKey("script")) {
            @SuppressWarnings("unchecked")
            var spec = (Map<String, Object>) raw.get("script");
            return new InvokeBindingSummary("script", Map.of(
                    "runtime", String.valueOf(spec.get("runtime")),
                    "script", String.valueOf(spec.get("script"))));
        }
        return null;
    }
}
