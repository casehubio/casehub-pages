package io.casehub.pages.scenario.runtime;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.casehub.pages.scenario.ParamDescriptor;
import io.casehub.pages.scenario.ScriptDescriptor;
import io.casehub.pages.scenario.ScriptProvenance;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ExternalRegistrySource implements ScriptSource {

    private static final Logger LOG = Logger.getLogger(ExternalRegistrySource.class.getName());
    private static final ObjectMapper JSON = new ObjectMapper();

    @FunctionalInterface
    public interface Fetcher {
        String fetch(URI uri);
    }

    private final String registryName;
    private final URI manifestUrl;
    private final Fetcher fetcher;
    private final Duration cacheTtl;

    private List<ManifestEntry> cachedEntries;
    private Instant cacheExpiry = Instant.MIN;

    public ExternalRegistrySource(String registryName, URI manifestUrl,
                                   Fetcher fetcher, Duration cacheTtl) {
        this.registryName = registryName;
        this.manifestUrl = manifestUrl;
        this.fetcher = fetcher;
        this.cacheTtl = cacheTtl;
    }

    @Override
    public List<ScriptDescriptor> list() {
        return fetchManifest().stream().map(this::toDescriptor).toList();
    }

    @Override
    public Optional<String> getYaml(String name) {
        return fetchManifest().stream()
                .filter(e -> e.name.equals(name))
                .findFirst()
                .map(entry -> {
                    URI contentUri = manifestUrl.resolve(entry.contentUrl);
                    try {
                        return fetcher.fetch(contentUri);
                    } catch (Exception e) {
                        LOG.log(Level.WARNING, "Failed to fetch YAML for " + name
                                + " from " + contentUri, e);
                        return null;
                    }
                });
    }

    @Override
    public boolean contains(String name) {
        return fetchManifest().stream().anyMatch(e -> e.name.equals(name));
    }

    private synchronized List<ManifestEntry> fetchManifest() {
        if (cachedEntries != null && Instant.now().isBefore(cacheExpiry)) {
            return cachedEntries;
        }
        try {
            String json = fetcher.fetch(manifestUrl);
            cachedEntries = JSON.readValue(json, new TypeReference<>() {});
            cacheExpiry = Instant.now().plus(cacheTtl);
            return cachedEntries;
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Failed to fetch manifest from " + manifestUrl, e);
            if (cachedEntries != null) return cachedEntries;
            return List.of();
        }
    }

    private ScriptDescriptor toDescriptor(ManifestEntry entry) {
        List<ParamDescriptor> params = entry.params != null
                ? entry.params.stream().map(this::toParamDescriptor).toList()
                : List.of();
        return new ScriptDescriptor(
                entry.name,
                entry.description,
                entry.labels != null ? entry.labels : List.of(),
                entry.tags != null ? entry.tags : List.of(),
                params,
                entry.calls != null ? entry.calls : List.of(),
                ScriptProvenance.EXTERNAL,
                List.of()
        );
    }

    private ParamDescriptor toParamDescriptor(ManifestParam p) {
        return new ParamDescriptor(
                p.name, p.type != null ? p.type : "string",
                p.required != null && p.required,
                p.defaultValue,
                p.enumValues != null ? p.enumValues : List.of()
        );
    }

    static class ManifestEntry {
        public String name;
        public String description;
        public List<String> labels;
        public List<String> tags;
        public List<ManifestParam> params;
        public String contentUrl;
        public List<String> calls;
    }

    static class ManifestParam {
        public String name;
        public String type;
        public Boolean required;
        public Object defaultValue;
        public List<Object> enumValues;
    }
}
