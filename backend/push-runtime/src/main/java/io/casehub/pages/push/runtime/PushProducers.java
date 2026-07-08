package io.casehub.pages.push.runtime;

import io.casehub.pages.push.EventBroadcaster;
import io.casehub.pages.push.EventStore;
import io.casehub.pages.push.InMemoryEventStore;
import io.casehub.pages.push.SessionSender;
import io.casehub.pages.push.TopicRegistry;
import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class PushProducers {

    @Produces
    @ApplicationScoped
    TopicRegistry topicRegistry() {
        return new TopicRegistry();
    }

    @Produces
    @ApplicationScoped
    @DefaultBean
    EventStore eventStore(
            @ConfigProperty(name = "casehub.pages.push.max-events-per-topic",
                            defaultValue = "1000") int maxEventsPerTopic) {
        return new InMemoryEventStore(maxEventsPerTopic);
    }

    @Produces
    @ApplicationScoped
    EventBroadcaster eventBroadcaster(EventStore eventStore,
                                       TopicRegistry topicRegistry,
                                       SessionSender sessionSender) {
        return new EventBroadcaster(eventStore, topicRegistry, sessionSender);
    }
}
