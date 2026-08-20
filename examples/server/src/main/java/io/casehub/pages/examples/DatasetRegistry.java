package io.casehub.pages.examples;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class DatasetRegistry {
    private final ConcurrentHashMap<String, Set<String>> datasetToConnections = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> connectionToDatasets = new ConcurrentHashMap<>();

    public void subscribe(String connectionId, String dataset) {
        datasetToConnections.computeIfAbsent(dataset, k -> ConcurrentHashMap.newKeySet()).add(connectionId);
        connectionToDatasets.computeIfAbsent(connectionId, k -> ConcurrentHashMap.newKeySet()).add(dataset);
    }

    public void unsubscribe(String connectionId, String dataset) {
        Set<String> conns = datasetToConnections.get(dataset);
        if (conns != null) {
            conns.remove(connectionId);
            if (conns.isEmpty()) datasetToConnections.remove(dataset);
        }
        Set<String> datasets = connectionToDatasets.get(connectionId);
        if (datasets != null) {
            datasets.remove(dataset);
            if (datasets.isEmpty()) connectionToDatasets.remove(connectionId);
        }
    }

    public void removeConnection(String connectionId) {
        Set<String> datasets = connectionToDatasets.remove(connectionId);
        if (datasets != null) {
            for (String dataset : datasets) {
                Set<String> conns = datasetToConnections.get(dataset);
                if (conns != null) {
                    conns.remove(connectionId);
                    if (conns.isEmpty()) datasetToConnections.remove(dataset);
                }
            }
        }
    }

    public Set<String> connections(String dataset) {
        Set<String> conns = datasetToConnections.get(dataset);
        return conns != null ? Set.copyOf(conns) : Set.of();
    }
}
