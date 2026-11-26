package io.casehub.pages.examples;

import io.casehub.pages.push.PushConnectionListener;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class DatasetConnectionListener implements PushConnectionListener {

    private final DatasetRegistry datasetRegistry;

    @Inject
    public DatasetConnectionListener(DatasetRegistry datasetRegistry) {
        this.datasetRegistry = datasetRegistry;
    }

    @Override
    public void onDisconnect(String connectionId) {
        datasetRegistry.removeConnection(connectionId);
    }
}
